import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const administracionRouter = Router();

// Todas las rutas de administración requieren autenticación JWT
administracionRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema administrativo
 */
export async function initAdministracionSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS periodos_contables (
        id_periodo INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        anio INT NOT NULL,
        mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
        estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
        fecha_cierre TIMESTAMPTZ,
        id_usuario_cierre BIGINT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_periodo_anio_mes UNIQUE (anio, mes)
    );

    CREATE INDEX IF NOT EXISTS idx_periodos_anio_mes ON periodos_contables(anio, mes);
    CREATE INDEX IF NOT EXISTS idx_periodos_estado ON periodos_contables(estado);

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'telefono') THEN
            ALTER TABLE sucursales ADD COLUMN telefono VARCHAR(50) DEFAULT '3-3456789';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'email') THEN
            ALTER TABLE sucursales ADD COLUMN email VARCHAR(100) DEFAULT 'contacto@diremor.com.bo';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'leyenda_fiscal') THEN
            ALTER TABLE sucursales ADD COLUMN leyenda_fiscal TEXT DEFAULT 'Ley N° 453: El proveedor debe exhibir el precio total del bien o servicio en moneda nacional.';
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'codigo_punto_venta_sin') THEN
            ALTER TABLE sucursales ADD COLUMN codigo_punto_venta_sin INT DEFAULT 0;
        END IF;
    END $$;
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initAdministracionSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initAdministracionSchema().catch(console.error);

// =====================================================================
// GET /api/administracion/periodos - Listar Períodos Contables
// =====================================================================
administracionRouter.get('/periodos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { anio } = req.query;

    let sql = `
      SELECT p.*, u.nombre_completo AS usuario_cierre_nombre
      FROM periodos_contables p
      LEFT JOIN usuarios u ON p.id_usuario_cierre = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (anio) {
      params.push(parseInt(anio as string, 10));
      sql += ` AND p.anio = $${params.length}`;
    }

    sql += ` ORDER BY p.anio DESC, p.mes DESC`;

    const result = await query(sql, params);
    return res.status(200).json({
      total: result.rows.length,
      periodos: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/administracion/periodos]:', error);
    return res.status(500).json({ error: 'Error interno al consultar períodos.' });
  }
});

// =====================================================================
// GET /api/administracion/periodos/verificar - Verificar si una fecha está abierta
// =====================================================================
administracionRouter.get('/periodos/verificar', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fecha } = req.query;
    const targetDate = fecha ? new Date(fecha as string) : new Date();

    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Formato de fecha inválido. Utilice YYYY-MM-DD.' });
    }

    const anio = targetDate.getFullYear();
    const mes = targetDate.getMonth() + 1;

    const result = await query(
      `SELECT * FROM periodos_contables WHERE anio = $1 AND mes = $2`,
      [anio, mes]
    );

    const periodo = result.rows[0];
    const estaCerrado = periodo ? periodo.estado === 'CERRADO' : false;

    return res.status(200).json({
      anio,
      mes,
      estado: estaCerrado ? 'CERRADO' : 'ABIERTO',
      permite_operaciones: !estaCerrado,
      periodo: periodo || null
    });
  } catch (error: any) {
    console.error('[Error en GET /api/administracion/periodos/verificar]:', error);
    return res.status(500).json({ error: 'Error interno al verificar período.' });
  }
});

// =====================================================================
// POST /api/administracion/periodos/cerrar - Cerrar Período Contable
// =====================================================================
administracionRouter.post('/periodos/cerrar', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { anio, mes, observaciones } = req.body;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'anio y mes son obligatorios.' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    if (mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'mes debe ser entre 1 y 12.' });
    }

    const idUsuario = req.user?.id_usuario || 1;

    const result = await query(
      `INSERT INTO periodos_contables (anio, mes, estado, fecha_cierre, id_usuario_cierre, observaciones)
       VALUES ($1, $2, 'CERRADO', CURRENT_TIMESTAMP, $3, $4)
       ON CONFLICT (anio, mes) DO UPDATE
       SET estado = 'CERRADO',
           fecha_cierre = CURRENT_TIMESTAMP,
           id_usuario_cierre = $3,
           observaciones = EXCLUDED.observaciones
       RETURNING *`,
      [anioNum, mesNum, idUsuario, observaciones?.trim() || 'Cierre mensual operativo y fiscal']
    );

    return res.status(200).json({
      message: `Período ${mesNum}/${anioNum} cerrado exitosamente. Se bloquean transacciones retrospectivas.`,
      periodo: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/administracion/periodos/cerrar]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al cerrar período.' });
  }
});

// =====================================================================
// POST /api/administracion/periodos/reabrir - Reabrir Período Contable
// =====================================================================
administracionRouter.post('/periodos/reabrir', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { anio, mes, motivo_reapertura } = req.body;

    if (!anio || !mes) {
      return res.status(400).json({ error: 'anio y mes son obligatorios.' });
    }

    const anioNum = parseInt(anio, 10);
    const mesNum = parseInt(mes, 10);

    const result = await query(
      `UPDATE periodos_contables
       SET estado = 'ABIERTO',
           fecha_cierre = NULL,
           id_usuario_cierre = NULL,
           observaciones = COALESCE(observaciones, '') || ' | Reapertura: ' || $1
       WHERE anio = $2 AND mes = $3
       RETURNING *`,
      [motivo_reapertura?.trim() || 'Reapertura excepcional autorizada por Gerencia', anioNum, mesNum]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `El período ${mesNum}/${anioNum} no estaba registrado o ya estaba abierto.` });
    }

    return res.status(200).json({
      message: `Período ${mesNum}/${anioNum} reabierto exitosamente.`,
      periodo: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/administracion/periodos/reabrir]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al reabrir período.' });
  }
});

// =====================================================================
// GET /api/administracion/sucursales/:id - Datos Operativos de Sucursal
// =====================================================================
administracionRouter.get('/sucursales/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(`SELECT * FROM sucursales WHERE id_sucursal = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    return res.status(200).json({
      sucursal: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en GET /api/administracion/sucursales/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar sucursal.' });
  }
});

// =====================================================================
// PUT /api/administracion/sucursales/:id - Actualizar Parámetros de Sucursal
// =====================================================================
administracionRouter.put('/sucursales/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      direccion,
      municipio,
      telefono,
      email,
      leyenda_fiscal,
      codigo_punto_venta_sin
    } = req.body;

    const check = await query(`SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1`, [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    const upd = await query(
      `UPDATE sucursales
       SET nombre = COALESCE($1, nombre),
           direccion = COALESCE($2, direccion),
           municipio = COALESCE($3, municipio),
           telefono = COALESCE($4, telefono),
           email = COALESCE($5, email),
           leyenda_fiscal = COALESCE($6, leyenda_fiscal),
           codigo_punto_venta_sin = COALESCE($7, codigo_punto_venta_sin)
       WHERE id_sucursal = $8
       RETURNING *`,
      [
        nombre?.trim() || null,
        direccion?.trim() || null,
        municipio?.trim() || null,
        telefono?.trim() || null,
        email?.trim() || null,
        leyenda_fiscal?.trim() || null,
        codigo_punto_venta_sin !== undefined ? parseInt(codigo_punto_venta_sin, 10) : null,
        id
      ]
    );

    return res.status(200).json({
      message: 'Parámetros de sucursal actualizados exitosamente.',
      sucursal: upd.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en PUT /api/administracion/sucursales/:id]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al actualizar sucursal.' });
  }
});
