import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const productosRouter = Router();

// Todos los endpoints de productos requieren autenticación JWT
productosRouter.use(authenticateToken);

// =====================================================================
// 1. CATEGORÍAS DE PRODUCTOS
// =====================================================================

// GET /api/productos/categorias
productosRouter.get('/categorias', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      'SELECT id_categoria, codigo, nombre, descripcion FROM categorias_producto ORDER BY nombre ASC'
    );
    res.status(200).json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al consultar categorías.', detalle: error.message });
  }
});

// POST /api/productos/categorias
productosRouter.post('/categorias', requireRole('ADMIN', 'ALMACEN'), async (req: Request, res: Response) => {
  const { codigo, nombre, descripcion } = req.body;

  if (!codigo || !nombre) {
    res.status(400).json({ error: 'El código y el nombre de la categoría son obligatorios.' });
    return;
  }

  try {
    const result = await query(
      `INSERT INTO categorias_producto (codigo, nombre, descripcion)
       VALUES ($1, $2, $3)
       RETURNING id_categoria, codigo, nombre, descripcion`,
      [codigo.trim().toUpperCase(), nombre.trim(), descripcion || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Ya existe una categoría con ese código.' });
      return;
    }
    res.status(500).json({ error: 'Error al registrar categoría.', detalle: error.message });
  }
});

// =====================================================================
// 2. CATÁLOGO DE PRODUCTOS
// =====================================================================

// GET /api/productos (con búsqueda y filtros)
productosRouter.get('/', async (req: Request, res: Response) => {
  const { q, id_categoria, activo = 'true', limit = '50', offset = '0' } = req.query;

  try {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (activo !== 'all') {
      conditions.push(`p.activo = $${paramIndex++}`);
      values.push(activo === 'true');
    }

    if (id_categoria) {
      conditions.push(`p.id_categoria = $${paramIndex++}`);
      values.push(Number(id_categoria));
    }

    if (q && typeof q === 'string' && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(
        `(p.codigo_producto ILIKE $${paramIndex} OR p.codigo_fabrica ILIKE $${paramIndex} OR p.descripcion ILIKE $${paramIndex})`
      );
      values.push(term);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.codigo_producto,
        p.codigo_fabrica,
        p.descripcion,
        p.unidad_medida,
        p.peso_kg,
        p.precio_costo,
        p.precio_venta_base,
        p.precio_venta_mayorista,
        p.stock_minimo,
        p.stock_maximo,
        p.maneja_serie,
        p.maneja_lote,
        p.url_imagen,
        p.activo,
        c.id_categoria,
        c.nombre as categoria_nombre
      FROM productos p
      JOIN categorias_producto c ON p.id_categoria = c.id_categoria
      ${whereClause}
      ORDER BY p.descripcion ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(Number(limit), Number(offset));
    const result = await query(sql, values);
    res.status(200).json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al listar productos.', detalle: error.message });
  }
});

// GET /api/productos/:codigo
productosRouter.get('/:codigo', async (req: Request, res: Response) => {
  const { codigo } = req.params;

  try {
    const sql = `
      SELECT 
        p.codigo_producto,
        p.codigo_fabrica,
        p.descripcion,
        p.unidad_medida,
        p.peso_kg,
        p.precio_costo,
        p.precio_venta_base,
        p.precio_venta_mayorista,
        p.stock_minimo,
        p.stock_maximo,
        p.maneja_serie,
        p.maneja_lote,
        p.url_imagen,
        p.activo,
        p.created_at,
        p.updated_at,
        c.id_categoria,
        c.codigo as categoria_codigo,
        c.nombre as categoria_nombre
      FROM productos p
      JOIN categorias_producto c ON p.id_categoria = c.id_categoria
      WHERE p.codigo_producto = $1
      LIMIT 1
    `;
    const result = await query(sql, [codigo]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener producto.', detalle: error.message });
  }
});

// POST /api/productos
productosRouter.post('/', requireRole('ADMIN', 'ALMACEN'), async (req: Request, res: Response) => {
  const {
    codigo_producto,
    id_categoria,
    codigo_fabrica,
    descripcion,
    unidad_medida = 'PZA',
    peso_kg = 0,
    precio_costo = 0,
    precio_venta_base = 0,
    precio_venta_mayorista = null,
    stock_minimo = 0,
    stock_maximo = 0,
    maneja_serie = false,
    maneja_lote = false,
    url_imagen = null,
    activo = true
  } = req.body;

  if (!codigo_producto || !id_categoria || !descripcion) {
    res.status(400).json({ error: 'codigo_producto, id_categoria y descripcion son obligatorios.' });
    return;
  }

  if (Number(precio_costo) < 0 || Number(precio_venta_base) < 0) {
    res.status(400).json({ error: 'Los precios no pueden ser negativos.' });
    return;
  }

  try {
    const sql = `
      INSERT INTO productos (
        codigo_producto,
        id_categoria,
        codigo_fabrica,
        descripcion,
        unidad_medida,
        peso_kg,
        precio_costo,
        precio_venta_base,
        precio_venta_mayorista,
        stock_minimo,
        stock_maximo,
        maneja_serie,
        maneja_lote,
        url_imagen,
        activo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const values = [
      codigo_producto.trim().toUpperCase(),
      Number(id_categoria),
      codigo_fabrica ? codigo_fabrica.trim() : null,
      descripcion.trim(),
      unidad_medida.trim().toUpperCase(),
      Number(peso_kg),
      Number(precio_costo),
      Number(precio_venta_base),
      precio_venta_mayorista !== null ? Number(precio_venta_mayorista) : null,
      Number(stock_minimo),
      Number(stock_maximo),
      Boolean(maneja_serie),
      Boolean(maneja_lote),
      url_imagen || null,
      Boolean(activo)
    ];

    const result = await query(sql, values);
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Ya existe un producto con ese código.' });
      return;
    }
    if (error.code === '23503') {
      res.status(400).json({ error: 'La categoría especificada no existe.' });
      return;
    }
    res.status(500).json({ error: 'Error al crear producto.', detalle: error.message });
  }
});

// PUT /api/productos/:codigo
productosRouter.put('/:codigo', requireRole('ADMIN', 'ALMACEN'), async (req: Request, res: Response) => {
  const { codigo } = req.params;
  const {
    id_categoria,
    codigo_fabrica,
    descripcion,
    unidad_medida,
    peso_kg,
    precio_costo,
    precio_venta_base,
    precio_venta_mayorista,
    stock_minimo,
    stock_maximo,
    maneja_serie,
    maneja_lote,
    url_imagen,
    activo
  } = req.body;

  try {
    const sql = `
      UPDATE productos SET
        id_categoria = COALESCE($2, id_categoria),
        codigo_fabrica = COALESCE($3, codigo_fabrica),
        descripcion = COALESCE($4, descripcion),
        unidad_medida = COALESCE($5, unidad_medida),
        peso_kg = COALESCE($6, peso_kg),
        precio_costo = COALESCE($7, precio_costo),
        precio_venta_base = COALESCE($8, precio_venta_base),
        precio_venta_mayorista = COALESCE($9, precio_venta_mayorista),
        stock_minimo = COALESCE($10, stock_minimo),
        stock_maximo = COALESCE($11, stock_maximo),
        maneja_serie = COALESCE($12, maneja_serie),
        maneja_lote = COALESCE($13, maneja_lote),
        url_imagen = COALESCE($14, url_imagen),
        activo = COALESCE($15, activo),
        updated_at = CURRENT_TIMESTAMP
      WHERE codigo_producto = $1
      RETURNING *
    `;

    const values = [
      codigo,
      id_categoria ? Number(id_categoria) : null,
      codigo_fabrica !== undefined ? codigo_fabrica : null,
      descripcion ? descripcion.trim() : null,
      unidad_medida ? unidad_medida.trim().toUpperCase() : null,
      peso_kg !== undefined ? Number(peso_kg) : null,
      precio_costo !== undefined ? Number(precio_costo) : null,
      precio_venta_base !== undefined ? Number(precio_venta_base) : null,
      precio_venta_mayorista !== undefined ? Number(precio_venta_mayorista) : null,
      stock_minimo !== undefined ? Number(stock_minimo) : null,
      stock_maximo !== undefined ? Number(stock_maximo) : null,
      maneja_serie !== undefined ? Boolean(maneja_serie) : null,
      maneja_lote !== undefined ? Boolean(maneja_lote) : null,
      url_imagen !== undefined ? url_imagen : null,
      activo !== undefined ? Boolean(activo) : null
    ];

    const result = await query(sql, values);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    res.status(200).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al actualizar producto.', detalle: error.message });
  }
});

// =====================================================================
// 3. CONSULTA DE EXISTENCIAS MULTIALMACÉN
// =====================================================================

// GET /api/productos/:codigo/stock
productosRouter.get('/:codigo/stock', async (req: Request, res: Response) => {
  const { codigo } = req.params;

  try {
    // 1. Validar que el producto exista
    const prodRes = await query(
      'SELECT codigo_producto, descripcion, stock_minimo, stock_maximo FROM productos WHERE codigo_producto = $1',
      [codigo]
    );

    if (prodRes.rows.length === 0) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }

    const producto = prodRes.rows[0];

    // 2. Consultar último saldo registrado en cada almacén
    const stockSql = `
      WITH UltimosMovimientos AS (
        SELECT DISTINCT ON (km.id_almacen)
          km.id_almacen,
          km.saldo_cantidad,
          km.costo_unitario,
          km.saldo_valorado,
          km.fecha_movimiento
        FROM kardex_movimientos km
        WHERE km.codigo_producto = $1
        ORDER BY km.id_almacen, km.id_kardex DESC
      )
      SELECT 
        a.id_almacen,
        a.codigo as almacen_codigo,
        a.nombre as almacen_nombre,
        a.tipo as almacen_tipo,
        s.id_sucursal,
        s.codigo as sucursal_codigo,
        s.nombre as sucursal_nombre,
        COALESCE(um.saldo_cantidad, 0.00) as stock_actual,
        COALESCE(um.costo_unitario, $2) as costo_unitario_vigente,
        COALESCE(um.saldo_valorado, 0.00) as saldo_valorado,
        um.fecha_movimiento as ultimo_movimiento
      FROM almacenes a
      JOIN sucursales s ON a.id_sucursal = s.id_sucursal
      LEFT JOIN UltimosMovimientos um ON a.id_almacen = um.id_almacen
      WHERE a.activo = TRUE
      ORDER BY s.id_sucursal ASC, a.id_almacen ASC
    `;

    const stockResult = await query(stockSql, [codigo, producto.stock_minimo]);

    let stockTotal = 0;
    let valoracionTotal = 0;

    const almacenes = stockResult.rows.map((row: any) => {
      const stock = Number(row.stock_actual);
      stockTotal += stock;
      valoracionTotal += Number(row.saldo_valorado);

      return {
        ...row,
        stock_actual: stock,
        alerta_stock_bajo: stock <= Number(producto.stock_minimo)
      };
    });

    res.status(200).json({
      codigo_producto: producto.codigo_producto,
      descripcion: producto.descripcion,
      stock_minimo: Number(producto.stock_minimo),
      stock_maximo: Number(producto.stock_maximo),
      stock_total: stockTotal,
      valoracion_total: valoracionTotal,
      alerta_stock_global: stockTotal <= Number(producto.stock_minimo),
      desglose_almacenes: almacenes
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al consultar existencias.', detalle: error.message });
  }
});
