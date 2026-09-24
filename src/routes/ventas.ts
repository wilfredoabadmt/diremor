import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const ventasRouter = Router();

// Todas las rutas de ventas requieren autenticación
ventasRouter.use(authenticateToken);

interface VentaItemInput {
  codigo_producto: string;
  id_almacen?: number;
  cantidad: number;
  precio_unitario?: number;
  numero_serie?: string;
  numero_lote?: string;
}

// =====================================================================
// POST /api/ventas - Registrar nueva venta con transacción ACID y Kardex
// =====================================================================
ventasRouter.post('/', requireRole('ADMIN', 'VENTAS', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const {
    id_cliente,
    id_almacen_default,
    tipo_pago = 'CONTADO',
    descuento = 0,
    observaciones = '',
    items
  } = req.body;

  if (!id_cliente) {
    res.status(400).json({ error: 'Debe especificar el id_cliente (use 1 para cliente mostrador).' });
    return;
  }

  const tiposPermitidos = ['CONTADO', 'CREDITO', 'QR'];
  if (!tiposPermitidos.includes(tipo_pago)) {
    res.status(400).json({ error: `tipo_pago no válido. Permitidos: ${tiposPermitidos.join(', ')}` });
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Debe incluir al menos un producto en items.' });
    return;
  }

  const idSucursal = req.user?.id_sucursal || 1;
  const idUsuario = req.user?.id_usuario || 1;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar Cliente
    const cliRes = await client.query(
      'SELECT id_cliente, razon_social, limite_credito, bloqueo_mora, estado FROM clientes WHERE id_cliente = $1',
      [id_cliente]
    );

    if (cliRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Cliente no encontrado.' });
      return;
    }

    const cliente = cliRes.rows[0];
    if (cliente.estado !== 'ACTIVO') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: `El cliente ${cliente.razon_social} se encuentra ${cliente.estado}.` });
      return;
    }

    // 2. Pre-calcular totales brutos y validar ítems
    let totalBruto = 0;
    const itemsValidados: Array<{
      codigo_producto: string;
      id_almacen: number;
      cantidad: number;
      precio_unitario: number;
      subtotal: number;
      precio_costo: number;
      numero_serie?: string;
      numero_lote?: string;
    }> = [];

    for (const item of items as VentaItemInput[]) {
      const cant = Number(item.cantidad);
      if (isNaN(cant) || cant <= 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Cantidad no válida para producto ${item.codigo_producto}. Debe ser mayor a 0.` });
        return;
      }

      const idAlmacenItem = item.id_almacen || id_almacen_default;
      if (!idAlmacenItem) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Debe especificar un almacén para el ítem ${item.codigo_producto} o un id_almacen_default.` });
        return;
      }

      // Validar producto
      const prodRes = await client.query(
        'SELECT codigo_producto, descripcion, precio_costo, precio_venta_base, maneja_serie, maneja_lote, activo FROM productos WHERE codigo_producto = $1',
        [item.codigo_producto]
      );

      if (prodRes.rows.length === 0 || !prodRes.rows[0].activo) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: `Producto ${item.codigo_producto} no encontrado o inactivo.` });
        return;
      }

      const prod = prodRes.rows[0];

      // Exigir número de serie si aplica
      if (prod.maneja_serie && (!item.numero_serie || !item.numero_serie.trim())) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `El producto ${prod.codigo_producto} exige número de serie.` });
        return;
      }

      // Determinar precio de venta unitario
      const precioUnit = item.precio_unitario !== undefined ? Number(item.precio_unitario) : Number(prod.precio_venta_base);
      if (isNaN(precioUnit) || precioUnit < 0) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Precio unitario inválido para producto ${prod.codigo_producto}.` });
        return;
      }

      const subtotal = Math.round(cant * precioUnit * 100) / 100;
      totalBruto += subtotal;

      // Verificar stock disponible en almacén con bloqueo pesimista
      const lastKardex = await client.query(
        'SELECT saldo_cantidad, saldo_valorado, costo_unitario FROM kardex_movimientos WHERE id_almacen = $1 AND codigo_producto = $2 ORDER BY id_kardex DESC LIMIT 1 FOR UPDATE',
        [idAlmacenItem, prod.codigo_producto]
      );

      const saldoActual = lastKardex.rows.length > 0 ? Number(lastKardex.rows[0].saldo_cantidad) : 0;
      if (saldoActual < cant) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `Stock insuficiente en almacén para ${prod.codigo_producto}. Disponible: ${saldoActual}, Solicitado: ${cant}`
        });
        return;
      }

      itemsValidados.push({
        codigo_producto: prod.codigo_producto,
        id_almacen: idAlmacenItem,
        cantidad: cant,
        precio_unitario: precioUnit,
        subtotal,
        precio_costo: Number(prod.precio_costo),
        numero_serie: item.numero_serie?.trim(),
        numero_lote: item.numero_lote?.trim()
      });
    }

    const descNum = Number(descuento) || 0;
    const totalNeto = Math.round((totalBruto - descNum) * 100) / 100;

    if (totalNeto < 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El descuento no puede superar el total bruto de la venta.' });
      return;
    }

    // 3. Validación Crediticia si tipo_pago === 'CREDITO'
    if (tipo_pago === 'CREDITO') {
      if (cliente.bloqueo_mora) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: `Venta a crédito rechazada: El cliente ${cliente.razon_social} tiene bloqueo por mora activo.` });
        return;
      }

      const limiteCredito = Number(cliente.limite_credito);
      const deudaRes = await client.query(
        "SELECT COALESCE(SUM(total_neto), 0) as deuda_actual FROM ventas_cabecera WHERE id_cliente = $1 AND tipo_pago = 'CREDITO' AND estado = 'EMITIDA'",
        [cliente.id_cliente]
      );
      const deudaActual = Number(deudaRes.rows[0]?.deuda_actual || 0);
      const saldoDisponible = limiteCredito - deudaActual;

      if (totalNeto > saldoDisponible) {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: `Venta a crédito rechazada: Monto (${totalNeto} Bs) excede el crédito disponible (${saldoDisponible} Bs). Límite total: ${limiteCredito} Bs, Deuda: ${deudaActual} Bs.`
        });
        return;
      }
    }

    // 4. Insertar Cabecera de Venta
    const insertVentaSql = `
      INSERT INTO ventas_cabecera (
        id_sucursal, id_cliente, id_usuario, total_bruto, descuento, total_neto, tipo_pago, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'EMITIDA', $8)
      RETURNING id_venta, fecha_venta, total_bruto, descuento, total_neto, tipo_pago, estado
    `;
    const ventaResult = await client.query(insertVentaSql, [
      idSucursal,
      id_cliente,
      idUsuario,
      totalBruto,
      descNum,
      totalNeto,
      tipo_pago,
      observaciones
    ]);
    const nuevaVenta = ventaResult.rows[0];
    const idVenta = nuevaVenta.id_venta;

    // 5. Insertar Detalles de Venta (El trigger PostgreSQL trg_descontar_kardex_venta actualiza Kardex atómicamente)
    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO ventas_detalle (
          id_venta, id_almacen, codigo_producto, cantidad, precio_unitario, subtotal, numero_serie, numero_lote
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          idVenta,
          item.id_almacen,
          item.codigo_producto,
          item.cantidad,
          item.precio_unitario,
          item.subtotal,
          item.numero_serie || null,
          item.numero_lote || null
        ]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Venta registrada exitosamente.',
      venta: {
        id_venta: nuevaVenta.id_venta,
        id_sucursal: idSucursal,
        id_cliente,
        cliente_nombre: cliente.razon_social,
        total_bruto: Number(nuevaVenta.total_bruto),
        descuento: Number(nuevaVenta.descuento),
        total_neto: Number(nuevaVenta.total_neto),
        tipo_pago: nuevaVenta.tipo_pago,
        estado: nuevaVenta.estado,
        fecha_venta: nuevaVenta.fecha_venta,
        items_count: itemsValidados.length
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/ventas]:', error.message);
    if (error.message && (error.message.includes('Stock insuficiente') || error.message.includes('No existen registros de inventario'))) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Error interno al procesar la venta.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/ventas - Listar ventas con filtros
// =====================================================================
ventasRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { id_cliente, tipo_pago, estado, limit = 50, offset = 0 } = req.query;

  try {
    let sql = `
      SELECT 
        v.id_venta,
        v.id_sucursal,
        s.nombre as sucursal_nombre,
        v.id_cliente,
        c.razon_social as cliente_nombre,
        c.nit_ci as cliente_nit,
        v.id_usuario,
        u.nombre_completo as vendedor_nombre,
        v.fecha_venta,
        v.total_bruto,
        v.descuento,
        v.total_neto,
        v.tipo_pago,
        v.estado,
        v.observaciones
      FROM ventas_cabecera v
      JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      JOIN clientes c ON v.id_cliente = c.id_cliente
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_cliente) {
      params.push(id_cliente);
      sql += ` AND v.id_cliente = $${params.length}`;
    }

    if (tipo_pago) {
      params.push(tipo_pago);
      sql += ` AND v.tipo_pago = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      sql += ` AND v.estado = $${params.length}`;
    }

    params.push(Number(limit) || 50);
    sql += ` ORDER BY v.id_venta DESC LIMIT $${params.length}`;

    params.push(Number(offset) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error en GET /api/ventas]:', error.message);
    res.status(500).json({ error: 'Error interno al consultar ventas.' });
  }
});

// =====================================================================
// GET /api/ventas/:id - Obtener venta completa con detalle
// =====================================================================
ventasRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const cabSql = `
      SELECT 
        v.id_venta,
        v.id_sucursal,
        s.nombre as sucursal_nombre,
        v.id_cliente,
        c.razon_social as cliente_nombre,
        c.nit_ci as cliente_nit,
        c.direccion as cliente_direccion,
        v.id_usuario,
        u.nombre_completo as vendedor_nombre,
        v.fecha_venta,
        v.total_bruto,
        v.descuento,
        v.total_neto,
        v.tipo_pago,
        v.estado,
        v.observaciones
      FROM ventas_cabecera v
      JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      JOIN clientes c ON v.id_cliente = c.id_cliente
      JOIN usuarios u ON v.id_usuario = u.id_usuario
      WHERE v.id_venta = $1
    `;
    const cabRes = await query(cabSql, [id]);

    if (cabRes.rows.length === 0) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }

    const venta = cabRes.rows[0];

    const detSql = `
      SELECT 
        d.id_detalle,
        d.id_almacen,
        a.nombre as almacen_nombre,
        d.codigo_producto,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        d.cantidad,
        d.precio_unitario,
        d.subtotal,
        d.numero_serie,
        d.numero_lote
      FROM ventas_detalle d
      JOIN almacenes a ON d.id_almacen = a.id_almacen
      JOIN productos p ON d.codigo_producto = p.codigo_producto
      WHERE d.id_venta = $1
      ORDER BY d.id_detalle ASC
    `;
    const detRes = await query(detSql, [id]);

    res.status(200).json({
      ...venta,
      items: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/ventas/:id]:', error.message);
    res.status(500).json({ error: 'Error interno al consultar la venta.' });
  }
});

// =====================================================================
// POST /api/ventas/:id/anular - Anular venta y reponer inventario en Kardex
// =====================================================================
ventasRouter.post('/:id/anular', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener cabecera de la venta
    const ventaRes = await client.query(
      'SELECT id_venta, estado FROM ventas_cabecera WHERE id_venta = $1 FOR UPDATE',
      [id]
    );

    if (ventaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }

    const venta = ventaRes.rows[0];

    if (venta.estado === 'ANULADA') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'La venta ya se encuentra anulada.' });
      return;
    }

    // 2. Obtener los ítems vendidos para reingresarlos al Kardex
    const detRes = await client.query(
      'SELECT id_almacen, codigo_producto, cantidad, numero_serie, numero_lote FROM ventas_detalle WHERE id_venta = $1',
      [id]
    );

    for (const item of detRes.rows) {
      const cant = Number(item.cantidad);

      // Obtener costo y saldo actual
      const kardexLock = await client.query(
        'SELECT saldo_cantidad, saldo_valorado, costo_unitario FROM kardex_movimientos WHERE id_almacen = $1 AND codigo_producto = $2 ORDER BY id_kardex DESC LIMIT 1 FOR UPDATE',
        [item.id_almacen, item.codigo_producto]
      );

      const saldoAnteriorCantidad = kardexLock.rows.length > 0 ? Number(kardexLock.rows[0].saldo_cantidad) : 0;
      const saldoAnteriorValorado = kardexLock.rows.length > 0 ? Number(kardexLock.rows[0].saldo_valorado) : 0;
      const costoUnitarioKardex = kardexLock.rows.length > 0 ? Number(kardexLock.rows[0].costo_unitario) : 0;

      const nuevoSaldoCantidad = saldoAnteriorCantidad + cant;
      const nuevoSaldoValorado = saldoAnteriorValorado + (cant * costoUnitarioKardex);

      // Registrar reingreso por anulación de venta
      await client.query(
        `INSERT INTO kardex_movimientos (
          id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
          cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario, saldo_valorado,
          numero_serie, numero_lote
        ) VALUES ($1, $2, 'AJUSTE_ENTRADA', $3, $4, 0.00, $5, $6, $7, $8, $9)`,
        [
          item.id_almacen,
          item.codigo_producto,
          id,
          cant,
          nuevoSaldoCantidad,
          costoUnitarioKardex,
          nuevoSaldoValorado,
          item.numero_serie || null,
          item.numero_lote || null
        ]
      );
    }

    // 3. Marcar venta como ANULADA
    await client.query("UPDATE ventas_cabecera SET estado = 'ANULADA' WHERE id_venta = $1", [id]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Venta anulada exitosamente y stock restituido en Kardex.',
      id_venta: Number(id),
      estado: 'ANULADA',
      items_revertidos: detRes.rows.length
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/ventas/:id/anular]:', error.message);
    res.status(500).json({ error: 'Error interno al anular la venta.' });
  } finally {
    client.release();
  }
});
