import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const traspasosRouter = Router();

// Todas las rutas de traspasos requieren autenticación JWT
traspasosRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de traspasos
 */
export async function initTraspasosSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS traspasos_cabecera (
        id_traspaso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_sucursal_origen INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_almacen_origen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        id_sucursal_destino INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_almacen_destino INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        id_usuario_envio BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        id_usuario_recepcion BIGINT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        estado VARCHAR(20) NOT NULL DEFAULT 'EN_TRANSITO',
        fecha_envio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_recepcion TIMESTAMPTZ,
        motivo TEXT,
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_traspasos_almacen_distinto CHECK (id_almacen_origen <> id_almacen_destino)
    );

    CREATE INDEX IF NOT EXISTS idx_traspaso_alm_orig ON traspasos_cabecera(id_almacen_origen);
    CREATE INDEX IF NOT EXISTS idx_traspaso_alm_dest ON traspasos_cabecera(id_almacen_destino);
    CREATE INDEX IF NOT EXISTS idx_traspaso_estado ON traspasos_cabecera(estado);

    CREATE TABLE IF NOT EXISTS traspasos_detalle (
        id_traspaso_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_traspaso BIGINT NOT NULL REFERENCES traspasos_cabecera(id_traspaso) ON DELETE CASCADE,
        codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
        costo_unitario NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
        numero_serie VARCHAR(50),
        numero_lote VARCHAR(50)
    );

    CREATE INDEX IF NOT EXISTS idx_traspaso_det_traspaso ON traspasos_detalle(id_traspaso);
    CREATE INDEX IF NOT EXISTS idx_traspaso_det_prod ON traspasos_detalle(codigo_producto);
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initTraspasosSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initTraspasosSchema().catch(console.error);

interface TraspasoItemInput {
  codigo_producto: string;
  cantidad: number;
  numero_serie?: string;
  numero_lote?: string;
}

