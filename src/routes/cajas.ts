import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const cajasRouter = Router();

// Todas las rutas de cajas requieren autenticación JWT
cajasRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de cajas
 */
export async function initCajasSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS cajas_fisicas (
        id_caja INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        codigo VARCHAR(20) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_caja_sucursal_codigo UNIQUE(id_sucursal, codigo)
    );

    CREATE TABLE IF NOT EXISTS cajas_turnos (
        id_turno BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_caja INT NOT NULL REFERENCES cajas_fisicas(id_caja) ON DELETE RESTRICT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_cierre TIMESTAMPTZ,
        monto_apertura NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        monto_efectivo_declarado NUMERIC(14,2),
        monto_teorico_efectivo NUMERIC(14,2),
        diferencia_corte NUMERIC(14,2),
        estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
        observaciones TEXT,
        resumen_ventas JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cajas_movimientos_manuales (
        id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_turno BIGINT NOT NULL REFERENCES cajas_turnos(id_turno) ON DELETE RESTRICT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        tipo VARCHAR(20) NOT NULL,
        monto NUMERIC(14,2) NOT NULL,
        concepto VARCHAR(250) NOT NULL,
        fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_monto_movimiento CHECK (monto > 0)
    );
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initCajasSchema]:', error.message);
  }
}

// Auto-inicializar esquema al importar el router
initCajasSchema().catch(console.error);

// =====================================================================
// GET /api/cajas - Listar cajas físicas de la sucursal
// =====================================================================
cajasRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const idSucursal = req.user?.id_sucursal || 1;
  const { id_sucursal: querySucursal } = req.query;
  const targetSucursal = (req.user?.rol === 'ADMIN' && querySucursal) ? Number(querySucursal) : idSucursal;

  try {
    // Si la sucursal no tiene ninguna caja, crear una caja predeterminada
    const checkSql = 'SELECT COUNT(*) FROM cajas_fisicas WHERE id_sucursal = $1';
    const checkRes = await query(checkSql, [targetSucursal]);
    if (Number(checkRes.rows[0].count) === 0) {
      await query(
        "INSERT INTO cajas_fisicas (id_sucursal, codigo, nombre) VALUES ($1, 'CAJA-01', 'Caja Principal - Mostrador')",
        [targetSucursal]
      );
    }

    const sql = `
      SELECT 
        c.id_caja,
        c.id_sucursal,
        s.nombre as sucursal_nombre,
        c.codigo,
        c.nombre,
        c.activo,
        (
          SELECT json_build_object(
            'id_turno', t.id_turno,
            'id_usuario', t.id_usuario,
            'cajero', u.nombre_completo,
            'fecha_apertura', t.fecha_apertura
          )
          FROM cajas_turnos t
          JOIN usuarios u ON t.id_usuario = u.id_usuario
          WHERE t.id_caja = c.id_caja AND t.estado = 'ABIERTO'
          LIMIT 1
        ) as turno_actual
      FROM cajas_fisicas c
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      WHERE c.id_sucursal = $1
      ORDER BY c.id_caja ASC
    `;
    const result = await query(sql, [targetSucursal]);
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error en GET /api/cajas]:', error.message);
    res.status(500).json({ error: 'Error al listar cajas físicas.' });
  }
});

// =====================================================================
// POST /api/cajas - Registrar nueva caja física
// =====================================================================
cajasRouter.post('/', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { codigo, nombre, id_sucursal } = req.body;

  if (!codigo || !nombre) {
    res.status(400).json({ error: 'codigo y nombre son obligatorios.' });
    return;
  }

  const sucursalFinal = id_sucursal || req.user?.id_sucursal || 1;

  try {
    const insertSql = `
      INSERT INTO cajas_fisicas (id_sucursal, codigo, nombre)
      VALUES ($1, $2, $3)
      RETURNING id_caja, id_sucursal, codigo, nombre, activo, created_at
    `;
    const result = await query(insertSql, [sucursalFinal, codigo.trim().toUpperCase(), nombre.trim()]);
    res.status(201).json({
      message: 'Caja física registrada exitosamente.',
      caja: result.rows[0]
    });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(409).json({ error: `Ya existe una caja con el código ${codigo} en esta sucursal.` });
      return;
    }
    console.error('[Error en POST /api/cajas]:', error.message);
    res.status(500).json({ error: 'Error al registrar caja física.' });
  }
});

