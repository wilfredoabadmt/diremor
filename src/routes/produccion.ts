import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const produccionRouter = Router();

// Todas las rutas de producción requieren autenticación JWT
produccionRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de producción y recetas BOM
 */
export async function initProduccionSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS produccion_recetas_cabecera (
        id_receta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo_producto_pt VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        nombre_receta VARCHAR(150) NOT NULL,
        descripcion TEXT,
        rendimiento_base NUMERIC(12,2) NOT NULL DEFAULT 1.00 CHECK (rendimiento_base > 0),
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_recetas_pt ON produccion_recetas_cabecera(codigo_producto_pt);

    CREATE TABLE IF NOT EXISTS produccion_recetas_detalle (
        id_receta_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_receta BIGINT NOT NULL REFERENCES produccion_recetas_cabecera(id_receta) ON DELETE CASCADE,
        codigo_insumo VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        cantidad_requerida NUMERIC(12,4) NOT NULL CHECK (cantidad_requerida > 0),
        merma_permitida_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (merma_permitida_pct >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_recetas_det_receta ON produccion_recetas_detalle(id_receta);
    CREATE INDEX IF NOT EXISTS idx_recetas_det_insumo ON produccion_recetas_detalle(codigo_insumo);

    CREATE TABLE IF NOT EXISTS produccion_ordenes (
        id_orden BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        numero_orden VARCHAR(50) NOT NULL UNIQUE,
        id_receta BIGINT NOT NULL REFERENCES produccion_recetas_cabecera(id_receta) ON DELETE RESTRICT,
        codigo_producto_pt VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_almacen_insumos INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        id_almacen_pt INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        cantidad_planificada NUMERIC(12,2) NOT NULL CHECK (cantidad_planificada > 0),
        cantidad_producida NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (cantidad_producida >= 0),
        estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADA',
        costo_total_mp NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        costo_total_mod NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        costo_total_cif NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        costo_total_fabricacion NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        costo_unitario_pt NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        fecha_inicio TIMESTAMPTZ,
        fecha_fin TIMESTAMPTZ,
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ordenes_receta ON produccion_ordenes(id_receta);
    CREATE INDEX IF NOT EXISTS idx_ordenes_pt ON produccion_ordenes(codigo_producto_pt);
    CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON produccion_ordenes(estado);

    CREATE TABLE IF NOT EXISTS produccion_consumos_mp (
        id_consumo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_orden BIGINT NOT NULL REFERENCES produccion_ordenes(id_orden) ON DELETE CASCADE,
        codigo_insumo VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        cantidad_consumida NUMERIC(12,4) NOT NULL CHECK (cantidad_consumida > 0),
        costo_unitario NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
        subtotal_valorado NUMERIC(14,4) NOT NULL CHECK (subtotal_valorado >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_consumos_orden ON produccion_consumos_mp(id_orden);

    CREATE TABLE IF NOT EXISTS produccion_costos_adicionales (
        id_costo_adicional BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_orden BIGINT NOT NULL REFERENCES produccion_ordenes(id_orden) ON DELETE CASCADE,
        tipo_costo VARCHAR(10) NOT NULL,
        descripcion VARCHAR(150) NOT NULL,
        horas_hombre NUMERIC(8,2) NOT NULL DEFAULT 0.00 CHECK (horas_hombre >= 0),
        tarifa_hora NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
        monto_total NUMERIC(14,2) NOT NULL CHECK (monto_total >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_costos_adic_orden ON produccion_costos_adicionales(id_orden);
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initProduccionSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initProduccionSchema().catch(console.error);

// =====================================================================
// POST /api/produccion/recetas - Crear nueva receta de fabricación (BOM)
// =====================================================================
produccionRouter.post('/recetas', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      codigo_producto_pt,
      nombre_receta,
      descripcion,
      rendimiento_base = 1.00,
      insumos
    } = req.body;

    if (!codigo_producto_pt || !nombre_receta) {
      return res.status(400).json({ error: 'codigo_producto_pt y nombre_receta son obligatorios.' });
    }

    if (!insumos || !Array.isArray(insumos) || insumos.length === 0) {
      return res.status(400).json({ error: 'La receta debe incluir al menos un insumo en la lista de materiales.' });
    }

    // Verificar que el PT exista en productos
    const ptCheck = await client.query(`SELECT codigo_producto, descripcion FROM productos WHERE codigo_producto = $1`, [codigo_producto_pt]);
    if (ptCheck.rows.length === 0) {
      return res.status(404).json({ error: `El producto terminado ${codigo_producto_pt} no existe en el catálogo.` });
    }

    await client.query('BEGIN');

    // 1. Insertar Cabecera de Receta
    const insCab = await client.query(
      `INSERT INTO produccion_recetas_cabecera (
        codigo_producto_pt, nombre_receta, descripcion, rendimiento_base
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        codigo_producto_pt,
        nombre_receta.trim(),
        descripcion?.trim() || null,
        parseFloat(rendimiento_base) || 1.00
      ]
    );

    const receta = insCab.rows[0];
    const idReceta = receta.id_receta;
    const detalles: any[] = [];

    // 2. Insertar Detalle de Insumos
    for (const ins of insumos) {
      if (!ins.codigo_insumo || isNaN(Number(ins.cantidad_requerida)) || Number(ins.cantidad_requerida) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insumo ${ins.codigo_insumo || 'desconocido'} con cantidad requerida inválida.` });
      }

      const insCheck = await client.query(`SELECT codigo_producto, descripcion FROM productos WHERE codigo_producto = $1`, [ins.codigo_insumo]);
      if (insCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `El insumo ${ins.codigo_insumo} no existe en el catálogo.` });
      }

      const insDet = await client.query(
        `INSERT INTO produccion_recetas_detalle (
          id_receta, codigo_insumo, cantidad_requerida, merma_permitida_pct
        ) VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
          idReceta,
          ins.codigo_insumo,
          ins.cantidad_requerida,
          parseFloat(ins.merma_permitida_pct) || 0.00
        ]
      );

      detalles.push(insDet.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Receta de fabricación (BOM) registrada exitosamente.',
      receta,
      insumos: detalles
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/produccion/recetas]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar receta.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/produccion/recetas - Listar recetas con costo estimado teórico
// =====================================================================
produccionRouter.get('/recetas', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { codigo_producto_pt } = req.query;

    let sql = `
      SELECT r.*,
             p.descripcion AS producto_pt_descripcion,
             p.unidad_medida AS producto_pt_unidad,
             (SELECT COUNT(*) FROM produccion_recetas_detalle d WHERE d.id_receta = r.id_receta) AS total_insumos,
             COALESCE((
               SELECT SUM(d.cantidad_requerida * ins.precio_costo)
               FROM produccion_recetas_detalle d
               JOIN productos ins ON d.codigo_insumo = ins.codigo_producto
               WHERE d.id_receta = r.id_receta
             ), 0.00) AS costo_teorico_mp
      FROM produccion_recetas_cabecera r
      JOIN productos p ON r.codigo_producto_pt = p.codigo_producto
      WHERE r.activa = TRUE
    `;
    const params: any[] = [];

    if (codigo_producto_pt) {
      params.push(codigo_producto_pt);
      sql += ` AND r.codigo_producto_pt = $${params.length}`;
    }

    sql += ` ORDER BY r.id_receta DESC`;

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      recetas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/produccion/recetas]:', error);
    return res.status(500).json({ error: 'Error interno al listar recetas.' });
  }
});

// =====================================================================
// GET /api/produccion/recetas/:id - Detalle de receta con insumos
// =====================================================================
produccionRouter.get('/recetas/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT r.*, p.descripcion AS producto_pt_descripcion, p.unidad_medida
       FROM produccion_recetas_cabecera r
       JOIN productos p ON r.codigo_producto_pt = p.codigo_producto
       WHERE r.id_receta = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Receta no encontrada.' });
    }

    const detRes = await query(
      `SELECT d.*, p.descripcion AS insumo_descripcion, p.unidad_medida, p.precio_costo AS costo_catalogo
       FROM produccion_recetas_detalle d
       JOIN productos p ON d.codigo_insumo = p.codigo_producto
       WHERE d.id_receta = $1
       ORDER BY d.id_receta_detalle ASC`,
      [id]
    );

    return res.status(200).json({
      receta: cabRes.rows[0],
      insumos: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/produccion/recetas/:id]:', error);
    return res.status(500).json({ error: 'Error interno al obtener receta.' });
  }
});

// =====================================================================
// POST /api/produccion/ordenes - Emitir nueva orden de producción
// =====================================================================
produccionRouter.post('/ordenes', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      numero_orden,
      id_receta,
      id_sucursal,
      id_almacen_insumos,
      id_almacen_pt,
      cantidad_planificada,
      observaciones
    } = req.body;

    if (!numero_orden || !id_receta || !id_sucursal || !id_almacen_insumos || !id_almacen_pt || !cantidad_planificada) {
      return res.status(400).json({
        error: 'numero_orden, id_receta, id_sucursal, id_almacen_insumos, id_almacen_pt y cantidad_planificada son obligatorios.'
      });
    }

    if (Number(cantidad_planificada) <= 0) {
      return res.status(400).json({ error: 'cantidad_planificada debe ser mayor a cero.' });
    }

    // Verificar duplicidad de numero_orden
    const dupCheck = await query(`SELECT id_orden FROM produccion_ordenes WHERE numero_orden = $1`, [numero_orden.trim()]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: `La orden de producción Nro ${numero_orden} ya existe.` });
    }

    // Consultar receta para obtener el producto terminado
    const recCheck = await query(
      `SELECT id_receta, codigo_producto_pt, nombre_receta, rendimiento_base FROM produccion_recetas_cabecera WHERE id_receta = $1 AND activa = TRUE`,
      [id_receta]
    );

    if (recCheck.rows.length === 0) {
      return res.status(404).json({ error: `Receta con ID ${id_receta} no existe o no está activa.` });
    }

    const receta = recCheck.rows[0];

    const insOrden = await query(
      `INSERT INTO produccion_ordenes (
        numero_orden, id_receta, codigo_producto_pt, id_sucursal,
        id_almacen_insumos, id_almacen_pt, cantidad_planificada, estado, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PLANIFICADA', $8)
      RETURNING *`,
      [
        numero_orden.trim(),
        id_receta,
        receta.codigo_producto_pt,
        id_sucursal,
        id_almacen_insumos,
        id_almacen_pt,
        cantidad_planificada,
        observaciones?.trim() || null
      ]
    );

    return res.status(201).json({
      message: 'Orden de producción planificada exitosamente.',
      orden: insOrden.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/produccion/ordenes]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al emitir orden de producción.' });
  }
});

// =====================================================================
// POST /api/produccion/ordenes/:id/consumir-mp - Descargo de insumos a Kardex
// =====================================================================
produccionRouter.post('/ordenes/:id/consumir-mp', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { consumos } = req.body; // [{ codigo_insumo, cantidad_consumida }]

    if (!consumos || !Array.isArray(consumos) || consumos.length === 0) {
      return res.status(400).json({ error: 'Se debe enviar una lista de consumos con codigo_insumo y cantidad_consumida.' });
    }

    await client.query('BEGIN');

    const ordRes = await client.query(
      `SELECT * FROM produccion_ordenes WHERE id_orden = $1 FOR UPDATE`,
      [id]
    );

    if (ordRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orden de producción no encontrada.' });
    }

    const orden = ordRes.rows[0];

    if (['FINALIZADA', 'CANCELADA'].includes(orden.estado)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No se pueden registrar consumos en una orden ${orden.estado}.` });
    }

    // Si estaba PLANIFICADA, pasa a EN_PROCESO
    if (orden.estado === 'PLANIFICADA') {
      await client.query(
        `UPDATE produccion_ordenes SET estado = 'EN_PROCESO', fecha_inicio = CURRENT_TIMESTAMP WHERE id_orden = $1`,
        [id]
      );
    }

    let subtotalConsumosNuevo = 0;
    const consumosRegistrados: any[] = [];

    for (const c of consumos) {
      if (!c.codigo_insumo || isNaN(Number(c.cantidad_consumida)) || Number(c.cantidad_consumida) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Cantidad consumida inválida para insumo ${c.codigo_insumo || 'desconocido'}.` });
      }

      // Bloqueo y verificación de existencias en Kardex
      const kardexRes = await client.query(
        `SELECT saldo_cantidad, costo_unitario, saldo_valorado
         FROM kardex_movimientos
         WHERE codigo_producto = $1 AND id_almacen = $2
         ORDER BY id_kardex DESC
         LIMIT 1
         FOR UPDATE`,
        [c.codigo_insumo, orden.id_almacen_insumos]
      );

      const ultimo = kardexRes.rows[0];
      const stockDisponible = ultimo ? parseFloat(ultimo.saldo_cantidad) : 0.00;
      const costoUnitarioInsumo = ultimo ? parseFloat(ultimo.costo_unitario) : 0.00;

      if (stockDisponible < Number(c.cantidad_consumida)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: `Stock insuficiente en almacén de insumos para ${c.codigo_insumo}. Solicitado: ${c.cantidad_consumida}, Disponible: ${stockDisponible}`
        });
      }

      const cantConsumida = parseFloat(c.cantidad_consumida);
      const subtotalItem = cantConsumida * costoUnitarioInsumo;
      subtotalConsumosNuevo += subtotalItem;

      // 1. Descuento atómico en Kardex
      const nuevoSaldoCant = stockDisponible - cantConsumida;
      const nuevoSaldoVal = nuevoSaldoCant * costoUnitarioInsumo;

      await client.query(
        `INSERT INTO kardex_movimientos (
          id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
          cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
          saldo_valorado
        ) VALUES ($1, $2, 'PRODUCCION_SALIDA', $3, 0.00, $4, $5, $6, $7)`,
        [
          orden.id_almacen_insumos,
          c.codigo_insumo,
          id,
          cantConsumida,
          nuevoSaldoCant,
          costoUnitarioInsumo,
          nuevoSaldoVal
        ]
      );

      // 2. Registro en consumos de la orden
      const insConsumo = await client.query(
        `INSERT INTO produccion_consumos_mp (
          id_orden, codigo_insumo, cantidad_consumida, costo_unitario, subtotal_valorado
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          id,
          c.codigo_insumo,
          cantConsumida,
          costoUnitarioInsumo,
          subtotalItem
        ]
      );

      consumosRegistrados.push(insConsumo.rows[0]);
    }

    // Actualizar total MP de la orden
    const nuevoTotalMp = parseFloat(orden.costo_total_mp) + subtotalConsumosNuevo;
    const nuevoTotalFab = nuevoTotalMp + parseFloat(orden.costo_total_mod) + parseFloat(orden.costo_total_cif);

    await client.query(
      `UPDATE produccion_ordenes
       SET costo_total_mp = $1,
           costo_total_fabricacion = $2
       WHERE id_orden = $3`,
      [nuevoTotalMp, nuevoTotalFab, id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Materia prima consumida exitosamente y descargada del Kardex.',
      total_mp_acumulado: nuevoTotalMp,
      consumos: consumosRegistrados
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/produccion/ordenes/:id/consumir-mp]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al consumir materia prima.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/produccion/ordenes/:id/imputar-costos - Registrar MOD o CIF
// =====================================================================
produccionRouter.post('/ordenes/:id/imputar-costos', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { tipo_costo, descripcion, horas_hombre = 0, tarifa_hora = 0, monto_total } = req.body;

    if (!tipo_costo || !descripcion) {
      return res.status(400).json({ error: 'tipo_costo (MOD o CIF) y descripcion son obligatorios.' });
    }

    const tipoUpper = tipo_costo.toUpperCase();
    if (!['MOD', 'CIF'].includes(tipoUpper)) {
      return res.status(400).json({ error: "tipo_costo debe ser 'MOD' o 'CIF'." });
    }

    let montoCalculado = parseFloat(monto_total);
    const hh = parseFloat(horas_hombre) || 0;
    const tarifa = parseFloat(tarifa_hora) || 0;

    if (isNaN(montoCalculado) || montoCalculado <= 0) {
      if (hh > 0 && tarifa > 0) {
        montoCalculado = hh * tarifa;
      } else {
        return res.status(400).json({ error: 'Se requiere especificar monto_total o horas_hombre y tarifa_hora válidos.' });
      }
    }

    await client.query('BEGIN');

    const ordRes = await client.query(`SELECT * FROM produccion_ordenes WHERE id_orden = $1 FOR UPDATE`, [id]);
    if (ordRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    const orden = ordRes.rows[0];
    if (['FINALIZADA', 'CANCELADA'].includes(orden.estado)) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `No se pueden imputar costos a una orden ${orden.estado}.` });
    }

    // Insertar en costos adicionales
    const insAdic = await client.query(
      `INSERT INTO produccion_costos_adicionales (
        id_orden, tipo_costo, descripcion, horas_hombre, tarifa_hora, monto_total
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [id, tipoUpper, descripcion.trim(), hh, tarifa, montoCalculado]
    );

    let nuevoMod = parseFloat(orden.costo_total_mod);
    let nuevoCif = parseFloat(orden.costo_total_cif);

    if (tipoUpper === 'MOD') {
      nuevoMod += montoCalculado;
    } else {
      nuevoCif += montoCalculado;
    }

    const nuevoFab = parseFloat(orden.costo_total_mp) + nuevoMod + nuevoCif;

    await client.query(
      `UPDATE produccion_ordenes
       SET costo_total_mod = $1,
           costo_total_cif = $2,
           costo_total_fabricacion = $3
       WHERE id_orden = $4`,
      [nuevoMod, nuevoCif, nuevoFab, id]
    );

    await client.query('COMMIT');

    return res.status(201).json({
      message: `Costo ${tipoUpper} imputado exitosamente a la orden.`,
      costo_adicional: insAdic.rows[0],
      hoja_costos: {
        costo_total_mp: parseFloat(orden.costo_total_mp),
        costo_total_mod: nuevoMod,
        costo_total_cif: nuevoCif,
        costo_total_fabricacion: nuevoFab
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/produccion/ordenes/:id/imputar-costos]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al imputar costos.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/produccion/ordenes/:id/finalizar - Liquidación y entrada PT a Kardex
// =====================================================================
produccionRouter.post('/ordenes/:id/finalizar', requireRole('ADMIN', 'SUPERVISOR', 'ALMACENERO'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { cantidad_producida } = req.body;

    const cantProd = parseFloat(cantidad_producida);
    if (isNaN(cantProd) || cantProd <= 0) {
      return res.status(400).json({ error: 'cantidad_producida debe ser un número estrictamente mayor a cero.' });
    }

    await client.query('BEGIN');

    const ordRes = await client.query(
      `SELECT * FROM produccion_ordenes WHERE id_orden = $1 FOR UPDATE`,
      [id]
    );

    if (ordRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Orden no encontrada.' });
    }

    const orden = ordRes.rows[0];

    if (orden.estado === 'FINALIZADA') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'La orden de producción ya se encuentra finalizada previamente.' });
    }

    if (orden.estado === 'CANCELADA') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No se puede finalizar una orden cancelada.' });
    }

    const totalFab = parseFloat(orden.costo_total_fabricacion);
    if (totalFab <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La orden no tiene costos acumulados de fabricación (MP + MOD + CIF = 0).' });
    }

    // 1. Calcular Costo Unitario del Producto Terminado
    const costoUnitarioPt = totalFab / cantProd;

    // 2. Ingresar Producto Terminado al Kardex del almacén receptor
    const kardexPtRes = await client.query(
      `SELECT saldo_cantidad, saldo_valorado
       FROM kardex_movimientos
       WHERE codigo_producto = $1 AND id_almacen = $2
       ORDER BY id_kardex DESC
       LIMIT 1
       FOR UPDATE`,
      [orden.codigo_producto_pt, orden.id_almacen_pt]
    );

    const ultimoPt = kardexPtRes.rows[0];
    const prevCantPt = ultimoPt ? parseFloat(ultimoPt.saldo_cantidad) : 0.00;
    const prevValPt = ultimoPt ? parseFloat(ultimoPt.saldo_valorado) : 0.00;

    const nuevoCantPt = prevCantPt + cantProd;
    const nuevoValPt = prevValPt + totalFab;
    const nuevoCostoPonderadoPt = nuevoValPt / nuevoCantPt;

    await client.query(
      `INSERT INTO kardex_movimientos (
        id_almacen, codigo_producto, tipo_movimiento, id_documento_ref,
        cantidad_entrada, cantidad_salida, saldo_cantidad, costo_unitario,
        saldo_valorado
      ) VALUES ($1, $2, 'PRODUCCION_ENTRADA', $3, $4, 0.00, $5, $6, $7)`,
      [
        orden.id_almacen_pt,
        orden.codigo_producto_pt,
        id,
        cantProd,
        nuevoCantPt,
        nuevoCostoPonderadoPt,
        nuevoValPt
      ]
    );

    // 3. Actualizar precio_costo en el catálogo de productos
    await client.query(
      `UPDATE productos
       SET precio_costo = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE codigo_producto = $2`,
      [nuevoCostoPonderadoPt, orden.codigo_producto_pt]
    );

    // 4. Cerrar la Orden de Producción
    const updOrd = await client.query(
      `UPDATE produccion_ordenes
       SET estado = 'FINALIZADA',
           cantidad_producida = $1,
           costo_unitario_pt = $2,
           fecha_fin = CURRENT_TIMESTAMP
       WHERE id_orden = $3
       RETURNING *`,
      [cantProd, costoUnitarioPt, id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Orden de producción liquidada exitosamente e ingresada a Kardex.',
      orden: updOrd.rows[0],
      liquidacion: {
        cantidad_producida: cantProd,
        costo_total_mp: parseFloat(orden.costo_total_mp),
        costo_total_mod: parseFloat(orden.costo_total_mod),
        costo_total_cif: parseFloat(orden.costo_total_cif),
        costo_total_fabricacion: totalFab,
        costo_unitario_pt_liquidado: parseFloat(costoUnitarioPt.toFixed(4)),
        nuevo_costo_ponderado_catalogo: parseFloat(nuevoCostoPonderadoPt.toFixed(4))
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/produccion/ordenes/:id/finalizar]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al finalizar orden.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/produccion/ordenes - Listar órdenes de producción
// =====================================================================
produccionRouter.get('/ordenes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { estado, codigo_producto_pt, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT o.*,
             p.descripcion AS producto_pt_descripcion,
             r.nombre_receta,
             s.nombre AS sucursal_nombre,
             ai.nombre AS almacen_insumos_nombre,
             ap.nombre AS almacen_pt_nombre
      FROM produccion_ordenes o
      JOIN productos p ON o.codigo_producto_pt = p.codigo_producto
      JOIN produccion_recetas_cabecera r ON o.id_receta = r.id_receta
      JOIN sucursales s ON o.id_sucursal = s.id_sucursal
      JOIN almacenes ai ON o.id_almacen_insumos = ai.id_almacen
      JOIN almacenes ap ON o.id_almacen_pt = ap.id_almacen
      WHERE 1=1
    `;
    const params: any[] = [];

    if (estado) {
      params.push(estado.toString().toUpperCase());
      sql += ` AND o.estado = $${params.length}`;
    }

    if (codigo_producto_pt) {
      params.push(codigo_producto_pt);
      sql += ` AND o.codigo_producto_pt = $${params.length}`;
    }

    sql += ` ORDER BY o.id_orden DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      ordenes: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/produccion/ordenes]:', error);
    return res.status(500).json({ error: 'Error interno al consultar órdenes.' });
  }
});

// =====================================================================
// GET /api/produccion/ordenes/:id - Detalle completo y hoja de costos
// =====================================================================
produccionRouter.get('/ordenes/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const ordRes = await query(
      `SELECT o.*,
              p.descripcion AS producto_pt_descripcion,
              p.unidad_medida,
              r.nombre_receta,
              s.nombre AS sucursal_nombre,
              ai.nombre AS almacen_insumos_nombre,
              ap.nombre AS almacen_pt_nombre
       FROM produccion_ordenes o
       JOIN productos p ON o.codigo_producto_pt = p.codigo_producto
       JOIN produccion_recetas_cabecera r ON o.id_receta = r.id_receta
       JOIN sucursales s ON o.id_sucursal = s.id_sucursal
       JOIN almacenes ai ON o.id_almacen_insumos = ai.id_almacen
       JOIN almacenes ap ON o.id_almacen_pt = ap.id_almacen
       WHERE o.id_orden = $1`,
      [id]
    );

    if (ordRes.rows.length === 0) {
      return res.status(404).json({ error: 'Orden de producción no encontrada.' });
    }

    const consumosRes = await query(
      `SELECT c.*, p.descripcion AS insumo_descripcion, p.unidad_medida
       FROM produccion_consumos_mp c
       JOIN productos p ON c.codigo_insumo = p.codigo_producto
       WHERE c.id_orden = $1
       ORDER BY c.id_consumo ASC`,
      [id]
    );

    const costosAdicRes = await query(
      `SELECT * FROM produccion_costos_adicionales WHERE id_orden = $1 ORDER BY id_costo_adicional ASC`,
      [id]
    );

    return res.status(200).json({
      orden: ordRes.rows[0],
      consumos_materia_prima: consumosRes.rows,
      costos_adicionales_mod_cif: costosAdicRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/produccion/ordenes/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de orden.' });
  }
});
