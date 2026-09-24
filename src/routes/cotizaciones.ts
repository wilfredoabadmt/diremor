import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const cotizacionesRouter = Router();

// Todas las rutas de cotizaciones requieren autenticación JWT
cotizacionesRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de cotizaciones
 */
export async function initCotizacionesSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS cotizaciones_cabecera (
        id_cotizacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_vencimiento TIMESTAMPTZ NOT NULL,
        total_bruto NUMERIC(14,2) NOT NULL,
        descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        total_neto NUMERIC(14,2) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        id_venta_generada BIGINT REFERENCES ventas_cabecera(id_venta) ON DELETE SET NULL,
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
        id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones_cabecera(id_cotizacion) ON DELETE CASCADE,
        codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        cantidad NUMERIC(12,2) NOT NULL,
        precio_unitario NUMERIC(14,4) NOT NULL,
        subtotal NUMERIC(14,2) NOT NULL,
        CONSTRAINT chk_cotizacion_cantidad CHECK (cantidad > 0)
    );
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initCotizacionesSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initCotizacionesSchema().catch(console.error);

interface CotizacionItemInput {
  codigo_producto: string;
  cantidad: number;
  precio_unitario?: number;
}

// =====================================================================
// POST /api/cotizaciones - Emitir nueva cotización
// =====================================================================
cotizacionesRouter.post('/', requireRole('ADMIN', 'VENTAS', 'VENTAS_POS', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const {
    id_cliente,
    dias_validez = 7,
    descuento = 0,
    observaciones = '',
    items
  } = req.body;

  if (!id_cliente) {
    res.status(400).json({ error: 'Debe especificar el id_cliente (use 1 para mostrador).' });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Debe incluir al menos un producto en items.' });
    return;
  }

  const idUsuario = req.user?.id_usuario || 1;
  const idSucursal = req.user?.id_sucursal || 1;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar Cliente
    const cliRes = await client.query(
      'SELECT id_cliente, razon_social, nit_ci, estado FROM clientes WHERE id_cliente = $1',
      [id_cliente]
    );

    if (cliRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    const cliente = cliRes.rows[0];

    // 2. Pre-calcular totales y validar productos
    let totalBruto = 0;
    const itemsValidados: Array<{
      codigo_producto: string;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      descripcion: string;
    }> = [];

    for (const item of items as CotizacionItemInput[]) {
      const cant = Number(item.cantidad);
      if (isNaN(cant) || cant <= 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Cantidad inválida para producto ${item.codigo_producto}. Debe ser mayor a 0.` });
        return;
      }

      const prodRes = await client.query(
        'SELECT codigo_producto, descripcion, precio_venta_base, activo FROM productos WHERE codigo_producto = $1',
        [item.codigo_producto]
      );

      if (prodRes.rows.length === 0 || !prodRes.rows[0].activo) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Producto ${item.codigo_producto} no encontrado o inactivo.` });
        return;
      }

      const prod = prodRes.rows[0];
      const precioUnit = item.precio_unitario !== undefined ? Number(item.precio_unitario) : Number(prod.precio_venta_base);

      if (isNaN(precioUnit) || precioUnit < 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Precio inválido para producto ${prod.codigo_producto}.` });
        return;
      }

      const subtotal = Math.round(cant * precioUnit * 100) / 100;
      totalBruto += subtotal;

      itemsValidados.push({
        codigo_producto: prod.codigo_producto,
        cantidad: cant,
        precio_unitario: precioUnit,
        subtotal,
        descripcion: prod.descripcion
      });
    }

    const descNum = Number(descuento) || 0;
    const totalNeto = Math.round((totalBruto - descNum) * 100) / 100;

    if (totalNeto < 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El descuento no puede superar el total bruto de la cotización.' });
      return;
    }

    const dias = Math.max(1, Number(dias_validez) || 7);
    const fechaEmision = new Date();
    const fechaVencimiento = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

    // 3. Insertar Cabecera
    const insertCabSql = `
      INSERT INTO cotizaciones_cabecera (
        id_sucursal, id_cliente, id_usuario, fecha_emision, fecha_vencimiento,
        total_bruto, descuento, total_neto, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDIENTE', $9)
      RETURNING id_cotizacion, fecha_emision, fecha_vencimiento, total_bruto, descuento, total_neto, estado
    `;
    const cabRes = await client.query(insertCabSql, [
      idSucursal,
      id_cliente,
      idUsuario,
      fechaEmision,
      fechaVencimiento,
      totalBruto,
      descNum,
      totalNeto,
      observaciones
    ]);
    const nuevaCotiz = cabRes.rows[0];
    const idCotizacion = nuevaCotiz.id_cotizacion;

    // 4. Insertar Detalles
    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO cotizaciones_detalle (id_cotizacion, codigo_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5)`,
        [idCotizacion, item.codigo_producto, item.cantidad, item.precio_unitario, item.subtotal]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cotización emitida exitosamente.',
      cotizacion: {
        id_cotizacion: Number(idCotizacion),
        id_sucursal: idSucursal,
        id_cliente,
        cliente_nombre: cliente.razon_social,
        fecha_emision: nuevaCotiz.fecha_emision,
        fecha_vencimiento: nuevaCotiz.fecha_vencimiento,
        total_bruto: Number(nuevaCotiz.total_bruto),
        descuento: Number(nuevaCotiz.descuento),
        total_neto: Number(nuevaCotiz.total_neto),
        estado: nuevaCotiz.estado,
        items_count: itemsValidados.length
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/cotizaciones]:', error.message);
    res.status(500).json({ error: 'Error interno al emitir cotización.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/cotizaciones - Listar cotizaciones con filtros
// =====================================================================
cotizacionesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { id_cliente, estado, limit = 50, offset = 0 } = req.query;
  const idSucursal = req.user?.id_sucursal || 1;

  try {
    let sql = `
      SELECT 
        c.id_cotizacion,
        c.id_sucursal,
        s.nombre as sucursal_nombre,
        c.id_cliente,
        cl.razon_social as cliente_nombre,
        cl.nit_ci as cliente_nit,
        c.id_usuario,
        u.nombre_completo as vendedor_nombre,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.total_bruto,
        c.descuento,
        c.total_neto,
        c.estado,
        c.id_venta_generada,
        (c.fecha_vencimiento < CURRENT_TIMESTAMP AND c.estado = 'PENDIENTE') as esta_vencida
      FROM cotizaciones_cabecera c
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      JOIN clientes cl ON c.id_cliente = cl.id_cliente
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_cliente) {
      params.push(id_cliente);
      sql += ` AND c.id_cliente = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      sql += ` AND c.estado = $${params.length}`;
    }

    if (req.user?.rol !== 'ADMIN') {
      params.push(idSucursal);
      sql += ` AND c.id_sucursal = $${params.length}`;
    }

    params.push(Number(limit) || 50);
    sql += ` ORDER BY c.id_cotizacion DESC LIMIT $${params.length}`;

    params.push(Number(offset) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error en GET /api/cotizaciones]:', error.message);
    res.status(500).json({ error: 'Error al listar cotizaciones.' });
  }
});

// =====================================================================
// GET /api/cotizaciones/:id - Obtener cotización con detalle completo
// =====================================================================
cotizacionesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const cabSql = `
      SELECT 
        c.id_cotizacion,
        c.id_sucursal,
        s.nombre as sucursal_nombre,
        s.direccion as sucursal_direccion,
        s.telefono as sucursal_telefono,
        c.id_cliente,
        cl.razon_social as cliente_nombre,
        cl.nit_ci as cliente_nit,
        cl.telefono as cliente_telefono,
        c.id_usuario,
        u.nombre_completo as vendedor_nombre,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.total_bruto,
        c.descuento,
        c.total_neto,
        c.estado,
        c.id_venta_generada,
        c.observaciones,
        (c.fecha_vencimiento < CURRENT_TIMESTAMP AND c.estado = 'PENDIENTE') as esta_vencida
      FROM cotizaciones_cabecera c
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      JOIN clientes cl ON c.id_cliente = cl.id_cliente
      JOIN usuarios u ON c.id_usuario = u.id_usuario
      WHERE c.id_cotizacion = $1
    `;
    const cabRes = await query(cabSql, [id]);

    if (cabRes.rows.length === 0) {
      res.status(404).json({ error: 'Cotización no encontrada.' });
      return;
    }

    const cotizacion = cabRes.rows[0];

    const detSql = `
      SELECT 
        d.id_detalle,
        d.codigo_producto,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        d.cantidad,
        d.precio_unitario,
        d.subtotal
      FROM cotizaciones_detalle d
      JOIN productos p ON d.codigo_producto = p.codigo_producto
      WHERE d.id_cotizacion = $1
      ORDER BY d.id_detalle ASC
    `;
    const detRes = await query(detSql, [id]);

    res.status(200).json({
      ...cotizacion,
      items: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/cotizaciones/:id]:', error.message);
    res.status(500).json({ error: 'Error al consultar la cotización.' });
  }
});

// =====================================================================
// POST /api/cotizaciones/:id/convertir-a-venta - Convertir cotización a venta
// =====================================================================
cotizacionesRouter.post('/:id/convertir-a-venta', requireRole('ADMIN', 'VENTAS', 'VENTAS_POS', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { id_almacen = 1, tipo_pago = 'CONTADO' } = req.body;
  const idUsuario = req.user?.id_usuario || 1;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener y bloquear cotización
    const cotizRes = await client.query(
      `SELECT id_cotizacion, id_sucursal, id_cliente, total_bruto, descuento, total_neto, estado, fecha_vencimiento
       FROM cotizaciones_cabecera
       WHERE id_cotizacion = $1
       FOR UPDATE`,
      [id]
    );

    if (cotizRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Cotización no encontrada.' });
      return;
    }

    const cotizacion = cotizRes.rows[0];

    if (cotizacion.estado === 'CONVERTIDA') {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Esta cotización ya fue convertida previamente a Venta.' });
      return;
    }

    if (cotizacion.estado === 'RECHAZADA') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No se puede convertir una cotización que fue marcada como rechazada.' });
      return;
    }

    if (new Date() > new Date(cotizacion.fecha_vencimiento)) {
      await client.query('ROLLBACK');
      res.status(400).json({
        error: `La cotización venció el ${new Date(cotizacion.fecha_vencimiento).toLocaleDateString()}. Debe solicitar actualización de presupuesto.`
      });
      return;
    }

    // 2. Obtener los ítems de la cotización
    const detRes = await client.query(
      'SELECT codigo_producto, cantidad, precio_unitario, subtotal FROM cotizaciones_detalle WHERE id_cotizacion = $1',
      [id]
    );

    if (detRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'La cotización no contiene productos para procesar.' });
      return;
    }

    // 3. Crear Venta en ventas_cabecera
    const ventaSql = `
      INSERT INTO ventas_cabecera (
        id_sucursal, id_cliente, id_usuario, total_bruto, descuento, total_neto, tipo_pago, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'EMITIDA', $8)
      RETURNING id_venta, fecha_venta, total_neto, estado
    `;
    const vRes = await client.query(ventaSql, [
      cotizacion.id_sucursal,
      cotizacion.id_cliente,
      idUsuario,
      cotizacion.total_bruto,
      cotizacion.descuento,
      cotizacion.total_neto,
      tipo_pago,
      `Venta generada a partir de Cotización Nro ${id}`
    ]);
    const nuevaVenta = vRes.rows[0];
    const idVenta = nuevaVenta.id_venta;

    // 4. Insertar Detalles de Venta (El trigger trg_descontar_kardex_venta descuenta inventario automáticamente)
    for (const item of detRes.rows) {
      await client.query(
        `INSERT INTO ventas_detalle (id_venta, id_almacen, codigo_producto, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [idVenta, id_almacen, item.codigo_producto, item.cantidad, item.precio_unitario, item.subtotal]
      );
    }

    // 5. Actualizar Cotización a CONVERTIDA
    await client.query(
      "UPDATE cotizaciones_cabecera SET estado = 'CONVERTIDA', id_venta_generada = $1 WHERE id_cotizacion = $2",
      [idVenta, id]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Cotización convertida a Venta exitosamente.',
      id_cotizacion: Number(id),
      venta: {
        id_venta: Number(idVenta),
        total_neto: Number(nuevaVenta.total_neto),
        fecha_venta: nuevaVenta.fecha_venta,
        estado: nuevaVenta.estado
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en convertir cotización a venta]:', error.message);
    if (error.message && (error.message.includes('Stock insuficiente') || error.message.includes('No existen registros de inventario'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno al convertir la cotización a venta.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/cotizaciones/:id/rechazar - Rechazar cotización
// =====================================================================
cotizacionesRouter.post('/:id/rechazar', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const checkRes = await query('SELECT id_cotizacion, estado FROM cotizaciones_cabecera WHERE id_cotizacion = $1', [id]);
    if (checkRes.rows.length === 0) {
      res.status(404).json({ error: 'Cotización no encontrada.' });
      return;
    }

    if (checkRes.rows[0].estado === 'CONVERTIDA') {
      res.status(400).json({ error: 'No se puede rechazar una cotización que ya fue convertida a venta.' });
      return;
    }

    await query("UPDATE cotizaciones_cabecera SET estado = 'RECHAZADA' WHERE id_cotizacion = $1", [id]);

    res.status(200).json({
      message: 'Cotización marcada como rechazada.',
      id_cotizacion: Number(id),
      estado: 'RECHAZADA'
    });
  } catch (error: any) {
    console.error('[Error en rechazar cotización]:', error.message);
    res.status(500).json({ error: 'Error al rechazar cotización.' });
  }
});
