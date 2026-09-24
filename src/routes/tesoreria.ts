import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const tesoreriaRouter = Router();

// Todas las rutas de tesorería requieren autenticación JWT
tesoreriaRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de tesorería (CxC y CxP)
 */
export async function initTesoreriaSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS cxc_cuentas (
        id_cxc BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_venta BIGINT REFERENCES ventas_cabecera(id_venta) ON DELETE SET NULL,
        id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        numero_documento_ref VARCHAR(50),
        monto_total NUMERIC(14,2) NOT NULL CHECK (monto_total > 0),
        monto_amortizado NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (monto_amortizado >= 0),
        monto_saldo NUMERIC(14,2) NOT NULL CHECK (monto_saldo >= 0),
        fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_vencimiento DATE NOT NULL,
        dias_credito INT NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cxc_cliente ON cxc_cuentas(id_cliente);
    CREATE INDEX IF NOT EXISTS idx_cxc_estado ON cxc_cuentas(estado);
    CREATE INDEX IF NOT EXISTS idx_cxc_vencimiento ON cxc_cuentas(fecha_vencimiento);

    CREATE TABLE IF NOT EXISTS cxc_cobros (
        id_cobro BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_cxc BIGINT NOT NULL REFERENCES cxc_cuentas(id_cxc) ON DELETE CASCADE,
        numero_recibo VARCHAR(50) NOT NULL UNIQUE,
        fecha_cobro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        monto_cobrado NUMERIC(14,2) NOT NULL CHECK (monto_cobrado > 0),
        forma_pago VARCHAR(25) NOT NULL DEFAULT 'EFECTIVO',
        numero_referencia VARCHAR(50),
        observaciones TEXT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cxc_cobros_cxc ON cxc_cobros(id_cxc);
    CREATE INDEX IF NOT EXISTS idx_cxc_cobros_recibo ON cxc_cobros(numero_recibo);

    CREATE TABLE IF NOT EXISTS cxp_cuentas (
        id_cxp BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_compra BIGINT REFERENCES compras_cabecera(id_compra) ON DELETE SET NULL,
        id_proveedor BIGINT NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        numero_documento_ref VARCHAR(50),
        monto_total NUMERIC(14,2) NOT NULL CHECK (monto_total > 0),
        monto_amortizado NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (monto_amortizado >= 0),
        monto_saldo NUMERIC(14,2) NOT NULL CHECK (monto_saldo >= 0),
        fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_vencimiento DATE NOT NULL,
        dias_credito INT NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cxp_prov ON cxp_cuentas(id_proveedor);
    CREATE INDEX IF NOT EXISTS idx_cxp_estado ON cxp_cuentas(estado);
    CREATE INDEX IF NOT EXISTS idx_cxp_vencimiento ON cxp_cuentas(fecha_vencimiento);

    CREATE TABLE IF NOT EXISTS cxp_pagos (
        id_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_cxp BIGINT NOT NULL REFERENCES cxp_cuentas(id_cxp) ON DELETE CASCADE,
        numero_comprobante VARCHAR(50) NOT NULL UNIQUE,
        fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        monto_pagado NUMERIC(14,2) NOT NULL CHECK (monto_pagado > 0),
        forma_pago VARCHAR(25) NOT NULL DEFAULT 'TRANSFERENCIA',
        numero_referencia VARCHAR(50),
        observaciones TEXT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_cxp_pagos_cxp ON cxp_pagos(id_cxp);
    CREATE INDEX IF NOT EXISTS idx_cxp_pagos_comp ON cxp_pagos(numero_comprobante);
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initTesoreriaSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initTesoreriaSchema().catch(console.error);

// =====================================================================
// POST /api/tesoreria/cxc - Registrar Cuenta por Cobrar
// =====================================================================
tesoreriaRouter.post('/cxc', requireRole('ADMIN', 'SUPERVISOR', 'VENTAS', 'VENTAS_POS'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      id_cliente,
      id_sucursal,
      monto_total,
      dias_credito = 30,
      fecha_vencimiento,
      id_venta,
      numero_documento_ref,
      observaciones
    } = req.body;

    if (!id_cliente || !id_sucursal || !monto_total) {
      return res.status(400).json({ error: 'id_cliente, id_sucursal y monto_total son obligatorios.' });
    }

    const montoNum = parseFloat(monto_total);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto_total debe ser mayor a cero.' });
    }

    // Calcular fecha de vencimiento si no se envía explícitamente
    const dias = parseInt(dias_credito, 10) || 30;
    let fechaVenc = fecha_vencimiento;
    if (!fechaVenc) {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      fechaVenc = d.toISOString().slice(0, 10);
    }

    const result = await query(
      `INSERT INTO cxc_cuentas (
        id_venta, id_cliente, id_sucursal, numero_documento_ref,
        monto_total, monto_amortizado, monto_saldo, fecha_vencimiento,
        dias_credito, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, 0.00, $5, $6, $7, 'PENDIENTE', $8)
      RETURNING *`,
      [
        id_venta || null,
        id_cliente,
        id_sucursal,
        numero_documento_ref?.trim() || null,
        montoNum,
        fechaVenc,
        dias,
        observaciones?.trim() || null
      ]
    );

    return res.status(201).json({
      message: 'Cuenta por cobrar registrada exitosamente.',
      cxc: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/tesoreria/cxc]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar cuenta por cobrar.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxc - Listar Cuentas por Cobrar
// =====================================================================
tesoreriaRouter.get('/cxc', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id_cliente, estado, id_sucursal, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT c.*,
             cli.razon_social AS cliente_razon_social,
             cli.nit_ci AS cliente_nit,
             cli.bloqueo_mora,
             s.nombre AS sucursal_nombre,
             CASE
               WHEN c.estado = 'PAGADO' THEN 'PAGADO'
               WHEN c.fecha_vencimiento < CURRENT_DATE AND c.monto_saldo > 0 THEN 'VENCIDO'
               ELSE 'PENDIENTE'
             END AS estado_dinamico
      FROM cxc_cuentas c
      JOIN clientes cli ON c.id_cliente = cli.id_cliente
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_cliente) {
      params.push(id_cliente);
      sql += ` AND c.id_cliente = $${params.length}`;
    }

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND c.id_sucursal = $${params.length}`;
    }

    if (estado) {
      params.push(estado.toString().toUpperCase());
      sql += ` AND c.estado = $${params.length}`;
    }

    sql += ` ORDER BY c.id_cxc DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      cuentas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxc]:', error);
    return res.status(500).json({ error: 'Error interno al consultar cuentas por cobrar.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxc/antiguedad-saldos - Reporte de Antigüedad de Cartera
// =====================================================================
tesoreriaRouter.get('/cxc/antiguedad-saldos', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT cli.id_cliente,
             cli.razon_social,
             cli.nit_ci,
             cli.telefono,
             cli.bloqueo_mora,
             COALESCE(SUM(CASE WHEN c.fecha_vencimiento >= CURRENT_DATE THEN c.monto_saldo ELSE 0 END), 0.00) AS no_vencido,
             COALESCE(SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 1 AND 30 THEN c.monto_saldo ELSE 0 END), 0.00) AS de_1_a_30_dias,
             COALESCE(SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 31 AND 60 THEN c.monto_saldo ELSE 0 END), 0.00) AS de_31_a_60_dias,
             COALESCE(SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento BETWEEN 61 AND 90 THEN c.monto_saldo ELSE 0 END), 0.00) AS de_61_a_90_dias,
             COALESCE(SUM(CASE WHEN CURRENT_DATE - c.fecha_vencimiento > 90 THEN c.monto_saldo ELSE 0 END), 0.00) AS mas_de_90_dias,
             COALESCE(SUM(c.monto_saldo), 0.00) AS total_saldo_deudor
      FROM clientes cli
      JOIN cxc_cuentas c ON cli.id_cliente = c.id_cliente
      WHERE c.monto_saldo > 0 AND c.estado != 'PAGADO'
      GROUP BY cli.id_cliente, cli.razon_social, cli.nit_ci, cli.telefono, cli.bloqueo_mora
      ORDER BY total_saldo_deudor DESC
    `);

    return res.status(200).json({
      total_clientes_con_deuda: result.rows.length,
      reporte: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxc/antiguedad-saldos]:', error);
    return res.status(500).json({ error: 'Error interno al generar reporte de antigüedad de saldos.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxc/estado-cuenta/:id_cliente - Extracto de Cuenta Cliente
// =====================================================================
tesoreriaRouter.get('/cxc/estado-cuenta/:id_cliente(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id_cliente } = req.params;

    const cliRes = await query(`SELECT * FROM clientes WHERE id_cliente = $1`, [id_cliente]);
    if (cliRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado.' });
    }

    const cxcList = await query(
      `SELECT c.*,
              COALESCE((SELECT json_agg(cb ORDER BY cb.id_cobro ASC) FROM cxc_cobros cb WHERE cb.id_cxc = c.id_cxc), '[]'::json) AS cobros_aplicados
       FROM cxc_cuentas c
       WHERE c.id_cliente = $1
       ORDER BY c.id_cxc ASC`,
      [id_cliente]
    );

    const saldoTotal = cxcList.rows.reduce((acc, row) => acc + parseFloat(row.monto_saldo), 0);

    return res.status(200).json({
      cliente: cliRes.rows[0],
      total_saldo_deudor: parseFloat(saldoTotal.toFixed(2)),
      cuentas: cxcList.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxc/estado-cuenta/:id_cliente]:', error);
    return res.status(500).json({ error: 'Error interno al consultar extracto de cliente.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxc/:id - Detalle de Cuenta por Cobrar y Cobros
// =====================================================================
tesoreriaRouter.get('/cxc/:id(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT c.*,
              cli.razon_social AS cliente_razon_social,
              cli.nit_ci AS cliente_nit,
              cli.telefono AS cliente_telefono,
              s.nombre AS sucursal_nombre
       FROM cxc_cuentas c
       JOIN clientes cli ON c.id_cliente = cli.id_cliente
       JOIN sucursales s ON c.id_sucursal = s.id_sucursal
       WHERE c.id_cxc = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta por cobrar no encontrada.' });
    }

    const cobrosRes = await query(
      `SELECT cb.*, u.nombre_completo AS cajero_nombre
       FROM cxc_cobros cb
       JOIN usuarios u ON cb.id_usuario = u.id_usuario
       WHERE cb.id_cxc = $1
       ORDER BY cb.id_cobro ASC`,
      [id]
    );

    return res.status(200).json({
      cuenta: cabRes.rows[0],
      cobros: cobrosRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxc/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de cuenta por cobrar.' });
  }
});

// =====================================================================
// POST /api/tesoreria/cxc/cobros - Registrar Cobro / Amortización (Recibo)
// =====================================================================
tesoreriaRouter.post('/cxc/cobros', requireRole('ADMIN', 'SUPERVISOR', 'VENTAS', 'VENTAS_POS'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_cxc,
      monto_cobrado,
      forma_pago = 'EFECTIVO',
      numero_recibo,
      numero_referencia,
      observaciones
    } = req.body;

    if (!id_cxc || !monto_cobrado || !numero_recibo) {
      return res.status(400).json({ error: 'id_cxc, monto_cobrado y numero_recibo son obligatorios.' });
    }

    const montoNum = parseFloat(monto_cobrado);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto_cobrado debe ser un número mayor a cero.' });
    }

    // Verificar unicidad de numero_recibo
    const dupRec = await client.query(`SELECT id_cobro FROM cxc_cobros WHERE numero_recibo = $1`, [numero_recibo.trim()]);
    if (dupRec.rows.length > 0) {
      return res.status(409).json({ error: `El número de recibo ${numero_recibo} ya fue emitido previamente.` });
    }

    await client.query('BEGIN');

    const cxcRes = await client.query(
      `SELECT * FROM cxc_cuentas WHERE id_cxc = $1 FOR UPDATE`,
      [id_cxc]
    );

    if (cxcRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta por cobrar no encontrada.' });
    }

    const cxc = cxcRes.rows[0];
    const saldoActual = parseFloat(cxc.monto_saldo);

    if (saldoActual <= 0 || cxc.estado === 'PAGADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La cuenta ya se encuentra completamente pagada.' });
    }

    if (montoNum > saldoActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `El monto a cobrar (${montoNum} Bs) supera el saldo pendiente exigible (${saldoActual} Bs).`
      });
    }

    // 1. Insertar Recibo de Cobro
    const insCobro = await client.query(
      `INSERT INTO cxc_cobros (
        id_cxc, numero_recibo, monto_cobrado, forma_pago,
        numero_referencia, observaciones, id_usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        id_cxc,
        numero_recibo.trim(),
        montoNum,
        forma_pago.toUpperCase(),
        numero_referencia?.trim() || null,
        observaciones?.trim() || null,
        req.user?.id_usuario || 1
      ]
    );

    // 2. Actualizar Cuenta por Cobrar
    const nuevoAmortizado = parseFloat(cxc.monto_amortizado) + montoNum;
    const nuevoSaldo = Math.max(0, parseFloat(cxc.monto_total) - nuevoAmortizado);
    const nuevoEstado = nuevoSaldo === 0 ? 'PAGADO' : 'PENDIENTE';

    const updCxc = await client.query(
      `UPDATE cxc_cuentas
       SET monto_amortizado = $1,
           monto_saldo = $2,
           estado = $3
       WHERE id_cxc = $4
       RETURNING *`,
      [nuevoAmortizado, nuevoSaldo, nuevoEstado, id_cxc]
    );

    // 3. Rehabilitación automática de mora si ya no tiene deudas vencidas
    let moraRehabilitada = false;
    if (nuevoSaldo === 0) {
      const deudasVencidasRes = await client.query(
        `SELECT COUNT(*) FROM cxc_cuentas
         WHERE id_cliente = $1
           AND fecha_vencimiento < CURRENT_DATE
           AND estado != 'PAGADO'
           AND monto_saldo > 0`,
        [cxc.id_cliente]
      );

      const deudasPendientes = parseInt(deudasVencidasRes.rows[0].count, 10);
      if (deudasPendientes === 0) {
        await client.query(`UPDATE clientes SET bloqueo_mora = FALSE WHERE id_cliente = $1`, [cxc.id_cliente]);
        moraRehabilitada = true;
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Cobro registrado exitosamente y amortización aplicada.',
      recibo: insCobro.rows[0],
      cuenta_actualizada: updCxc.rows[0],
      mora_rehabilitada: moraRehabilitada
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/tesoreria/cxc/cobros]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar cobro.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/tesoreria/cxp - Registrar Cuenta por Pagar a Proveedor
// =====================================================================
tesoreriaRouter.post('/cxp', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      id_proveedor,
      id_sucursal,
      monto_total,
      dias_credito = 30,
      fecha_vencimiento,
      id_compra,
      numero_documento_ref,
      observaciones
    } = req.body;

    if (!id_proveedor || !id_sucursal || !monto_total) {
      return res.status(400).json({ error: 'id_proveedor, id_sucursal y monto_total son obligatorios.' });
    }

    const montoNum = parseFloat(monto_total);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto_total debe ser mayor a cero.' });
    }

    const dias = parseInt(dias_credito, 10) || 30;
    let fechaVenc = fecha_vencimiento;
    if (!fechaVenc) {
      const d = new Date();
      d.setDate(d.getDate() + dias);
      fechaVenc = d.toISOString().slice(0, 10);
    }

    const result = await query(
      `INSERT INTO cxp_cuentas (
        id_compra, id_proveedor, id_sucursal, numero_documento_ref,
        monto_total, monto_amortizado, monto_saldo, fecha_vencimiento,
        dias_credito, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, 0.00, $5, $6, $7, 'PENDIENTE', $8)
      RETURNING *`,
      [
        id_compra || null,
        id_proveedor,
        id_sucursal,
        numero_documento_ref?.trim() || null,
        montoNum,
        fechaVenc,
        dias,
        observaciones?.trim() || null
      ]
    );

    return res.status(201).json({
      message: 'Cuenta por pagar registrada exitosamente.',
      cxp: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/tesoreria/cxp]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar cuenta por pagar.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxp - Listar Cuentas por Pagar
// =====================================================================
tesoreriaRouter.get('/cxp', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id_proveedor, estado, id_sucursal, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT c.*,
             p.razon_social AS proveedor_razon_social,
             p.nit_ci AS proveedor_nit,
             p.pais AS proveedor_pais,
             s.nombre AS sucursal_nombre
      FROM cxp_cuentas c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_proveedor) {
      params.push(id_proveedor);
      sql += ` AND c.id_proveedor = $${params.length}`;
    }

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND c.id_sucursal = $${params.length}`;
    }

    if (estado) {
      params.push(estado.toString().toUpperCase());
      sql += ` AND c.estado = $${params.length}`;
    }

    sql += ` ORDER BY c.id_cxp DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      cuentas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxp]:', error);
    return res.status(500).json({ error: 'Error interno al consultar cuentas por pagar.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxp/estado-cuenta/:id_proveedor - Extracto de Proveedor
// =====================================================================
tesoreriaRouter.get('/cxp/estado-cuenta/:id_proveedor(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id_proveedor } = req.params;

    const provRes = await query(`SELECT * FROM proveedores WHERE id_proveedor = $1`, [id_proveedor]);
    if (provRes.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    const cxpList = await query(
      `SELECT c.*,
              COALESCE((SELECT json_agg(pg ORDER BY pg.id_pago ASC) FROM cxp_pagos pg WHERE pg.id_cxp = c.id_cxp), '[]'::json) AS pagos_aplicados
       FROM cxp_cuentas c
       WHERE c.id_proveedor = $1
       ORDER BY c.id_cxp ASC`,
      [id_proveedor]
    );

    const saldoTotal = cxpList.rows.reduce((acc, row) => acc + parseFloat(row.monto_saldo), 0);

    return res.status(200).json({
      proveedor: provRes.rows[0],
      total_saldo_pendiente: parseFloat(saldoTotal.toFixed(2)),
      obligaciones: cxpList.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxp/estado-cuenta/:id_proveedor]:', error);
    return res.status(500).json({ error: 'Error interno al consultar extracto de proveedor.' });
  }
});

// =====================================================================
// GET /api/tesoreria/cxp/:id - Detalle de Cuenta por Pagar y Pagos
// =====================================================================
tesoreriaRouter.get('/cxp/:id(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT c.*,
              p.razon_social AS proveedor_razon_social,
              p.nit_ci AS proveedor_nit,
              p.telefono AS proveedor_telefono,
              s.nombre AS sucursal_nombre
       FROM cxp_cuentas c
       JOIN proveedores p ON c.id_proveedor = p.id_proveedor
       JOIN sucursales s ON c.id_sucursal = s.id_sucursal
       WHERE c.id_cxp = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Cuenta por pagar no encontrada.' });
    }

    const pagosRes = await query(
      `SELECT pg.*, u.nombre_completo AS usuario_nombre
       FROM cxp_pagos pg
       JOIN usuarios u ON pg.id_usuario = u.id_usuario
       WHERE pg.id_cxp = $1
       ORDER BY pg.id_pago ASC`,
      [id]
    );

    return res.status(200).json({
      cuenta: cabRes.rows[0],
      pagos: pagosRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/tesoreria/cxp/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de cuenta por pagar.' });
  }
});

// =====================================================================
// POST /api/tesoreria/cxp/pagos - Registrar Pago a Proveedor (Comprobante)
// =====================================================================
tesoreriaRouter.post('/cxp/pagos', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_cxp,
      monto_pagado,
      forma_pago = 'TRANSFERENCIA',
      numero_comprobante,
      numero_referencia,
      observaciones
    } = req.body;

    if (!id_cxp || !monto_pagado || !numero_comprobante) {
      return res.status(400).json({ error: 'id_cxp, monto_pagado y numero_comprobante son obligatorios.' });
    }

    const montoNum = parseFloat(monto_pagado);
    if (isNaN(montoNum) || montoNum <= 0) {
      return res.status(400).json({ error: 'monto_pagado debe ser un número mayor a cero.' });
    }

    // Verificar unicidad de comprobante
    const dupComp = await client.query(`SELECT id_pago FROM cxp_pagos WHERE numero_comprobante = $1`, [numero_comprobante.trim()]);
    if (dupComp.rows.length > 0) {
      return res.status(409).json({ error: `El número de comprobante ${numero_comprobante} ya fue emitido previamente.` });
    }

    await client.query('BEGIN');

    const cxpRes = await client.query(
      `SELECT * FROM cxp_cuentas WHERE id_cxp = $1 FOR UPDATE`,
      [id_cxp]
    );

    if (cxpRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Cuenta por pagar no encontrada.' });
    }

    const cxp = cxpRes.rows[0];
    const saldoActual = parseFloat(cxp.monto_saldo);

    if (saldoActual <= 0 || cxp.estado === 'PAGADO') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La obligación ya se encuentra completamente cancelada.' });
    }

    if (montoNum > saldoActual) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `El monto a pagar (${montoNum} Bs) supera el saldo pendiente con el proveedor (${saldoActual} Bs).`
      });
    }

    // 1. Insertar Comprobante de Pago
    const insPago = await client.query(
      `INSERT INTO cxp_pagos (
        id_cxp, numero_comprobante, monto_pagado, forma_pago,
        numero_referencia, observaciones, id_usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        id_cxp,
        numero_comprobante.trim(),
        montoNum,
        forma_pago.toUpperCase(),
        numero_referencia?.trim() || null,
        observaciones?.trim() || null,
        req.user?.id_usuario || 1
      ]
    );

    // 2. Actualizar Cuenta por Pagar
    const nuevoAmortizado = parseFloat(cxp.monto_amortizado) + montoNum;
    const nuevoSaldo = Math.max(0, parseFloat(cxp.monto_total) - nuevoAmortizado);
    const nuevoEstado = nuevoSaldo === 0 ? 'PAGADO' : 'PENDIENTE';

    const updCxp = await client.query(
      `UPDATE cxp_cuentas
       SET monto_amortizado = $1,
           monto_saldo = $2,
           estado = $3
       WHERE id_cxp = $4
       RETURNING *`,
      [nuevoAmortizado, nuevoSaldo, nuevoEstado, id_cxp]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Pago a proveedor registrado y amortizado exitosamente.',
      comprobante: insPago.rows[0],
      cuenta_actualizada: updCxp.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/tesoreria/cxp/pagos]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar pago a proveedor.' });
  } finally {
    client.release();
  }
});

