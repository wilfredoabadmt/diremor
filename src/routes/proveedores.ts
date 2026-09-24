import { Router, Response } from 'express';
import { query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const proveedoresRouter = Router();

// Todas las rutas de proveedores requieren autenticación JWT
proveedoresRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de proveedores
 */
export async function initProveedoresSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS proveedores (
        id_proveedor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        razon_social VARCHAR(150) NOT NULL,
        tipo_documento VARCHAR(15) NOT NULL DEFAULT 'NIT',
        nit_ci VARCHAR(35) NOT NULL UNIQUE,
        contacto_nombre VARCHAR(100),
        telefono VARCHAR(35),
        email VARCHAR(100),
        direccion VARCHAR(200),
        pais VARCHAR(50) NOT NULL DEFAULT 'BOLIVIA',
        tipo_proveedor VARCHAR(20) NOT NULL DEFAULT 'NACIONAL',
        dias_credito INT NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_proveedores_nit ON proveedores(nit_ci);
    CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON proveedores(razon_social);
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initProveedoresSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initProveedoresSchema().catch(console.error);

// =====================================================================
// POST /api/proveedores - Registrar nuevo proveedor
// =====================================================================
proveedoresRouter.post('/', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      razon_social,
      tipo_documento = 'NIT',
      nit_ci,
      contacto_nombre,
      telefono,
      email,
      direccion,
      pais = 'BOLIVIA',
      tipo_proveedor = 'NACIONAL',
      dias_credito = 0
    } = req.body;

    if (!razon_social || !nit_ci) {
      return res.status(400).json({ error: 'razon_social y nit_ci son campos obligatorios.' });
    }

    const docPermitidos = ['NIT', 'CI', 'EXTRANJERO', 'RUC'];
    if (!docPermitidos.includes(tipo_documento.toUpperCase())) {
      return res.status(400).json({
        error: `tipo_documento inválido. Valores permitidos: ${docPermitidos.join(', ')}`
      });
    }

    const tipoProvUpper = tipo_proveedor.toUpperCase();
    if (!['NACIONAL', 'INTERNACIONAL'].includes(tipoProvUpper)) {
      return res.status(400).json({
        error: "tipo_proveedor debe ser 'NACIONAL' o 'INTERNACIONAL'."
      });
    }

    if (isNaN(Number(dias_credito)) || Number(dias_credito) < 0) {
      return res.status(400).json({
        error: 'dias_credito debe ser un entero mayor o igual a 0.'
      });
    }

    // Verificar unicidad de nit_ci
    const duplicado = await query(
      `SELECT id_proveedor, razon_social FROM proveedores WHERE nit_ci = $1`,
      [nit_ci.trim()]
    );

    if (duplicado.rows.length > 0) {
      return res.status(409).json({
        error: `Ya existe un proveedor registrado con el documento ${nit_ci} (${duplicado.rows[0].razon_social}).`
      });
    }

    const result = await query(
      `INSERT INTO proveedores (
        razon_social, tipo_documento, nit_ci, contacto_nombre,
        telefono, email, direccion, pais, tipo_proveedor, dias_credito
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        razon_social.trim(),
        tipo_documento.toUpperCase(),
        nit_ci.trim(),
        contacto_nombre?.trim() || null,
        telefono?.trim() || null,
        email?.trim() || null,
        direccion?.trim() || null,
        pais.trim().toUpperCase(),
        tipoProvUpper,
        parseInt(dias_credito, 10)
      ]
    );

    return res.status(201).json({
      message: 'Proveedor registrado exitosamente.',
      proveedor: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/proveedores]:', error);
    return res.status(500).json({ error: 'Error interno al registrar proveedor.' });
  }
});

// =====================================================================
// GET /api/proveedores - Listar y buscar proveedores
// =====================================================================
proveedoresRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { q, tipo_proveedor, activo, limit = '50', offset = '0' } = req.query;

    let sql = `SELECT * FROM proveedores WHERE 1=1`;
    const params: any[] = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND (razon_social ILIKE $${params.length} OR nit_ci ILIKE $${params.length} OR contacto_nombre ILIKE $${params.length})`;
    }

    if (tipo_proveedor) {
      params.push(tipo_proveedor.toString().toUpperCase());
      sql += ` AND tipo_proveedor = $${params.length}`;
    }

    if (activo !== undefined) {
      params.push(activo === 'true' || activo === '1');
      sql += ` AND activo = $${params.length}`;
    }

    sql += ` ORDER BY razon_social ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);
    return res.status(200).json({
      total: result.rows.length,
      proveedores: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/proveedores]:', error);
    return res.status(500).json({ error: 'Error interno al listar proveedores.' });
  }
});

// =====================================================================
// GET /api/proveedores/:id - Obtener detalle de proveedor
// =====================================================================
proveedoresRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*,
              COALESCE((SELECT COUNT(*) FROM compras_cabecera c WHERE c.id_proveedor = p.id_proveedor), 0) AS total_compras_realizadas,
              COALESCE((SELECT SUM(monto_total_neto) FROM compras_cabecera c WHERE c.id_proveedor = p.id_proveedor), 0.00) AS volumen_total_comprado
       FROM proveedores p
       WHERE p.id_proveedor = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    return res.status(200).json({ proveedor: result.rows[0] });
  } catch (error: any) {
    console.error('[Error en GET /api/proveedores/:id]:', error);
    return res.status(500).json({ error: 'Error interno al obtener proveedor.' });
  }
});

// =====================================================================
// PUT /api/proveedores/:id - Actualizar datos de proveedor
// =====================================================================
proveedoresRouter.put('/:id', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      razon_social,
      contacto_nombre,
      telefono,
      email,
      direccion,
      pais,
      tipo_proveedor,
      dias_credito,
      activo
    } = req.body;

    const existe = await query(`SELECT * FROM proveedores WHERE id_proveedor = $1`, [id]);
    if (existe.rows.length === 0) {
      return res.status(404).json({ error: 'Proveedor no encontrado.' });
    }

    const actual = existe.rows[0];

    const result = await query(
      `UPDATE proveedores
       SET razon_social = COALESCE($1, razon_social),
           contacto_nombre = COALESCE($2, contacto_nombre),
           telefono = COALESCE($3, telefono),
           email = COALESCE($4, email),
           direccion = COALESCE($5, direccion),
           pais = COALESCE($6, pais),
           tipo_proveedor = COALESCE($7, tipo_proveedor),
           dias_credito = COALESCE($8, dias_credito),
           activo = COALESCE($9, activo),
           updated_at = CURRENT_TIMESTAMP
       WHERE id_proveedor = $10
       RETURNING *`,
      [
        razon_social?.trim() || actual.razon_social,
        contacto_nombre !== undefined ? contacto_nombre?.trim() : actual.contacto_nombre,
        telefono !== undefined ? telefono?.trim() : actual.telefono,
        email !== undefined ? email?.trim() : actual.email,
        direccion !== undefined ? direccion?.trim() : actual.direccion,
        pais !== undefined ? pais?.trim().toUpperCase() : actual.pais,
        tipo_proveedor !== undefined ? tipo_proveedor?.trim().toUpperCase() : actual.tipo_proveedor,
        dias_credito !== undefined ? parseInt(dias_credito, 10) : actual.dias_credito,
        activo !== undefined ? Boolean(activo) : actual.activo,
        id
      ]
    );

    return res.status(200).json({
      message: 'Proveedor actualizado exitosamente.',
      proveedor: result.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en PUT /api/proveedores/:id]:', error);
    return res.status(500).json({ error: 'Error interno al actualizar proveedor.' });
  }
});
