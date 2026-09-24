import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const contabilidadRouter = Router();

// Todas las rutas contables requieren autenticación JWT
contabilidadRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema contable y plan de cuentas estándar
 */
export async function initContabilidadSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS plan_cuentas (
        id_cuenta INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        codigo_cuenta VARCHAR(30) NOT NULL UNIQUE,
        nombre_cuenta VARCHAR(150) NOT NULL,
        tipo_cuenta VARCHAR(20) NOT NULL CHECK (tipo_cuenta IN ('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO')),
        nivel INT NOT NULL DEFAULT 1 CHECK (nivel >= 1),
        es_imputable BOOLEAN NOT NULL DEFAULT TRUE,
        id_cuenta_padre INT REFERENCES plan_cuentas(id_cuenta) ON DELETE RESTRICT,
        activo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_plan_cuentas_codigo ON plan_cuentas(codigo_cuenta);
    CREATE INDEX IF NOT EXISTS idx_plan_cuentas_tipo ON plan_cuentas(tipo_cuenta);
    CREATE INDEX IF NOT EXISTS idx_plan_cuentas_imputable ON plan_cuentas(es_imputable);

    CREATE TABLE IF NOT EXISTS asientos_cabecera (
        id_asiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        numero_asiento VARCHAR(50) NOT NULL UNIQUE,
        tipo_asiento VARCHAR(20) NOT NULL CHECK (tipo_asiento IN ('INGRESO', 'EGRESO', 'TRASPASO', 'APERTURA', 'AJUSTE')),
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        fecha_asiento DATE NOT NULL DEFAULT CURRENT_DATE,
        glosa_general TEXT NOT NULL,
        total_debe NUMERIC(14,2) NOT NULL CHECK (total_debe >= 0),
        total_haber NUMERIC(14,2) NOT NULL CHECK (total_haber >= 0),
        estado VARCHAR(20) NOT NULL DEFAULT 'ASENTADO' CHECK (estado IN ('ASENTADO', 'ANULADO')),
        modulo_origen VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
        id_documento_origen BIGINT,
        id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        motivo_anulacion TEXT,
        fecha_anulacion TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_asientos_fecha ON asientos_cabecera(fecha_asiento);
    CREATE INDEX IF NOT EXISTS idx_asientos_tipo ON asientos_cabecera(tipo_asiento);
    CREATE INDEX IF NOT EXISTS idx_asientos_estado ON asientos_cabecera(estado);

    CREATE TABLE IF NOT EXISTS asientos_detalle (
        id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_asiento BIGINT NOT NULL REFERENCES asientos_cabecera(id_asiento) ON DELETE CASCADE,
        id_cuenta INT NOT NULL REFERENCES plan_cuentas(id_cuenta) ON DELETE RESTRICT,
        glosa_detalle TEXT,
        debe NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (debe >= 0),
        haber NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (haber >= 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT chk_debe_haber_valido CHECK (debe > 0 OR haber > 0)
    );

    CREATE INDEX IF NOT EXISTS idx_asientos_det_asiento ON asientos_detalle(id_asiento);
    CREATE INDEX IF NOT EXISTS idx_asientos_det_cuenta ON asientos_detalle(id_cuenta);

    -- Seed de cuentas estándar bolivianas
    INSERT INTO plan_cuentas (codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, es_imputable)
    VALUES
        ('1', 'ACTIVO', 'ACTIVO', 1, FALSE),
        ('1.1', 'ACTIVO CORRIENTE', 'ACTIVO', 2, FALSE),
        ('1.1.1', 'DISPONIBILIDADES', 'ACTIVO', 3, FALSE),
        ('1.1.1.01', 'Caja Moneda Nacional', 'ACTIVO', 4, FALSE),
        ('1.1.1.01.001', 'Caja General - Santa Cruz', 'ACTIVO', 5, TRUE),
        ('1.1.1.02', 'Bancos Moneda Nacional', 'ACTIVO', 4, FALSE),
        ('1.1.1.02.001', 'Banco Mercantil Santa Cruz M/N', 'ACTIVO', 5, TRUE),
        ('1.1.2', 'EXIGIBLE / CRÉDITOS', 'ACTIVO', 3, FALSE),
        ('1.1.2.01', 'Cuentas por Cobrar Comerciales', 'ACTIVO', 4, FALSE),
        ('1.1.2.01.001', 'Cuentas por Cobrar Clientes M/N', 'ACTIVO', 5, TRUE),
        ('1.1.2.02', 'Crédito Fiscal IVA', 'ACTIVO', 4, FALSE),
        ('1.1.2.02.001', 'Crédito Fiscal IVA 13%', 'ACTIVO', 5, TRUE),
        ('1.1.3', 'REALIZABLE / INVENTARIOS', 'ACTIVO', 3, FALSE),
        ('1.1.3.01', 'Inventario de Mercaderías', 'ACTIVO', 4, FALSE),
        ('1.1.3.01.001', 'Inventario de Repuestos y Maquinaria', 'ACTIVO', 5, TRUE),
        ('1.1.3.02', 'Inventario de Materias Primas', 'ACTIVO', 4, FALSE),
        ('1.1.3.02.001', 'Materias Primas e Insumos Fabriles', 'ACTIVO', 5, TRUE),
        ('2', 'PASIVO', 'PASIVO', 1, FALSE),
        ('2.1', 'PASIVO CORRIENTE', 'PASIVO', 2, FALSE),
        ('2.1.1', 'OBLIGACIONES COMERCIALES', 'PASIVO', 3, FALSE),
        ('2.1.1.01', 'Cuentas por Pagar Proveedores', 'PASIVO', 4, FALSE),
        ('2.1.1.01.001', 'Cuentas por Pagar Proveedores Nacionales', 'PASIVO', 5, TRUE),
        ('2.1.1.01.002', 'Cuentas por Pagar Proveedores Extranjeros', 'PASIVO', 5, TRUE),
        ('2.1.2', 'OBLIGACIONES FISCALES Y TRIBUTARIAS', 'PASIVO', 3, FALSE),
        ('2.1.2.01', 'Débito Fiscal IVA', 'PASIVO', 4, FALSE),
        ('2.1.2.01.001', 'Débito Fiscal IVA 13% por Pagar', 'PASIVO', 5, TRUE),
        ('2.1.2.02', 'Impuesto a las Transacciones por Pagar', 'PASIVO', 4, FALSE),
        ('2.1.2.02.001', 'IT por Pagar 3%', 'PASIVO', 5, TRUE),
        ('3', 'PATRIMONIO NETO', 'PATRIMONIO', 1, FALSE),
        ('3.1', 'CAPITAL SOCIAL', 'PATRIMONIO', 2, FALSE),
        ('3.1.1.01.001', 'Capital Social DIREMOR S.R.L.', 'PATRIMONIO', 3, TRUE),
        ('4', 'INGRESOS', 'INGRESO', 1, FALSE),
        ('4.1', 'INGRESOS OPERATIVOS', 'INGRESO', 2, FALSE),
        ('4.1.1.01.001', 'Ventas Netas de Mercaderías (87%)', 'INGRESO', 3, TRUE),
        ('4.1.2.01.001', 'Servicios de Maquila y Fabricación', 'INGRESO', 3, TRUE),
        ('5', 'COSTOS DE VENTA Y PRODUCCIÓN', 'COSTO', 1, FALSE),
        ('5.1', 'COSTO DE VENTAS', 'COSTO', 2, FALSE),
        ('5.1.1.01.001', 'Costo de Mercaderías Vendidas', 'COSTO', 3, TRUE),
        ('6', 'GASTOS OPERATIVOS', 'GASTO', 1, FALSE),
        ('6.1', 'GASTOS DE COMERCIALIZACIÓN Y TRIBUTARIOS', 'GASTO', 2, FALSE),
        ('6.1.1.01.001', 'Impuesto a las Transacciones (Gasto 3%)', 'GASTO', 3, TRUE),
        ('6.1.2.01.001', 'Gastos Generales de Administración', 'GASTO', 3, TRUE)
    ON CONFLICT (codigo_cuenta) DO NOTHING;
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initContabilidadSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initContabilidadSchema().catch(console.error);

// =====================================================================
// GET /api/contabilidad/cuentas - Listar Plan de Cuentas
// =====================================================================
contabilidadRouter.get('/cuentas', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tipo, es_imputable, q } = req.query;

    let sql = `SELECT * FROM plan_cuentas WHERE activo = TRUE`;
    const params: any[] = [];

    if (tipo) {
      params.push(tipo.toString().toUpperCase());
      sql += ` AND tipo_cuenta = $${params.length}`;
    }

    if (es_imputable !== undefined) {
      params.push(es_imputable === 'true');
      sql += ` AND es_imputable = $${params.length}`;
    }

    if (q) {
      params.push(`%${q.toString().trim()}%`);
      sql += ` AND (codigo_cuenta ILIKE $${params.length} OR nombre_cuenta ILIKE $${params.length})`;
    }

    sql += ` ORDER BY codigo_cuenta ASC`;

    const result = await query(sql, params);
    return res.status(200).json({
      total: result.rows.length,
      cuentas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/cuentas]:', error);
    return res.status(500).json({ error: 'Error interno al consultar plan de cuentas.' });
  }
});

// =====================================================================
// POST /api/contabilidad/cuentas - Crear Cuenta Contable
// =====================================================================
contabilidadRouter.post('/cuentas', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      codigo_cuenta,
      nombre_cuenta,
      tipo_cuenta,
      nivel = 5,
      es_imputable = true,
      id_cuenta_padre
    } = req.body;

    if (!codigo_cuenta || !nombre_cuenta || !tipo_cuenta) {
      return res.status(400).json({ error: 'codigo_cuenta, nombre_cuenta y tipo_cuenta son obligatorios.' });
    }

    const tipoUpper = tipo_cuenta.toUpperCase();
    const tiposValidos = ['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO'];
    if (!tiposValidos.includes(tipoUpper)) {
      return res.status(400).json({ error: `tipo_cuenta no válido. Opciones: ${tiposValidos.join(', ')}` });
    }

    // Verificar unicidad
    const dup = await query(`SELECT id_cuenta FROM plan_cuentas WHERE codigo_cuenta = $1`, [codigo_cuenta.trim()]);
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: `El código de cuenta ${codigo_cuenta} ya existe.` });
    }

    const insRes = await query(
      `INSERT INTO plan_cuentas (
        codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, es_imputable, id_cuenta_padre
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        codigo_cuenta.trim(),
        nombre_cuenta.trim(),
        tipoUpper,
        parseInt(nivel, 10) || 5,
        Boolean(es_imputable),
        id_cuenta_padre || null
      ]
    );

    return res.status(201).json({
      message: 'Cuenta contable creada exitosamente.',
      cuenta: insRes.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en POST /api/contabilidad/cuentas]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar cuenta contable.' });
  }
});

// =====================================================================
// GET /api/contabilidad/libro-diario - Reporte de Libro Diario Cronológico
// =====================================================================
contabilidadRouter.get('/libro-diario', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fecha_inicio, fecha_fin, tipo_asiento, id_sucursal } = req.query;

    let sql = `
      SELECT a.id_asiento,
             a.numero_asiento,
             a.tipo_asiento,
             a.fecha_asiento,
             a.glosa_general,
             a.total_debe,
             a.total_haber,
             a.estado,
             a.modulo_origen,
             s.nombre AS sucursal_nombre,
             u.nombre_completo AS usuario_nombre,
             json_agg(
               json_build_object(
                 'id_detalle', d.id_detalle,
                 'id_cuenta', d.id_cuenta,
                 'codigo_cuenta', pc.codigo_cuenta,
                 'nombre_cuenta', pc.nombre_cuenta,
                 'glosa_detalle', d.glosa_detalle,
                 'debe', d.debe,
                 'haber', d.haber
               ) ORDER BY d.id_detalle ASC
             ) AS partidas
      FROM asientos_cabecera a
      JOIN sucursales s ON a.id_sucursal = s.id_sucursal
      JOIN usuarios u ON a.id_usuario = u.id_usuario
      JOIN asientos_detalle d ON a.id_asiento = d.id_asiento
      JOIN plan_cuentas pc ON d.id_cuenta = pc.id_cuenta
      WHERE 1=1
    `;
    const params: any[] = [];

    if (fecha_inicio) {
      params.push(fecha_inicio);
      sql += ` AND a.fecha_asiento >= $${params.length}`;
    }

    if (fecha_fin) {
      params.push(fecha_fin);
      sql += ` AND a.fecha_asiento <= $${params.length}`;
    }

    if (tipo_asiento) {
      params.push(tipo_asiento.toString().toUpperCase());
      sql += ` AND a.tipo_asiento = $${params.length}`;
    }

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND a.id_sucursal = $${params.length}`;
    }

    sql += `
      GROUP BY a.id_asiento, a.numero_asiento, a.tipo_asiento, a.fecha_asiento,
               a.glosa_general, a.total_debe, a.total_haber, a.estado, a.modulo_origen,
               s.nombre, u.nombre_completo
      ORDER BY a.fecha_asiento ASC, a.id_asiento ASC
    `;

    const result = await query(sql, params);

    const totalDebeGeneral = result.rows.reduce((acc, r) => acc + parseFloat(r.total_debe), 0);
    const totalHaberGeneral = result.rows.reduce((acc, r) => acc + parseFloat(r.total_haber), 0);

    return res.status(200).json({
      total_comprobantes: result.rows.length,
      suma_total_debe: parseFloat(totalDebeGeneral.toFixed(2)),
      suma_total_haber: parseFloat(totalHaberGeneral.toFixed(2)),
      comprobantes: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/libro-diario]:', error);
    return res.status(500).json({ error: 'Error interno al consultar libro diario.' });
  }
});

