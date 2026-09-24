import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const ajustesRouter = Router();

// Todas las rutas de ajustes requieren autenticación JWT
ajustesRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de ajustes de inventario
 */
export async function initAjustesSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS ajustes_cabecera (
        id_ajuste BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_almacen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        tipo_ajuste VARCHAR(30) NOT NULL,
        motivo TEXT NOT NULL,
        fecha_ajuste TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ajustes_alm ON ajustes_cabecera(id_almacen);
    CREATE INDEX IF NOT EXISTS idx_ajustes_tipo ON ajustes_cabecera(tipo_ajuste);

    CREATE TABLE IF NOT EXISTS ajustes_detalle (
        id_ajuste_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_ajuste BIGINT NOT NULL REFERENCES ajustes_cabecera(id_ajuste) ON DELETE CASCADE,
        codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        tipo_movimiento VARCHAR(10) NOT NULL,
        cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
        costo_unitario NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
        subtotal NUMERIC(14,2) NOT NULL,
        numero_serie VARCHAR(50),
        numero_lote VARCHAR(50)
    );

    CREATE INDEX IF NOT EXISTS idx_ajustes_det_ajuste ON ajustes_detalle(id_ajuste);
    CREATE INDEX IF NOT EXISTS idx_ajustes_det_prod ON ajustes_detalle(codigo_producto);
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initAjustesSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initAjustesSchema().catch(console.error);

interface AjusteItemInput {
  codigo_producto: string;
  tipo_movimiento: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  costo_unitario?: number;
  numero_serie?: string;
  numero_lote?: string;
}

// =====================================================================
// POST /api/ajustes - Registrar ajuste físico (Sobrantes, Faltantes, Mermas)
// =====================================================================
ajustesRouter.post('/', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_sucursal,
      id_almacen,
      tipo_ajuste,
      motivo,
      items
    } = req.body;

    if (!id_sucursal || !id_almacen || !tipo_ajuste || !motivo) {
      return res.status(400).json({ error: 'id_sucursal, id_almacen, tipo_ajuste y motivo son obligatorios.' });
    }

    const tiposPermitidos = ['SOBRANTE', 'FALTANTE', 'MERMA', 'ROTURA', 'INVENTARIO_FISICO'];
    if (!tiposPermitidos.includes(tipo_ajuste.toUpperCase())) {
      return res.status(400).json({
        error: `tipo_ajuste no válido. Opciones permitidas: ${tiposPermitidos.join(', ')}`
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'El ajuste debe incluir al menos un producto en items.' });
    }

    await client.query('BEGIN');

    // 1. Insertar Cabecera de Ajuste
    const insCabecera = await client.query(
      `INSERT INTO ajustes_cabecera (
        id_sucursal, id_almacen, id_usuario, tipo_ajuste, motivo
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        id_sucursal,
        id_almacen,
        req.user?.id_usuario || 1,
        tipo_ajuste.toUpperCase(),
        motivo.trim()
      ]
    );

    const ajuste = insCabecera.rows[0];
    const idAjuste = ajuste.id_ajuste;

    const itemsProcesados: any[] = [];

    // 2. Procesar ítems y asentar en Kardex
    for (const item of items) {
      if (!item.codigo_producto || isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cantidad inválida para producto ${item.codigo_producto || 'desconocido'}.` });
      }

      const tipoMov = (item.tipo_movimiento || '').toUpperCase();
      if (!['ENTRADA', 'SALIDA'].includes(tipoMov)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `tipo_movimiento debe ser 'ENTRADA' o 'SALIDA' para ${item.codigo_producto}.` });
      }

      // Consultar último saldo en Kardex con bloqueo FOR UPDATE
      const kardexRes = await client.query(
        `SELECT saldo_cantidad, costo_unitario, saldo_valorado
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1
         FOR UPDATE`,
        [item.codigo_producto, id_almacen]
      );

      const ultimo = kardexRes.rows[0];
      const prevCant = ultimo ? parseFloat(ultimo.saldo_cantidad) : 0.00;
      const prevVal = ultimo ? parseFloat(ultimo.saldo_valorado) : 0.00;
      let costoUnitario = ultimo ? parseFloat(ultimo.costo_unitario) : 0.00;

      if (item.costo_unitario && Number(item.costo_unitario) > 0) {
        costoUnitario = parseFloat(item.costo_unitario);
      } else if (costoUnitario === 0) {
        const prodRes = await client.query(
          `SELECT precio_costo FROM productos WHERE codigo_producto = $1`,
          [item.codigo_producto]
        );
        if (prodRes.rows.length > 0) {
          costoUnitario = parseFloat(prodRes.rows[0].precio_costo);
        }
      }

      let nuevoCant = prevCant;
      let nuevoVal = prevVal;
      let nuevoCosto = costoUnitario;
      const subtotalItem = Number(item.cantidad) * costoUnitario;

      if (tipoMov === 'SALIDA') {
        if (prevCant < Number(item.cantidad)) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: `Stock insuficiente para ajuste de salida del producto ${item.codigo_producto}. Solicitado: ${item.cantidad}, Disponible: ${prevCant}`
          });
        }
        nuevoCant = prevCant - Number(item.cantidad);
        nuevoVal = nuevoCant * costoUnitario;

        await client.query(
          `INSERT INTO kardex_movimientos (
            id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
            cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
            saldo_valorado, numero_serie, numero_lote
          ) VALUES ($1, $2, 'AJUSTE_SALIDA', $3, 0.00, $4, $5, $6, $7, $8, $9)`,
          [
            id_almacen,
            item.codigo_producto,
            idAjuste,
            item.cantidad,
            nuevoCant,
            costoUnitario,
            nuevoVal,
            item.numero_serie || null,
            item.numero_lote || null
          ]
        );
      } else {
        // ENTRADA
        nuevoCant = prevCant + Number(item.cantidad);
        nuevoVal = prevVal + subtotalItem;
        nuevoCosto = nuevoCant > 0 ? nuevoVal / nuevoCant : costoUnitario;

        await client.query(
          `INSERT INTO kardex_movimientos (
            id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
            cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
            saldo_valorado, numero_serie, numero_lote
          ) VALUES ($1, $2, 'AJUSTE_ENTRADA', $3, $4, 0.00, $5, $6, $7, $8, $9)`,
          [
            id_almacen,
            item.codigo_producto,
            idAjuste,
            item.cantidad,
            nuevoCant,
            nuevoCosto,
            nuevoVal,
            item.numero_serie || null,
            item.numero_lote || null
          ]
        );
      }

      // Insertar en ajustes_detalle
      const insDet = await client.query(
        `INSERT INTO ajustes_detalle (
          id_ajuste, codigo_producto, tipo_movimiento, cantidad,
          costo_unitario, subtotal, numero_serie, numero_lote
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          idAjuste,
          item.codigo_producto,
          tipoMov,
          item.cantidad,
          costoUnitario,
          subtotalItem,
          item.numero_serie || null,
          item.numero_lote || null
        ]
      );

      itemsProcesados.push(insDet.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Ajuste de inventario registrado y Kardex actualizado exitosamente.',
      ajuste,
      detalles: itemsProcesados
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/ajustes]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar ajuste de inventario.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/ajustes - Listar ajustes de inventario
// =====================================================================
ajustesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tipo_ajuste, id_almacen, fecha_desde, fecha_hasta, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT a.*,
             alm.nombre AS almacen_nombre,
             s.nombre AS sucursal_nombre,
             u.nombre_completo AS usuario_nombre,
             (SELECT COUNT(*) FROM ajustes_detalle d WHERE d.id_ajuste = a.id_ajuste) AS total_items,
             (SELECT SUM(subtotal) FROM ajustes_detalle d WHERE d.id_ajuste = a.id_ajuste) AS valor_total_ajustado
      FROM ajustes_cabecera a
      JOIN almacenes alm ON a.id_almacen = alm.id_almacen
      JOIN sucursales s ON a.id_sucursal = s.id_sucursal
      JOIN usuarios u ON a.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tipo_ajuste) {
      params.push(tipo_ajuste.toString().toUpperCase());
      sql += ` AND a.tipo_ajuste = $${params.length}`;
    }

    if (id_almacen) {
      params.push(id_almacen);
      sql += ` AND a.id_almacen = $${params.length}`;
    }

    if (fecha_desde) {
      params.push(fecha_desde);
      sql += ` AND a.fecha_ajuste >= $${params.length}`;
    }

    if (fecha_hasta) {
      params.push(fecha_hasta);
      sql += ` AND a.fecha_ajuste <= $${params.length}`;
    }

    sql += ` ORDER BY a.id_ajuste DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      ajustes: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/ajustes]:', error);
    return res.status(500).json({ error: 'Error interno al consultar ajustes.' });
  }
});

// =====================================================================
// GET /api/ajustes/:id - Detalle completo de ajuste
// =====================================================================
ajustesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT a.*,
              alm.nombre AS almacen_nombre,
              s.nombre AS sucursal_nombre,
              u.nombre_completo AS usuario_nombre
       FROM ajustes_cabecera a
       JOIN almacenes alm ON a.id_almacen = alm.id_almacen
       JOIN sucursales s ON a.id_sucursal = s.id_sucursal
       JOIN usuarios u ON a.id_usuario = u.id_usuario
       WHERE a.id_ajuste = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Ajuste de inventario no encontrado.' });
    }

    const detRes = await query(
      `SELECT d.*, p.descripcion AS producto_descripcion, p.unidad_medida
       FROM ajustes_detalle d
       JOIN productos p ON d.codigo_producto = p.codigo_producto
       WHERE d.id_ajuste = $1
       ORDER BY d.id_ajuste_detalle ASC`,
      [id]
    );

    return res.status(200).json({
      ajuste: cabRes.rows[0],
      detalles: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/ajustes/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de ajuste.' });
  }
});
