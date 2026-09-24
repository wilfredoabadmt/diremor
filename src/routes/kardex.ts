import { Router, Request, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

export const kardexRouter = Router();

// Todos los endpoints de kardex requieren autenticación JWT
kardexRouter.use(authenticateToken);

// =====================================================================
// 1. REGISTRO DE MOVIMIENTOS EN KARDEX (TRANSACCIÓN ACID)
// =====================================================================

// POST /api/kardex/movimientos
kardexRouter.post('/movimientos', requireRole('ADMIN', 'ALMACEN'), async (req: Request, res: Response) => {
  const {
    id_almacen,
    codigo_producto,
    tipo_movimiento,
    cantidad,
    costo_unitario,
    id_documento_ref = 0,
    numero_serie = null,
    numero_lote = null,
    fecha_vencimiento = null
  } = req.body;

  // 1. Validaciones básicas de entrada
  if (!id_almacen || !codigo_producto || !tipo_movimiento || cantidad === undefined) {
    res.status(400).json({ error: 'id_almacen, codigo_producto, tipo_movimiento y cantidad son obligatorios.' });
    return;
  }

  const cant = Number(cantidad);
  if (isNaN(cant) || cant <= 0) {
    res.status(400).json({ error: 'La cantidad debe ser un número positivo mayor a cero.' });
    return;
  }

  const tiposPermitidos = ['ENTRADA', 'SALIDA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'TRASPASO'];
  const tipoUpper = tipo_movimiento.trim().toUpperCase();
  if (!tiposPermitidos.includes(tipoUpper)) {
    res.status(400).json({ error: `Tipo de movimiento no válido. Permitidos: ${tiposPermitidos.join(', ')}` });
    return;
  }

  const esEntrada = tipoUpper.includes('ENTRADA') || tipoUpper === 'COMPRA';

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 2. Verificar existencia del almacén
    const almRes = await client.query('SELECT id_almacen, nombre, activo FROM almacenes WHERE id_almacen = $1', [id_almacen]);
    if (almRes.rows.length === 0 || !almRes.rows[0].activo) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Almacén no encontrado o inactivo.' });
      return;
    }

    // 3. Verificar existencia del producto y banderas de trazabilidad
    const prodRes = await client.query(
      'SELECT codigo_producto, descripcion, precio_costo, maneja_serie, maneja_lote, activo FROM productos WHERE codigo_producto = $1',
      [codigo_producto]
    );

    if (prodRes.rows.length === 0 || !prodRes.rows[0].activo) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Producto no encontrado o inactivo.' });
      return;
    }

    const prod = prodRes.rows[0];

    // Validación de trazabilidad (User Story 4)
    if (prod.maneja_serie && !numero_serie) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `El producto ${prod.codigo_producto} exige número de serie.` });
      return;
    }

    if (prod.maneja_lote && (!numero_lote || !fecha_vencimiento)) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `El producto ${prod.codigo_producto} exige número de lote y fecha de vencimiento.` });
      return;
    }

    // 4. Obtener último saldo registrado en el almacén
    const lastKardexSql = `
      SELECT saldo_cantidad, saldo_valorado, costo_unitario
      FROM kardex_movimientos
      WHERE id_almacen = $1 AND codigo_producto = $2
      ORDER BY id_kardex DESC
      LIMIT 1
    `;
    const lastRes = await client.query(lastKardexSql, [id_almacen, codigo_producto]);

    const saldoAnteriorCantidad = lastRes.rows.length > 0 ? Number(lastRes.rows[0].saldo_cantidad) : 0;
    const saldoAnteriorValorado = lastRes.rows.length > 0 ? Number(lastRes.rows[0].saldo_valorado) : 0;

    let cantidadEntrada = 0;
    let cantidadSalida = 0;
    let nuevoSaldoCantidad = 0;
    let costoUnitarioMovimiento = 0;
    let nuevoSaldoValorado = 0;

    if (esEntrada) {
      cantidadEntrada = cant;
      costoUnitarioMovimiento = costo_unitario !== undefined ? Number(costo_unitario) : Number(prod.precio_costo);
      nuevoSaldoCantidad = saldoAnteriorCantidad + cant;
      nuevoSaldoValorado = saldoAnteriorValorado + (cant * costoUnitarioMovimiento);
    } else {
      // Salida: validación estricta de stock
      if (saldoAnteriorCantidad < cant) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `Stock insuficiente en almacén. Disponible: ${saldoAnteriorCantidad}, Solicitado: ${cant}`
        });
        return;
      }

      cantidadSalida = cant;
      // En salida se utiliza el costo promedio ponderado vigente
      costoUnitarioMovimiento = saldoAnteriorCantidad > 0
        ? (saldoAnteriorValorado / saldoAnteriorCantidad)
        : Number(prod.precio_costo);

      nuevoSaldoCantidad = saldoAnteriorCantidad - cant;
      nuevoSaldoValorado = saldoAnteriorValorado - (cant * costoUnitarioMovimiento);
      if (nuevoSaldoCantidad === 0) nuevoSaldoValorado = 0;
    }

    // 5. Inserción del movimiento atómico
    const insertSql = `
      INSERT INTO kardex_movimientos (
        id_almacen,
        codigo_producto,
        tipo_movimiento,
        id_documento_ref,
        cantidad_entrada,
        cantidad_salida,
        saldo_cantidad,
        costo_unitario,
        saldo_valorado,
        numero_serie,
        numero_lote,
        fecha_vencimiento
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const insertValues = [
      id_almacen,
      codigo_producto,
      tipoUpper,
      Number(id_documento_ref),
      cantidadEntrada,
      cantidadSalida,
      nuevoSaldoCantidad,
      costoUnitarioMovimiento,
      nuevoSaldoValorado,
      numero_serie,
      numero_lote,
      fecha_vencimiento
    ];

    const result = await client.query(insertSql, insertValues);

    await client.query('COMMIT');

    res.status(201).json({
      mensaje: 'Movimiento de Kardex registrado exitosamente.',
      movimiento: result.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Error al registrar movimiento en Kardex.', detalle: error.message });
  } finally {
    client.release();
  }
});

// =====================================================================
// 2. HISTÓRICO Y TRAZABILIDAD DE MOVIMIENTOS
// =====================================================================

// GET /api/kardex/:codigo_producto
kardexRouter.get('/:codigo_producto', async (req: Request, res: Response) => {
  const { codigo_producto } = req.params;
  const { id_almacen, limit = '100', offset = '0' } = req.query;

  try {
    const conditions = ['km.codigo_producto = $1'];
    const values: any[] = [codigo_producto];
    let paramIndex = 2;

    if (id_almacen) {
      conditions.push(`km.id_almacen = $${paramIndex++}`);
      values.push(Number(id_almacen));
    }

    const sql = `
      SELECT 
        km.id_kardex,
        km.fecha_movimiento,
        km.tipo_movimiento,
        km.id_documento_ref,
        km.cantidad_entrada,
        km.cantidad_salida,
        km.saldo_cantidad,
        km.costo_unitario,
        km.saldo_valorado,
        km.numero_serie,
        km.numero_lote,
        km.fecha_vencimiento,
        a.id_almacen,
        a.nombre as almacen_nombre,
        s.nombre as sucursal_nombre
      FROM kardex_movimientos km
      JOIN almacenes a ON km.id_almacen = a.id_almacen
      JOIN sucursales s ON a.id_sucursal = s.id_sucursal
      WHERE ${conditions.join(' AND ')}
      ORDER BY km.id_kardex ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(Number(limit), Number(offset));
    const result = await query(sql, values);

    res.status(200).json({
      codigo_producto,
      total_movimientos: result.rows.length,
      movimientos: result.rows
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Error al consultar historial de Kardex.', detalle: error.message });
  }
});