// =====================================================================
// GET /api/contabilidad/libro-mayor - Reporte de Libro Mayor
// =====================================================================
contabilidadRouter.get('/libro-mayor', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id_cuenta, fecha_inicio, fecha_fin } = req.query;

    let sql = `
      SELECT d.id_detalle,
             d.id_asiento,
             a.numero_asiento,
             a.tipo_asiento,
             a.fecha_asiento,
             a.glosa_general,
             d.id_cuenta,
             pc.codigo_cuenta,
             pc.nombre_cuenta,
             pc.tipo_cuenta,
             d.glosa_detalle,
             d.debe,
             d.haber
      FROM asientos_detalle d
      JOIN asientos_cabecera a ON d.id_asiento = a.id_asiento
      JOIN plan_cuentas pc ON d.id_cuenta = pc.id_cuenta
      WHERE a.estado = 'ASENTADO'
    `;
    const params: any[] = [];

    if (id_cuenta) {
      params.push(id_cuenta);
      sql += ` AND d.id_cuenta = $${params.length}`;
    }

    if (fecha_inicio) {
      params.push(fecha_inicio);
      sql += ` AND a.fecha_asiento >= $${params.length}`;
    }

    if (fecha_fin) {
      params.push(fecha_fin);
      sql += ` AND a.fecha_asiento <= $${params.length}`;
    }

    sql += ` ORDER BY pc.codigo_cuenta ASC, a.fecha_asiento ASC, d.id_detalle ASC`;

    const result = await query(sql, params);

    // Agrupar por cuenta y calcular saldos dinámicos
    const cuentasMap: { [key: string]: any } = {};

    for (const mov of result.rows) {
      const cod = mov.codigo_cuenta;
      if (!cuentasMap[cod]) {
        cuentasMap[cod] = {
          id_cuenta: mov.id_cuenta,
          codigo_cuenta: mov.codigo_cuenta,
          nombre_cuenta: mov.nombre_cuenta,
          tipo_cuenta: mov.tipo_cuenta,
          total_debe: 0,
          total_haber: 0,
          saldo_final: 0,
          movimientos: []
        };
      }

      const debeNum = parseFloat(mov.debe);
      const haberNum = parseFloat(mov.haber);
      cuentasMap[cod].total_debe += debeNum;
      cuentasMap[cod].total_haber += haberNum;

      // Naturaleza contable: Deudora para ACTIVO, COSTO, GASTO. Acreedora para PASIVO, PATRIMONIO, INGRESO.
      const naturalezaDeudora = ['ACTIVO', 'COSTO', 'GASTO'].includes(mov.tipo_cuenta);
      const saldoAcumulado = naturalezaDeudora
        ? cuentasMap[cod].total_debe - cuentasMap[cod].total_haber
        : cuentasMap[cod].total_haber - cuentasMap[cod].total_debe;

      cuentasMap[cod].saldo_final = parseFloat(saldoAcumulado.toFixed(2));
      cuentasMap[cod].movimientos.push({
        ...mov,
        saldo_acumulado: parseFloat(saldoAcumulado.toFixed(2))
      });
    }

    return res.status(200).json({
      total_cuentas: Object.keys(cuentasMap).length,
      libro_mayor: Object.values(cuentasMap)
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/libro-mayor]:', error);
    return res.status(500).json({ error: 'Error interno al consultar libro mayor.' });
  }
});