// =====================================================================
// POST /api/traspasos - Registrar y despachar nuevo traspaso (EN_TRANSITO)
// =====================================================================
traspasosRouter.post('/', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_sucursal_origen,
      id_almacen_origen,
      id_sucursal_destino,
      id_almacen_destino,
      motivo,
      observaciones,
      items
    } = req.body;

    if (!id_sucursal_origen || !id_almacen_origen || !id_sucursal_destino || !id_almacen_destino) {
      return res.status(400).json({ error: 'Sucursales y almacenes de origen y destino son obligatorios.' });
    }

    if (id_almacen_origen === id_almacen_destino) {
      return res.status(400).json({ error: 'El almacén de origen y destino no pueden ser el mismo.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El traspaso debe contener al menos un ítem.' });
    }

    await client.query('BEGIN');

    // Validar existencias de cada producto en el almacén de origen
    const itemsValidados: Array<TraspasoItemInput & { costo_unitario: number }> = [];

    for (const item of items) {
      if (!item.codigo_producto || isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cantidad inválida para el producto ${item.codigo_producto || 'desconocido'}.` });
      }

      // Bloqueo y verificación de stock en el almacén de origen
      const kardexRes = await client.query(
        `SELECT saldo_cantidad, costo_unitario, saldo_valorado
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1
         FOR UPDATE`,
        [item.codigo_producto, id_almacen_origen]
      );

      const ultimoMov = kardexRes.rows[0];
      const stockDisponible = ultimoMov ? parseFloat(ultimoMov.saldo_cantidad) : 0;
      const costoUnitario = ultimoMov ? parseFloat(ultimoMov.costo_unitario) : 0;

      if (stockDisponible < Number(item.cantidad)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente en almacén de origen para el producto ${item.codigo_producto}. Solicitado: ${item.cantidad}, Disponible: ${stockDisponible}`
        });
      }

      itemsValidados.push({
        ...item,
        costo_unitario: costoUnitario
      });
    }

    // 1. Insertar Cabecera de Traspaso (Estado: EN_TRANSITO)
    const insCabecera = await client.query(
      `INSERT INTO traspasos_cabecera (
        id_sucursal_origen, id_almacen_origen, id_sucursal_destino, id_almacen_destino,
        id_usuario_envio, estado, motivo, observaciones
      ) VALUES ($1, $2, $3, $4, $5, 'EN_TRANSITO', $6, $7)
      RETURNING *`,
      [
        id_sucursal_origen,
        id_almacen_origen,
        id_sucursal_destino,
        id_almacen_destino,
        req.user?.id_usuario || 1,
        motivo?.trim() || 'Traspaso de mercadería entre bodegas',
        observaciones?.trim() || null
      ]
    );

    const traspaso = insCabecera.rows[0];
    const idTraspaso = traspaso.id_traspaso;

    // 2. Insertar Detalle y asentar Salida atómica en Kardex Origen
    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO traspasos_detalle (
          id_traspaso, codigo_producto, cantidad, costo_unitario, numero_serie, numero_lote
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          idTraspaso,
          item.codigo_producto,
          item.cantidad,
          item.costo_unitario,
          item.numero_serie || null,
          item.numero_lote || null
        ]
      );

      // Consultar último saldo nuevamente por consistencia
      const ultRes = await client.query(
        `SELECT saldo_cantidad, saldo_valorado, costo_unitario
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1`,
        [item.codigo_producto, id_almacen_origen]
      );

      const ult = ultRes.rows[0];
      const prevCant = parseFloat(ult.saldo_cantidad);
      const prevVal = parseFloat(ult.saldo_valorado);
      const prevCosto = parseFloat(ult.costo_unitario);

      const nuevoCant = prevCant - Number(item.cantidad);
      const nuevoVal = nuevoCant * prevCosto;

      // Registrar salida en kardex del almacén origen
      await client.query(
        `INSERT INTO kardex_movimientos (
          id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
          cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
          saldo_valorado, numero_serie, numero_lote
        ) VALUES ($1, $2, 'TRASPASO_SALIDA', $3, 0.00, $4, $5, $6, $7, $8, $9)`,
        [
          id_almacen_origen,
          item.codigo_producto,
          idTraspaso,
          item.cantidad,
          nuevoCant,
          prevCosto,
          nuevoVal,
          item.numero_serie || null,
          item.numero_lote || null
        ]
      );
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Traspaso despachado exitosamente y mercadería puesta en tránsito.',
      traspaso,
      items_despachados: itemsValidados.length
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/traspasos]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al despachar traspaso.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/traspasos/:id/recibir - Confirmar recepción física en destino
// =====================================================================
traspasosRouter.post('/:id/recibir', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const cabRes = await client.query(
      `SELECT * FROM traspasos_cabecera WHERE id_traspaso = $1 FOR UPDATE`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Traspaso no encontrado.' });
    }

    const traspaso = cabRes.rows[0];

    if (traspaso.estado !== 'EN_TRANSITO') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `El traspaso ya no se encuentra en tránsito (Estado actual: ${traspaso.estado}).`
      });
    }

    const detRes = await client.query(
      `SELECT * FROM traspasos_detalle WHERE id_traspaso = $1`,
      [id]
    );

    // Ingresar mercadería al almacén de destino en Kardex
    for (const item of detRes.rows) {
      const kardexRes = await client.query(
        `SELECT saldo_cantidad, saldo_valorado
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1
         FOR UPDATE`,
        [item.codigo_producto, traspaso.id_almacen_destino]
      );

      const ultimo = kardexRes.rows[0];
      const prevCant = ultimo ? parseFloat(ultimo.saldo_cantidad) : 0.00;
      const prevVal = ultimo ? parseFloat(ultimo.saldo_valorado) : 0.00;

      const cantidadEntrada = parseFloat(item.cantidad);
      const costoUnitarioTraspaso = parseFloat(item.costo_unitario);

      const nuevoCant = prevCant + cantidadEntrada;
      const nuevoVal = prevVal + (cantidadEntrada * costoUnitarioTraspaso);
      const nuevoCosto = nuevoCant > 0 ? nuevoVal / nuevoCant : costoUnitarioTraspaso;

      await client.query(
        `INSERT INTO kardex_movimientos (
          id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
          cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
          saldo_valorado, numero_serie, numero_lote
        ) VALUES ($1, $2, 'TRASPASO_ENTRADA', $3, $4, 0.00, $5, $6, $7, $8, $9)`,
        [
          traspaso.id_almacen_destino,
          item.codigo_producto,
          id,
          cantidadEntrada,
          nuevoCant,
          nuevoCosto,
          nuevoVal,
          item.numero_serie,
          item.numero_lote
        ]
      );
    }

    // Actualizar estado de traspaso a RECIBIDO
    const updRes = await client.query(
      `UPDATE traspasos_cabecera
       SET estado = 'RECIBIDO',
           fecha_recepcion = CURRENT_TIMESTAMP,
           id_usuario_recepcion = $1
       WHERE id_traspaso = $2
       RETURNING *`,
      [req.user?.id_usuario || 1, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Traspaso recibido físicamente e ingresado a Kardex de destino exitosamente.',
      traspaso: updRes.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/traspasos/:id/recibir]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al recibir traspaso.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/traspasos/:id/rechazar - Rechazar traspaso y devolver a origen
// =====================================================================
traspasosRouter.post('/:id/rechazar', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { motivo_rechazo } = req.body;

    await client.query('BEGIN');

    const cabRes = await client.query(
      `SELECT * FROM traspasos_cabecera WHERE id_traspaso = $1 FOR UPDATE`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Traspaso no encontrado.' });
    }

    const traspaso = cabRes.rows[0];

    if (traspaso.estado !== 'EN_TRANSITO') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Solo se pueden rechazar traspasos en estado EN_TRANSITO (Estado actual: ${traspaso.estado}).`
      });
    }

    const detRes = await client.query(
      `SELECT * FROM traspasos_detalle WHERE id_traspaso = $1`,
      [id]
    );

    // Revertir mercadería al almacén de origen
    for (const item of detRes.rows) {
      const kardexRes = await client.query(
        `SELECT saldo_cantidad, saldo_valorado, costo_unitario
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1
         FOR UPDATE`,
        [item.codigo_producto, traspaso.id_almacen_origen]
      );

      const ultimo = kardexRes.rows[0];
      const prevCant = ultimo ? parseFloat(ultimo.saldo_cantidad) : 0.00;
      const prevVal = ultimo ? parseFloat(ultimo.saldo_valorado) : 0.00;
      const costoReversion = parseFloat(item.costo_unitario);

      const nuevoCant = prevCant + parseFloat(item.cantidad);
      const nuevoVal = prevVal + (parseFloat(item.cantidad) * costoReversion);
      const nuevoCosto = nuevoCant > 0 ? nuevoVal / nuevoCant : costoReversion;

      await client.query(
        `INSERT INTO kardex_movimientos (
          id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
          cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
          saldo_valorado, numero_serie, numero_lote
        ) VALUES ($1, $2, 'TRASPASO_REVERSION', $3, $4, 0.00, $5, $6, $7, $8, $9)`,
        [
          traspaso.id_almacen_origen,
          item.codigo_producto,
          id,
          item.cantidad,
          nuevoCant,
          nuevoCosto,
          nuevoVal,
          item.numero_serie,
          item.numero_lote
        ]
      );
    }

    const updRes = await client.query(
      `UPDATE traspasos_cabecera
       SET estado = 'RECHAZADO',
           observaciones = COALESCE(observaciones || ' | ', '') || 'RECHAZADO: ' || $1
       WHERE id_traspaso = $2
       RETURNING *`,
      [motivo_rechazo?.trim() || 'Rechazado por discrepancias físicas', id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Traspaso rechazado y mercadería devuelta al inventario de origen.',
      traspaso: updRes.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/traspasos/:id/rechazar]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al rechazar traspaso.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/traspasos - Listar traspasos con filtros
// =====================================================================
traspasosRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { estado, id_almacen_origen, id_almacen_destino, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT t.*,
             ao.nombre AS almacen_origen_nombre,
             so.nombre AS sucursal_origen_nombre,
             ad.nombre AS almacen_destino_nombre,
             sd.nombre AS sucursal_destino_nombre,
             ue.nombre_completo AS usuario_envio_nombre,
             ur.nombre_completo AS usuario_recepcion_nombre,
             (SELECT COUNT(*) FROM traspasos_detalle d WHERE d.id_traspaso = t.id_traspaso) AS total_items
      FROM traspasos_cabecera t
      JOIN almacenes ao ON t.id_almacen_origen = ao.id_almacen
      JOIN sucursales so ON t.id_sucursal_origen = so.id_sucursal
      JOIN almacenes ad ON t.id_almacen_destino = ad.id_almacen
      JOIN sucursales sd ON t.id_sucursal_destino = sd.id_sucursal
      JOIN usuarios ue ON t.id_usuario_envio = ue.id_usuario
      LEFT JOIN usuarios ur ON t.id_usuario_recepcion = ur.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (estado) {
      params.push(estado.toString().toUpperCase());
      sql += ` AND t.estado = $${params.length}`;
    }

    if (id_almacen_origen) {
      params.push(id_almacen_origen);
      sql += ` AND t.id_almacen_origen = $${params.length}`;
    }

    if (id_almacen_destino) {
      params.push(id_almacen_destino);
      sql += ` AND t.id_almacen_destino = $${params.length}`;
    }

    sql += ` ORDER BY t.id_traspaso DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      traspasos: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/traspasos]:', error);
    return res.status(500).json({ error: 'Error interno al listar traspasos.' });
  }
});