// =====================================================================
// GET /api/cajas/turnos/activo - Consultar turno actualmente abierto
// =====================================================================
cajasRouter.get('/turnos/activo', async (req: AuthenticatedRequest, res: Response) => {
  const idUsuario = req.user?.id_usuario;

  try {
    const sql = `
      SELECT 
        t.id_turno,
        t.id_caja,
        c.codigo as caja_codigo,
        c.nombre as caja_nombre,
        t.id_sucursal,
        s.nombre as sucursal_nombre,
        t.id_usuario,
        u.nombre_completo as cajero_nombre,
        t.fecha_apertura,
        t.monto_apertura,
        t.estado,
        t.observaciones
      FROM cajas_turnos t
      JOIN cajas_fisicas c ON t.id_caja = c.id_caja
      JOIN sucursales s ON t.id_sucursal = s.id_sucursal
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_usuario = $1 AND t.estado = 'ABIERTO'
      ORDER BY t.id_turno DESC
      LIMIT 1
    `;
    const result = await query(sql, [idUsuario]);

    if (result.rows.length === 0) {
      res.status(200).json({ activo: false, turno: null });
      return;
    }

    res.status(200).json({
      activo: true,
      turno: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en GET /api/cajas/turnos/activo]:', error.message);
    res.status(500).json({ error: 'Error al consultar turno activo.' });
  }
});

// =====================================================================
// POST /api/cajas/turnos/abrir - Apertura de turno de caja
// =====================================================================
cajasRouter.post('/turnos/abrir', requireRole('ADMIN', 'VENTAS', 'VENTAS_POS', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { id_caja, monto_apertura = 0, observaciones = '' } = req.body;
  const idUsuario = req.user?.id_usuario;
  const idSucursal = req.user?.id_sucursal || 1;

  if (!id_caja) {
    res.status(400).json({ error: 'Debe especificar el id_caja física a abrir.' });
    return;
  }

  const montoNum = Number(monto_apertura);
  if (isNaN(montoNum) || montoNum < 0) {
    res.status(400).json({ error: 'El monto_apertura debe ser mayor o igual a cero.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar si el usuario ya tiene un turno abierto
    const userTurno = await client.query(
      "SELECT id_turno, id_caja FROM cajas_turnos WHERE id_usuario = $1 AND estado = 'ABIERTO' FOR UPDATE",
      [idUsuario]
    );

    if (userTurno.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `Ya tienes el turno Nro ${userTurno.rows[0].id_turno} abierto. Debes cerrarlo antes de iniciar otro.`
      });
      return;
    }

    // 2. Verificar si la caja física está ocupada por otro usuario
    const cajaTurno = await client.query(
      `SELECT t.id_turno, u.nombre_completo 
       FROM cajas_turnos t 
       JOIN usuarios u ON t.id_usuario = u.id_usuario 
       WHERE t.id_caja = $1 AND t.estado = 'ABIERTO' 
       FOR UPDATE`,
      [id_caja]
    );

    if (cajaTurno.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(409).json({
        error: `La caja física seleccionada ya está ocupada por el turno ${cajaTurno.rows[0].id_turno} (${cajaTurno.rows[0].nombre_completo}).`
      });
      return;
    }

    // 3. Registrar el nuevo turno
    const insertSql = `
      INSERT INTO cajas_turnos (
        id_caja, id_usuario, id_sucursal, monto_apertura, observaciones, estado
      ) VALUES ($1, $2, $3, $4, $5, 'ABIERTO')
      RETURNING id_turno, id_caja, id_usuario, id_sucursal, fecha_apertura, monto_apertura, estado
    `;
    const turnoRes = await client.query(insertSql, [id_caja, idUsuario, idSucursal, montoNum, observaciones]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Turno de caja abierto exitosamente.',
      turno: turnoRes.rows[0]
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/cajas/turnos/abrir]:', error.message);
    res.status(500).json({ error: 'Error al abrir turno de caja.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/cajas/turnos/:id/movimientos - Registrar ingreso/egreso manual
// =====================================================================
cajasRouter.post('/turnos/:id/movimientos', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { tipo, monto, concepto } = req.body;
  const idUsuario = req.user?.id_usuario;

  if (!tipo || !monto || !concepto) {
    res.status(400).json({ error: 'tipo (INGRESO|EGRESO), monto y concepto son obligatorios.' });
    return;
  }

  const tipoUpper = tipo.trim().toUpperCase();
  if (tipoUpper !== 'INGRESO' && tipoUpper !== 'EGRESO') {
    res.status(400).json({ error: 'tipo debe ser INGRESO o EGRESO.' });
    return;
  }

  const montoNum = Number(monto);
  if (isNaN(montoNum) || montoNum <= 0) {
    res.status(400).json({ error: 'El monto debe ser un número positivo mayor a cero.' });
    return;
  }

  try {
    // Verificar que el turno esté abierto
    const tRes = await query('SELECT id_turno, estado FROM cajas_turnos WHERE id_turno = $1', [id]);
    if (tRes.rows.length === 0) {
      res.status(404).json({ error: 'Turno de caja no encontrado.' });
      return;
    }

    if (tRes.rows[0].estado !== 'ABIERTO') {
      res.status(400).json({ error: 'No se pueden registrar movimientos en un turno cerrado.' });
      return;
    }

    const insertSql = `
      INSERT INTO cajas_movimientos_manuales (id_turno, id_usuario, tipo, monto, concepto)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id_movimiento, id_turno, tipo, monto, concepto, fecha
    `;
    const result = await query(insertSql, [id, idUsuario, tipoUpper, montoNum, concepto.trim()]);

    res.status(201).json({
      message: `Movimiento de ${tipoUpper} registrado exitosamente.`,
      movimiento: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST movimientos caja]:', error.message);
    res.status(500).json({ error: 'Error al registrar movimiento manual en caja.' });
  }
});

// =====================================================================
// POST /api/cajas/turnos/:id/cerrar - Arqueo Ciego y Cierre de Turno
// =====================================================================
cajasRouter.post('/turnos/:id/cerrar', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { monto_efectivo_declarado, observaciones = '' } = req.body;

  if (monto_efectivo_declarado === undefined || monto_efectivo_declarado === null) {
    res.status(400).json({ error: 'Debe ingresar el monto_efectivo_declarado para el arqueo ciego.' });
    return;
  }

  const declaradoNum = Number(monto_efectivo_declarado);
  if (isNaN(declaradoNum) || declaradoNum < 0) {
    res.status(400).json({ error: 'monto_efectivo_declarado debe ser un número mayor o igual a cero.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener y bloquear turno
    const tRes = await client.query(
      'SELECT id_turno, id_caja, id_usuario, id_sucursal, fecha_apertura, monto_apertura, estado FROM cajas_turnos WHERE id_turno = $1 FOR UPDATE',
      [id]
    );

    if (tRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Turno no encontrado.' });
      return;
    }

    const turno = tRes.rows[0];

    if (turno.estado === 'CERRADO') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'El turno ya se encuentra cerrado.' });
      return;
    }

    const fechaCierre = new Date();
    const montoApertura = Number(turno.monto_apertura);

    // 2. Calcular Ventas por tipo de pago durante el turno
    const ventasSql = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo_pago = 'CONTADO' THEN total_neto ELSE 0 END), 0) as ventas_efectivo,
        COALESCE(SUM(CASE WHEN tipo_pago = 'QR' THEN total_neto ELSE 0 END), 0) as ventas_qr,
        COALESCE(SUM(CASE WHEN tipo_pago = 'CREDITO' THEN total_neto ELSE 0 END), 0) as ventas_credito,
        COUNT(*) as total_transacciones
      FROM ventas_cabecera
      WHERE id_usuario = $1 
        AND id_sucursal = $2
        AND fecha_venta >= $3
        AND fecha_venta <= $4
        AND estado = 'EMITIDA'
    `;
    const vRes = await client.query(ventasSql, [
      turno.id_usuario,
      turno.id_sucursal,
      turno.fecha_apertura,
      fechaCierre
    ]);

    const ventasEfectivo = Number(vRes.rows[0].ventas_efectivo);
    const ventasQr = Number(vRes.rows[0].ventas_qr);
    const ventasCredito = Number(vRes.rows[0].ventas_credito);

    // 3. Calcular Movimientos Manuales (Ingresos y Egresos)
    const movSql = `
      SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END), 0) as total_ingresos,
        COALESCE(SUM(CASE WHEN tipo = 'EGRESO' THEN monto ELSE 0 END), 0) as total_egresos
      FROM cajas_movimientos_manuales
      WHERE id_turno = $1
    `;
    const mRes = await client.query(movSql, [id]);
    const totalIngresos = Number(mRes.rows[0].total_ingresos);
    const totalEgresos = Number(mRes.rows[0].total_egresos);

    // 4. Calcular Saldo Teórico en Efectivo y Diferencia
    const montoTeorico = Math.round((montoApertura + ventasEfectivo + totalIngresos - totalEgresos) * 100) / 100;
    const diferencia = Math.round((declaradoNum - montoTeorico) * 100) / 100;

    let estadoCuadre = 'CUADRADO';
    if (diferencia > 0) estadoCuadre = 'SOBRANTE';
    if (diferencia < 0) estadoCuadre = 'FALTANTE';

    const resumenVentas = {
      monto_apertura: montoApertura,
      ventas_efectivo: ventasEfectivo,
      ventas_qr: ventasQr,
      ventas_credito: ventasCredito,
      total_ingresos_manuales: totalIngresos,
      total_egresos_manuales: totalEgresos,
      saldo_teorico_efectivo: montoTeorico,
      efectivo_declarado: declaradoNum,
      diferencia_corte: diferencia,
      estado_cuadre: estadoCuadre,
      transacciones_contadas: Number(vRes.rows[0].total_transacciones)
    };

    // 5. Actualizar Turno a CERRADO con auditoría inalterable
    const updateSql = `
      UPDATE cajas_turnos 
      SET 
        fecha_cierre = $1,
        monto_efectivo_declarado = $2,
        monto_teorico_efectivo = $3,
        diferencia_corte = $4,
        estado = 'CERRADO',
        observaciones = $5,
        resumen_ventas = $6
      WHERE id_turno = $7
      RETURNING id_turno, fecha_apertura, fecha_cierre, estado
    `;
    await client.query(updateSql, [
      fechaCierre,
      declaradoNum,
      montoTeorico,
      diferencia,
      observaciones,
      JSON.stringify(resumenVentas),
      id
    ]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Turno de caja cerrado exitosamente y arqueo consolidado.',
      id_turno: Number(id),
      arqueo: resumenVentas
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/cajas/turnos/:id/cerrar]:', error.message);
    res.status(500).json({ error: 'Error interno al cerrar el turno de caja.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/cajas/turnos/:id - Obtener detalle completo de un turno
// =====================================================================
cajasRouter.get('/turnos/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const turnoSql = `
      SELECT 
        t.id_turno,
        t.id_caja,
        c.codigo as caja_codigo,
        c.nombre as caja_nombre,
        t.id_sucursal,
        s.nombre as sucursal_nombre,
        t.id_usuario,
        u.nombre_completo as cajero_nombre,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_apertura,
        t.monto_efectivo_declarado,
        t.monto_teorico_efectivo,
        t.diferencia_corte,
        t.estado,
        t.observaciones,
        t.resumen_ventas
      FROM cajas_turnos t
      JOIN cajas_fisicas c ON t.id_caja = c.id_caja
      JOIN sucursales s ON t.id_sucursal = s.id_sucursal
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE t.id_turno = $1
    `;
    const tRes = await query(turnoSql, [id]);

    if (tRes.rows.length === 0) {
      res.status(404).json({ error: 'Turno no encontrado.' });
      return;
    }

    const turno = tRes.rows[0];

    // Obtener movimientos manuales
    const mRes = await query(
      `SELECT m.id_movimiento, m.tipo, m.monto, m.concepto, m.fecha, u.nombre_completo as usuario
       FROM cajas_movimientos_manuales m
       JOIN usuarios u ON m.id_usuario = u.id_usuario
       WHERE m.id_turno = $1
       ORDER BY m.id_movimiento ASC`,
      [id]
    );

    res.status(200).json({
      ...turno,
      movimientos_manuales: mRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/cajas/turnos/:id]:', error.message);
    res.status(500).json({ error: 'Error al consultar turno.' });
  }
});

// =====================================================================
// GET /api/cajas/turnos - Listar turnos con filtros
// =====================================================================
cajasRouter.get('/turnos', async (req: AuthenticatedRequest, res: Response) => {
  const { id_sucursal, estado, limit = 50, offset = 0 } = req.query;

  try {
    let sql = `
      SELECT 
        t.id_turno,
        t.id_caja,
        c.codigo as caja_codigo,
        c.nombre as caja_nombre,
        t.id_sucursal,
        s.nombre as sucursal_nombre,
        t.id_usuario,
        u.nombre_completo as cajero_nombre,
        t.fecha_apertura,
        t.fecha_cierre,
        t.monto_apertura,
        t.monto_efectivo_declarado,
        t.diferencia_corte,
        t.estado
      FROM cajas_turnos t
      JOIN cajas_fisicas c ON t.id_caja = c.id_caja
      JOIN sucursales s ON t.id_sucursal = s.id_sucursal
      JOIN usuarios u ON t.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND t.id_sucursal = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      sql += ` AND t.estado = $${params.length}`;
    }

    params.push(Number(limit) || 50);
    sql += ` ORDER BY t.id_turno DESC LIMIT $${params.length}`;

    params.push(Number(offset) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error en GET /api/cajas/turnos]:', error.message);
    res.status(500).json({ error: 'Error al listar turnos.' });
  }
});