// =====================================================================
// GET /api/contabilidad/balance-sumas-saldos - Balance de Comprobación
// =====================================================================
contabilidadRouter.get('/balance-sumas-saldos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { fecha_corte } = req.query;

    let sql = `
      SELECT pc.id_cuenta,
             pc.codigo_cuenta,
             pc.nombre_cuenta,
             pc.tipo_cuenta,
             COALESCE(SUM(d.debe), 0.00) AS total_debe,
             COALESCE(SUM(d.haber), 0.00) AS total_haber
      FROM plan_cuentas pc
      LEFT JOIN asientos_detalle d ON pc.id_cuenta = d.id_cuenta
      LEFT JOIN asientos_cabecera a ON d.id_asiento = a.id_asiento AND a.estado = 'ASENTADO'
      WHERE pc.es_imputable = TRUE
    `;
    const params: any[] = [];

    if (fecha_corte) {
      params.push(fecha_corte);
      sql += ` AND (a.fecha_asiento <= $${params.length} OR a.fecha_asiento IS NULL)`;
    }

    sql += `
      GROUP BY pc.id_cuenta, pc.codigo_cuenta, pc.nombre_cuenta, pc.tipo_cuenta
      HAVING COALESCE(SUM(d.debe), 0.00) > 0 OR COALESCE(SUM(d.haber), 0.00) > 0
      ORDER BY pc.codigo_cuenta ASC
    `;

    const result = await query(sql, params);

    let sumasDebe = 0;
    let sumasHaber = 0;
    let saldosDeudores = 0;
    let saldosAcreedores = 0;

    const filas = result.rows.map((row) => {
      const debe = parseFloat(row.total_debe);
      const haber = parseFloat(row.total_haber);

      sumasDebe += debe;
      sumasHaber += haber;

      let saldoDeudor = 0;
      let saldoAcreedor = 0;

      if (debe >= haber) {
        saldoDeudor = parseFloat((debe - haber).toFixed(2));
      } else {
        saldoAcreedor = parseFloat((haber - debe).toFixed(2));
      }

      saldosDeudores += saldoDeudor;
      saldosAcreedores += saldoAcreedor;

      return {
        id_cuenta: row.id_cuenta,
        codigo_cuenta: row.codigo_cuenta,
        nombre_cuenta: row.nombre_cuenta,
        tipo_cuenta: row.tipo_cuenta,
        suma_debe: debe,
        suma_haber: haber,
        saldo_deudor: saldoDeudor,
        saldo_acreedor: saldoAcreedor
      };
    });

    const cuadrado =
      Math.abs(sumasDebe - sumasHaber) < 0.01 &&
      Math.abs(saldosDeudores - saldosAcreedores) < 0.01;

    return res.status(200).json({
      fecha_corte: fecha_corte || new Date().toISOString().slice(0, 10),
      total_cuentas: filas.length,
      esta_cuadrado: cuadrado,
      totales: {
        suma_debe: parseFloat(sumasDebe.toFixed(2)),
        suma_haber: parseFloat(sumasHaber.toFixed(2)),
        saldo_deudor: parseFloat(saldosDeudores.toFixed(2)),
        saldo_acreedor: parseFloat(saldosAcreedores.toFixed(2))
      },
      cuentas: filas
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/balance-sumas-saldos]:', error);
    return res.status(500).json({ error: 'Error interno al generar balance de comprobación.' });
  }
});