// =====================================================================
// GET /api/traspasos/:id - Detalle completo de traspaso
// =====================================================================
traspasosRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT t.*,
              ao.nombre AS almacen_origen_nombre,
              ad.nombre AS almacen_destino_nombre,
              ue.nombre_completo AS usuario_envio_nombre,
              ur.nombre_completo AS usuario_recepcion_nombre
       FROM traspasos_cabecera t
       JOIN almacenes ao ON t.id_almacen_origen = ao.id_almacen
       JOIN almacenes ad ON t.id_almacen_destino = ad.id_almacen
       JOIN usuarios ue ON t.id_usuario_envio = ue.id_usuario
       LEFT JOIN usuarios ur ON t.id_usuario_recepcion = ur.id_usuario
       WHERE t.id_traspaso = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Traspaso no encontrado.' });
    }

    const detRes = await query(
      `SELECT d.*, p.descripcion AS producto_descripcion, p.unidad_medida
       FROM traspasos_detalle d
       JOIN productos p ON d.codigo_producto = p.codigo_producto
       WHERE d.id_traspaso = $1
       ORDER BY d.id_traspaso_detalle ASC`,
      [id]
    );

    return res.status(200).json({
      traspaso: cabRes.rows[0],
      detalles: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/traspasos/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de traspaso.' });
  }
});