// =====================================================================
// GET /api/contabilidad/libros-fiscales/ventas-iva - Libro de Ventas IVA (SIN)
// =====================================================================
contabilidadRouter.get('/libros-fiscales/ventas-iva', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mes, anio } = req.query;

    const fechaFiltro = anio && mes
      ? `${anio}-${mes.toString().padStart(2, '0')}-01`
      : new Date().toISOString().slice(0, 7) + '-01';

    const result = await query(
      `SELECT f.id_factura,
              f.numero_factura,
              f.cuf,
              f.cufd,
              f.fecha_emision,
              f.estado_sin,
              v.id_venta,
              v.total_neto AS importe_total,
              v.descuento,
              c.nit_ci AS nit_cliente,
              c.razon_social AS razon_social_cliente,
              ROUND((v.total_neto * 0.13), 2) AS debito_fiscal_iva,
              ROUND((v.total_neto * 0.03), 2) AS impuesto_transacciones_it
       FROM facturas_fiscales f
       JOIN ventas_cabecera v ON f.id_venta = v.id_venta
       JOIN clientes c ON v.id_cliente = c.id_cliente
       WHERE date_trunc('month', f.fecha_emision) = date_trunc('month', $1::date)
       ORDER BY f.numero_factura ASC`,
      [fechaFiltro]
    );

    const totalVentas = result.rows.reduce((acc, r) => acc + (r.estado_sin === 'VALIDA' ? parseFloat(r.importe_total) : 0), 0);
    const totalDebitoIVA = result.rows.reduce((acc, r) => acc + (r.estado_sin === 'VALIDA' ? parseFloat(r.debito_fiscal_iva) : 0), 0);
    const totalIT = result.rows.reduce((acc, r) => acc + (r.estado_sin === 'VALIDA' ? parseFloat(r.impuesto_transacciones_it) : 0), 0);

    return res.status(200).json({
      periodo: fechaFiltro.slice(0, 7),
      total_facturas: result.rows.length,
      totales_consolidados: {
        total_ventas_validas: parseFloat(totalVentas.toFixed(2)),
        total_debito_fiscal_iva: parseFloat(totalDebitoIVA.toFixed(2)),
        total_impuesto_transacciones: parseFloat(totalIT.toFixed(2))
      },
      ventas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/libros-fiscales/ventas-iva]:', error);
    return res.status(500).json({ error: 'Error interno al consultar libro de ventas IVA.' });
  }
});

// =====================================================================
// GET /api/contabilidad/libros-fiscales/compras-iva - Libro de Compras IVA (SIN)
// =====================================================================
contabilidadRouter.get('/libros-fiscales/compras-iva', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { mes, anio } = req.query;

    const fechaFiltro = anio && mes
      ? `${anio}-${mes.toString().padStart(2, '0')}-01`
      : new Date().toISOString().slice(0, 7) + '-01';

    const result = await query(
      `SELECT c.id_compra,
              c.tipo_compra,
              c.numero_factura_proveedor,
              dui.numero_poliza_dui AS numero_dui,
              c.fecha_compra,
              c.monto_total_neto AS importe_total,
              p.nit_ci AS nit_proveedor,
              p.razon_social AS razon_social_proveedor,
              ROUND((c.monto_total_neto * 0.13), 2) AS credito_fiscal_iva
       FROM compras_cabecera c
       JOIN proveedores p ON c.id_proveedor = p.id_proveedor
       LEFT JOIN importaciones_dui dui ON c.id_compra = dui.id_compra
       WHERE date_trunc('month', c.fecha_compra) = date_trunc('month', $1::date)
       ORDER BY c.fecha_compra ASC, c.id_compra ASC`,
      [fechaFiltro]
    );

    const totalCompras = result.rows.reduce((acc, r) => acc + parseFloat(r.importe_total), 0);
    const totalCreditoIVA = result.rows.reduce((acc, r) => acc + parseFloat(r.credito_fiscal_iva), 0);

    return res.status(200).json({
      periodo: fechaFiltro.slice(0, 7),
      total_compras: result.rows.length,
      totales_consolidados: {
        total_compras: parseFloat(totalCompras.toFixed(2)),
        total_credito_fiscal_iva: parseFloat(totalCreditoIVA.toFixed(2))
      },
      compras: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/libros-fiscales/compras-iva]:', error);
    return res.status(500).json({ error: 'Error interno al consultar libro de compras IVA.' });
  }
});

// =====================================================================
// POST /api/contabilidad/asientos - Registrar Asiento Contable Balanceado
// =====================================================================
contabilidadRouter.post('/asientos', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      numero_asiento,
      tipo_asiento = 'TRASPASO',
      id_sucursal = 1,
      fecha_asiento,
      glosa_general,
      modulo_origen = 'MANUAL',
      id_documento_origen,
      partidas
    } = req.body;

    if (!glosa_general || !partidas || !Array.isArray(partidas) || partidas.length < 2) {
      return res.status(400).json({
        error: 'glosa_general y al menos 2 partidas (débito y crédito) son obligatorias.'
      });
    }

    const tipoUpper = tipo_asiento.toUpperCase();
    const tiposValidos = ['INGRESO', 'EGRESO', 'TRASPASO', 'APERTURA', 'AJUSTE'];
    if (!tiposValidos.includes(tipoUpper)) {
      return res.status(400).json({ error: `tipo_asiento no válido. Opciones: ${tiposValidos.join(', ')}` });
    }

    // 1. Validaciones de Partida Doble en memoria
    let totalDebe = 0;
    let totalHaber = 0;

    for (let i = 0; i < partidas.length; i++) {
      const p = partidas[i];
      const debe = parseFloat(p.debe || 0);
      const haber = parseFloat(p.haber || 0);

      if (isNaN(debe) || isNaN(haber) || (debe <= 0 && haber <= 0) || (debe > 0 && haber > 0)) {
        return res.status(400).json({
          error: `Partida ${i + 1} inválida: debe indicar un importe positivo en Debe O en Haber (no ambos ni cero).`
        });
      }

      totalDebe += debe;
      totalHaber += haber;
    }

    // Comprobación de cuadre con tolerancia a centavos
    const diferencia = Math.abs(totalDebe - totalHaber);
    if (diferencia >= 0.01) {
      return res.status(400).json({
        error: `El asiento no cumple con el principio de partida doble. Total Debe (${totalDebe.toFixed(2)} Bs) != Total Haber (${totalHaber.toFixed(2)} Bs). Diferencia: ${diferencia.toFixed(2)} Bs.`
      });
    }

    // 2. Validar que cada cuenta exista y sea imputable
    const cuentasIds = partidas.map((p) => p.id_cuenta);
    const cuentasDb = await client.query(
      `SELECT id_cuenta, codigo_cuenta, nombre_cuenta, es_imputable, activo FROM plan_cuentas WHERE id_cuenta = ANY($1::int[])`,
      [cuentasIds]
    );

    const cuentasMap = new Map<number, any>();
    cuentasDb.rows.forEach((c) => cuentasMap.set(c.id_cuenta, c));

    for (let i = 0; i < partidas.length; i++) {
      const idCta = partidas[i].id_cuenta;
      const cta = cuentasMap.get(idCta);
      if (!cta || !cta.activo) {
        return res.status(400).json({ error: `La cuenta ID ${idCta} en partida ${i + 1} no existe o está inactiva.` });
      }
      if (!cta.es_imputable) {
        return res.status(400).json({
          error: `La cuenta ${cta.codigo_cuenta} - ${cta.nombre_cuenta} no es imputable (es cuenta agrupadora de nivel superior).`
        });
      }
    }

    await client.query('BEGIN');

    // Generar correlativo si no fue provisto
    let numAsiento = numero_asiento;
    if (!numAsiento) {
      const year = new Date().getFullYear();
      const countRes = await client.query(`SELECT COUNT(*) FROM asientos_cabecera WHERE EXTRACT(YEAR FROM fecha_asiento) = $1`, [year]);
      const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
      const pref = tipoUpper.slice(0, 3);
      numAsiento = `COMP-${pref}-${year}-${String(nextSeq).padStart(5, '0')}`;
    }

    const insCab = await client.query(
      `INSERT INTO asientos_cabecera (
        numero_asiento, tipo_asiento, id_sucursal, fecha_asiento,
        glosa_general, total_debe, total_haber, estado,
        modulo_origen, id_documento_origen, id_usuario
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ASENTADO', $8, $9, $10)
      RETURNING *`,
      [
        numAsiento.trim(),
        tipoUpper,
        id_sucursal,
        fecha_asiento || new Date().toISOString().slice(0, 10),
        glosa_general.trim(),
        parseFloat(totalDebe.toFixed(2)),
        parseFloat(totalHaber.toFixed(2)),
        modulo_origen,
        id_documento_origen || null,
        req.user?.id_usuario || 1
      ]
    );

    const asientoId = insCab.rows[0].id_asiento;
    const detallesInsertados = [];

    for (const p of partidas) {
      const dRes = await client.query(
        `INSERT INTO asientos_detalle (
          id_asiento, id_cuenta, glosa_detalle, debe, haber
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [
          asientoId,
          p.id_cuenta,
          p.glosa_detalle?.trim() || glosa_general.trim(),
          parseFloat(p.debe || 0),
          parseFloat(p.haber || 0)
        ]
      );
      detallesInsertados.push(dRes.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Asiento contable registrado exitosamente y balanceado.',
      asiento: insCab.rows[0],
      partidas: detallesInsertados
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/contabilidad/asientos]:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'El número de asiento especificado ya existe.' });
    }
    return res.status(500).json({ error: error.message || 'Error interno al registrar asiento contable.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/contabilidad/asientos - Listar Asientos Contables
// =====================================================================
contabilidadRouter.get('/asientos', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tipo_asiento, estado, fecha_inicio, fecha_fin, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT a.*,
             s.nombre AS sucursal_nombre,
             u.nombre_completo AS usuario_nombre,
             (SELECT COUNT(*) FROM asientos_detalle WHERE id_asiento = a.id_asiento) AS total_partidas
      FROM asientos_cabecera a
      JOIN sucursales s ON a.id_sucursal = s.id_sucursal
      JOIN usuarios u ON a.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tipo_asiento) {
      params.push(tipo_asiento.toString().toUpperCase());
      sql += ` AND a.tipo_asiento = $${params.length}`;
    }

    if (estado) {
      params.push(estado.toString().toUpperCase());
      sql += ` AND a.estado = $${params.length}`;
    }

    if (fecha_inicio) {
      params.push(fecha_inicio);
      sql += ` AND a.fecha_asiento >= $${params.length}`;
    }

    if (fecha_fin) {
      params.push(fecha_fin);
      sql += ` AND a.fecha_asiento <= $${params.length}`;
    }

    sql += ` ORDER BY a.fecha_asiento DESC, a.id_asiento DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);
    return res.status(200).json({
      total: result.rows.length,
      asientos: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/asientos]:', error);
    return res.status(500).json({ error: 'Error interno al consultar asientos contables.' });
  }
});

// =====================================================================
// GET /api/contabilidad/asientos/:id - Detalle de Asiento Contable
// =====================================================================
contabilidadRouter.get('/asientos/:id(\\d+)', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT a.*,
              s.nombre AS sucursal_nombre,
              u.nombre_completo AS usuario_nombre
       FROM asientos_cabecera a
       JOIN sucursales s ON a.id_sucursal = s.id_sucursal
       JOIN usuarios u ON a.id_usuario = u.id_usuario
       WHERE a.id_asiento = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Asiento contable no encontrado.' });
    }

    const detRes = await query(
      `SELECT d.*,
              pc.codigo_cuenta,
              pc.nombre_cuenta,
              pc.tipo_cuenta
       FROM asientos_detalle d
       JOIN plan_cuentas pc ON d.id_cuenta = pc.id_cuenta
       WHERE d.id_asiento = $1
       ORDER BY d.id_detalle ASC`,
      [id]
    );

    return res.status(200).json({
      asiento: cabRes.rows[0],
      partidas: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/contabilidad/asientos/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de asiento contable.' });
  }
});

// =====================================================================
// PUT /api/contabilidad/asientos/:id/anular - Anular Asiento Contable
// =====================================================================
contabilidadRouter.put('/asientos/:id(\\d+)/anular', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { motivo_anulacion } = req.body;

    if (!motivo_anulacion) {
      return res.status(400).json({ error: 'motivo_anulacion es obligatorio.' });
    }

    const check = await query(`SELECT id_asiento, estado FROM asientos_cabecera WHERE id_asiento = $1`, [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Asiento contable no encontrado.' });
    }

    if (check.rows[0].estado === 'ANULADO') {
      return res.status(400).json({ error: 'El asiento contable ya se encuentra anulado.' });
    }

    const upd = await query(
      `UPDATE asientos_cabecera
       SET estado = 'ANULADO',
           motivo_anulacion = $1,
           fecha_anulacion = CURRENT_TIMESTAMP
       WHERE id_asiento = $2
       RETURNING *`,
      [motivo_anulacion.trim(), id]
    );

    return res.status(200).json({
      message: 'Asiento contable anulado exitosamente.',
      asiento: upd.rows[0]
    });
  } catch (error: any) {
    console.error('[Error en PUT /api/contabilidad/asientos/:id/anular]:', error);
    return res.status(500).json({ error: 'Error interno al anular asiento contable.' });
  }
});
