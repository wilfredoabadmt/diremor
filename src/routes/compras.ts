import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const comprasRouter = Router();

// Todas las rutas de compras requieren autenticación JWT
comprasRouter.use(authenticateToken);

/**
 * Inicialización segura e idempotente del esquema de compras y DUI
 */
export async function initComprasSchema(): Promise<void> {
  const ddl = `
    CREATE TABLE IF NOT EXISTS compras_cabecera (
        id_compra BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
        id_almacen_destino INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        id_proveedor BIGINT NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
        id_usuario_registro BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
        tipo_compra VARCHAR(25) NOT NULL DEFAULT 'LOCAL',
        numero_factura_proveedor VARCHAR(50),
        autorizacion_factura VARCHAR(100),
        fecha_compra TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        condicion_pago VARCHAR(20) NOT NULL DEFAULT 'CONTADO',
        dias_plazo INT NOT NULL DEFAULT 0,
        monto_total_bruto NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        monto_descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        monto_total_neto NUMERIC(14,2) NOT NULL,
        estado VARCHAR(20) NOT NULL DEFAULT 'RECEPCIONADA',
        observaciones TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_compras_prov ON compras_cabecera(id_proveedor);
    CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_cabecera(fecha_compra);

    CREATE TABLE IF NOT EXISTS compras_detalle (
        id_compra_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_compra BIGINT NOT NULL REFERENCES compras_cabecera(id_compra) ON DELETE CASCADE,
        id_almacen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
        codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
        cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
        costo_unitario_compra NUMERIC(14,4) NOT NULL CHECK (costo_unitario_compra >= 0),
        costo_adicional_prorrateado NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
        costo_unitario_final NUMERIC(14,4) NOT NULL CHECK (costo_unitario_final >= 0),
        subtotal NUMERIC(14,2) NOT NULL,
        numero_serie VARCHAR(50),
        numero_lote VARCHAR(50),
        fecha_vencimiento DATE
    );

    CREATE INDEX IF NOT EXISTS idx_compra_det_compra ON compras_detalle(id_compra);
    CREATE INDEX IF NOT EXISTS idx_compra_det_prod ON compras_detalle(codigo_producto);

    CREATE TABLE IF NOT EXISTS importaciones_dui (
        id_dui BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        id_compra BIGINT NOT NULL UNIQUE REFERENCES compras_cabecera(id_compra) ON DELETE CASCADE,
        numero_poliza_dui VARCHAR(50) NOT NULL UNIQUE,
        fecha_aceptacion_dui DATE NOT NULL,
        pais_origen VARCHAR(60) NOT NULL,
        valor_fob_usd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        flete_usd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        seguro_usd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        otros_gastos_usd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        valor_cif_usd NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        tipo_cambio_oficial NUMERIC(10,4) NOT NULL DEFAULT 6.9600,
        valor_cif_bob NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        gravamen_arancelario_ga NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        gastos_agencia_aduanera NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        gastos_transporte_interno NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        total_gastos_nacionalizacion_bob NUMERIC(14,2) NOT NULL DEFAULT 0.00,
        metodo_prorrateo VARCHAR(20) NOT NULL DEFAULT 'VALOR',
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dui_poliza ON importaciones_dui(numero_poliza_dui);

    CREATE OR REPLACE FUNCTION fn_ingresar_kardex_por_compra()
    RETURNS TRIGGER AS $$
    DECLARE
        v_ultimo_saldo_cant NUMERIC(12,2) := 0.00;
        v_ultimo_saldo_val NUMERIC(16,4) := 0.00;
        v_nuevo_saldo_cant NUMERIC(12,2);
        v_nuevo_saldo_val NUMERIC(16,4);
        v_nuevo_costo_ponderado NUMERIC(14,4);
    BEGIN
        SELECT saldo_cantidad, saldo_valorado
        INTO v_ultimo_saldo_cant, v_ultimo_saldo_val
        FROM kardex_movimientos
        WHERE codigo_producto = NEW.codigo_producto AND id_almacen = NEW.id_almacen
        ORDER BY id_kardex DESC
        LIMIT 1
        FOR UPDATE;

        IF v_ultimo_saldo_cant IS NULL THEN
            v_ultimo_saldo_cant := 0.00;
            v_ultimo_saldo_val := 0.00;
        END IF;

        v_nuevo_saldo_cant := v_ultimo_saldo_cant + NEW.cantidad;
        v_nuevo_saldo_val := v_ultimo_saldo_val + (NEW.cantidad * NEW.costo_unitario_final);

        IF v_nuevo_saldo_cant > 0 THEN
            v_nuevo_costo_ponderado := v_nuevo_saldo_val / v_nuevo_saldo_cant;
        ELSE
            v_nuevo_costo_ponderado := NEW.costo_unitario_final;
        END IF;

        UPDATE productos
        SET precio_costo = v_nuevo_costo_ponderado,
            updated_at = CURRENT_TIMESTAMP
        WHERE codigo_producto = NEW.codigo_producto;

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
        ) VALUES (
            NEW.id_almacen,
            NEW.codigo_producto,
            'COMPRA',
            NEW.id_compra,
            NEW.cantidad,
            0.00,
            v_nuevo_saldo_cant,
            v_nuevo_costo_ponderado,
            v_nuevo_saldo_val,
            NEW.numero_serie,
            NEW.numero_lote,
            NEW.fecha_vencimiento
        );

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_ingresar_kardex_compra ON compras_detalle;
    CREATE TRIGGER trg_ingresar_kardex_compra
    AFTER INSERT ON compras_detalle
    FOR EACH ROW
    EXECUTE FUNCTION fn_ingresar_kardex_por_compra();
  `;
  try {
    await query(ddl);
  } catch (error: any) {
    console.error('[Error en initComprasSchema]:', error.message);
  }
}

// Auto-inicializar esquema
initComprasSchema().catch(console.error);

interface CompraItemInput {
  codigo_producto: string;
  cantidad: number;
  costo_unitario: number;
  numero_serie?: string;
  numero_lote?: string;
  fecha_vencimiento?: string;
}

interface AlertaReprecio {
  codigo_producto: string;
  descripcion: string;
  costo_anterior: number;
  costo_nuevo: number;
  incremento_porcentaje: number;
  precio_venta_actual: number;
  precio_venta_sugerido: number;
  margen_sugerido_pct: number;
}

// =====================================================================
// POST /api/compras - Registro de Compra Local
// =====================================================================
comprasRouter.post('/', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_sucursal,
      id_almacen_destino,
      id_proveedor,
      numero_factura_proveedor,
      autorizacion_factura,
      condicion_pago = 'CONTADO',
      dias_plazo = 0,
      descuento = 0,
      observaciones,
      items
    } = req.body;

    if (!id_sucursal || !id_almacen_destino || !id_proveedor) {
      return res.status(400).json({ error: 'id_sucursal, id_almacen_destino e id_proveedor son obligatorios.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La compra debe incluir al menos un ítem en items.' });
    }

    // Verificar proveedor
    const provCheck = await client.query(`SELECT id_proveedor, razon_social, activo FROM proveedores WHERE id_proveedor = $1`, [id_proveedor]);
    if (provCheck.rows.length === 0) {
      return res.status(404).json({ error: `Proveedor con ID ${id_proveedor} no existe.` });
    }
    if (!provCheck.rows[0].activo) {
      return res.status(400).json({ error: `El proveedor ${provCheck.rows[0].razon_social} se encuentra inactivo.` });
    }

    // Iniciar Transacción ACID
    await client.query('BEGIN');

    // Consultar costos y precios actuales de cada producto para análisis de reprecio
    const alertasReprecio: AlertaReprecio[] = [];
    let montoTotalBruto = 0;

    const itemsValidados: Array<CompraItemInput & { subtotal: number; descripcion: string; costo_anterior: number; precio_venta_base: number }> = [];

    for (const item of items) {
      if (!item.codigo_producto || isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ítem con código ${item.codigo_producto || 'desconocido'} tiene una cantidad inválida.` });
      }

      if (isNaN(Number(item.costo_unitario)) || Number(item.costo_unitario) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `El producto ${item.codigo_producto} debe tener un costo unitario mayor a cero.` });
      }

      const prodRes = await client.query(
        `SELECT codigo_producto, descripcion, precio_costo, precio_venta_base, activo FROM productos WHERE codigo_producto = $1`,
        [item.codigo_producto]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `El producto ${item.codigo_producto} no existe en el catálogo.` });
      }

      const prod = prodRes.rows[0];
      const costoAnterior = parseFloat(prod.precio_costo);
      const precioVentaBase = parseFloat(prod.precio_venta_base);
      const subtotalItem = Number(item.cantidad) * Number(item.costo_unitario);
      montoTotalBruto += subtotalItem;

      itemsValidados.push({
        ...item,
        subtotal: subtotalItem,
        descripcion: prod.descripcion,
        costo_anterior: costoAnterior,
        precio_venta_base: precioVentaBase
      });
    }

    const descNum = parseFloat(descuento) || 0;
    const montoTotalNeto = Math.max(0, montoTotalBruto - descNum);

    // 1. Insertar Cabecera de Compra
    const insCabecera = await client.query(
      `INSERT INTO compras_cabecera (
        id_sucursal, id_almacen_destino, id_proveedor, id_usuario_registro,
        tipo_compra, numero_factura_proveedor, autorizacion_factura,
        condicion_pago, dias_plazo, monto_total_bruto, monto_descuento,
        monto_total_neto, estado, observaciones
      ) VALUES ($1, $2, $3, $4, 'LOCAL', $5, $6, $7, $8, $9, $10, $11, 'RECEPCIONADA', $12)
      RETURNING *`,
      [
        id_sucursal,
        id_almacen_destino,
        id_proveedor,
        req.user?.id_usuario || 1,
        numero_factura_proveedor?.trim() || null,
        autorizacion_factura?.trim() || null,
        condicion_pago.toUpperCase(),
        parseInt(dias_plazo, 10) || 0,
        montoTotalBruto,
        descNum,
        montoTotalNeto,
        observaciones?.trim() || null
      ]
    );

    const compraCreada = insCabecera.rows[0];
    const idCompra = compraCreada.id_compra;

    // 2. Insertar Detalle de Compra (Activa Trigger Transaccional de Kardex)
    for (const item of itemsValidados) {
      await client.query(
        `INSERT INTO compras_detalle (
          id_compra, id_almacen, codigo_producto, cantidad,
          costo_unitario_compra, costo_adicional_prorrateado,
          costo_unitario_final, subtotal, numero_serie,
          numero_lote, fecha_vencimiento
        ) VALUES ($1, $2, $3, $4, $5, 0.0000, $5, $6, $7, $8, $9)`,
        [
          idCompra,
          id_almacen_destino,
          item.codigo_producto,
          item.cantidad,
          item.costo_unitario,
          item.subtotal,
          item.numero_serie || null,
          item.numero_lote || null,
          item.fecha_vencimiento || null
        ]
      );

      // Evaluar alerta de reprecio si el costo de adquisición supera el costo anterior
      if (item.costo_anterior > 0 && item.costo_unitario > item.costo_anterior * 1.01) {
        const incrementoPct = ((item.costo_unitario - item.costo_anterior) / item.costo_anterior) * 100;
        let margenObjetivo = 0.30; // 30% por defecto
        if (item.precio_venta_base > item.costo_anterior) {
          const margenPrevio = (item.precio_venta_base - item.costo_anterior) / item.precio_venta_base;
          if (margenPrevio >= 0.15) margenObjetivo = margenPrevio;
        }

        const precioVentaSugerido = Math.round((item.costo_unitario / (1 - margenObjetivo)) * 100) / 100;

        alertasReprecio.push({
          codigo_producto: item.codigo_producto,
          descripcion: item.descripcion,
          costo_anterior: item.costo_anterior,
          costo_nuevo: item.costo_unitario,
          incremento_porcentaje: parseFloat(incrementoPct.toFixed(2)),
          precio_venta_actual: item.precio_venta_base,
          precio_venta_sugerido: precioVentaSugerido,
          margen_sugerido_pct: parseFloat((margenObjetivo * 100).toFixed(1))
        });
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Compra local registrada exitosamente e ingresada a Kardex.',
      compra: compraCreada,
      total_items: itemsValidados.length,
      alertas_reprecio: alertasReprecio
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/compras]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al registrar compra.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// POST /api/compras/importacion-dui - Liquidación de Importación con DUI
// =====================================================================
comprasRouter.post('/importacion-dui', requireRole('ADMIN', 'ALMACENERO', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      id_sucursal,
      id_almacen_destino,
      id_proveedor,
      numero_poliza_dui,
      fecha_aceptacion_dui,
      pais_origen,
      valor_fob_usd = 0,
      flete_usd = 0,
      seguro_usd = 0,
      otros_gastos_usd = 0,
      tipo_cambio_oficial = 6.96,
      gravamen_arancelario_ga = 0,
      gastos_agencia_aduanera = 0,
      gastos_transporte_interno = 0,
      condicion_pago = 'CONTADO',
      dias_plazo = 0,
      observaciones,
      items // [{ codigo_producto, cantidad, costo_unitario_usd, numero_serie, numero_lote, fecha_vencimiento }]
    } = req.body;

    if (!id_sucursal || !id_almacen_destino || !id_proveedor || !numero_poliza_dui || !fecha_aceptacion_dui) {
      return res.status(400).json({
        error: 'id_sucursal, id_almacen_destino, id_proveedor, numero_poliza_dui y fecha_aceptacion_dui son obligatorios.'
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'La importación debe incluir al menos un ítem.' });
    }

    // Verificar unicidad de póliza DUI
    const duiCheck = await client.query(`SELECT id_dui FROM importaciones_dui WHERE numero_poliza_dui = $1`, [numero_poliza_dui.trim()]);
    if (duiCheck.rows.length > 0) {
      return res.status(409).json({ error: `La póliza DUI Nro ${numero_poliza_dui} ya fue registrada previamente.` });
    }

    // Cálculos de Liquidación DUI en USD y BOB
    const tc = parseFloat(tipo_cambio_oficial) || 6.96;
    const fobUsd = parseFloat(valor_fob_usd) || 0;
    const fleteUsd = parseFloat(flete_usd) || 0;
    const seguroUsd = parseFloat(seguro_usd) || 0;
    const otrosUsd = parseFloat(otros_gastos_usd) || 0;

    const cifUsd = fobUsd + fleteUsd + seguroUsd + otrosUsd;
    const cifBob = cifUsd * tc;

    const gaBob = parseFloat(gravamen_arancelario_ga) || 0;
    const agenciaBob = parseFloat(gastos_agencia_aduanera) || 0;
    const transporteBob = parseFloat(gastos_transporte_interno) || 0;

    // Total de gastos adicionales de nacionalización e internación a prorratear (en BOB)
    const gastosAdicionalesBob = ((fleteUsd + seguroUsd + otrosUsd) * tc) + gaBob + agenciaBob + transporteBob;
    const totalNacionalizacionBob = cifBob + gaBob + agenciaBob + transporteBob;

    await client.query('BEGIN');

    // Validar ítems y calcular la base FOB en BOB para el prorrateo por valor
    let sumaBaseFobBob = 0;
    const itemsProcesados: Array<any> = [];
    const alertasReprecio: AlertaReprecio[] = [];

    for (const item of items) {
      if (!item.codigo_producto || isNaN(Number(item.cantidad)) || Number(item.cantidad) <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ítem ${item.codigo_producto} tiene cantidad inválida.` });
      }

      const costoUnitarioUsd = parseFloat(item.costo_unitario_usd);
      if (isNaN(costoUnitarioUsd) || costoUnitarioUsd <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Ítem ${item.codigo_producto} requiere costo_unitario_usd mayor a cero.` });
      }

      const prodRes = await client.query(
        `SELECT codigo_producto, descripcion, precio_costo, precio_venta_base FROM productos WHERE codigo_producto = $1`,
        [item.codigo_producto]
      );

      if (prodRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Producto ${item.codigo_producto} no encontrado.` });
      }

      const prod = prodRes.rows[0];
      const costoBaseBobUnitario = costoUnitarioUsd * tc;
      const subtotalBaseBob = Number(item.cantidad) * costoBaseBobUnitario;
      sumaBaseFobBob += subtotalBaseBob;

      itemsProcesados.push({
        ...item,
        descripcion: prod.descripcion,
        costo_anterior: parseFloat(prod.precio_costo),
        precio_venta_base: parseFloat(prod.precio_venta_base),
        costo_base_bob: costoBaseBobUnitario,
        subtotal_base_bob: subtotalBaseBob
      });
    }

    if (sumaBaseFobBob <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'La base monetaria de los ítems es cero o negativa.' });
    }

    // Prorratear los gastos adicionales entre cada ítem
    let montoTotalLiquidadoBob = 0;
    const itemsConProrrateo = itemsProcesados.map(item => {
      const factorProrrateo = item.subtotal_base_bob / sumaBaseFobBob;
      const gastoAsignadoBob = gastosAdicionalesBob * factorProrrateo;
      const costoAdicionalUnitarioBob = gastoAsignadoBob / Number(item.cantidad);
      const costoUnitarioFinalBob = item.costo_base_bob + costoAdicionalUnitarioBob;
      const subtotalFinalBob = Number(item.cantidad) * costoUnitarioFinalBob;
      montoTotalLiquidadoBob += subtotalFinalBob;

      return {
        ...item,
        costo_adicional_prorrateado: parseFloat(costoAdicionalUnitarioBob.toFixed(4)),
        costo_unitario_final: parseFloat(costoUnitarioFinalBob.toFixed(4)),
        subtotal_final: parseFloat(subtotalFinalBob.toFixed(2))
      };
    });

    // 1. Insertar Cabecera de Compra (Tipo: IMPORTACION_DUI)
    const insCabecera = await client.query(
      `INSERT INTO compras_cabecera (
        id_sucursal, id_almacen_destino, id_proveedor, id_usuario_registro,
        tipo_compra, numero_factura_proveedor, autorizacion_factura,
        condicion_pago, dias_plazo, monto_total_bruto, monto_descuento,
        monto_total_neto, estado, observaciones
      ) VALUES ($1, $2, $3, $4, 'IMPORTACION_DUI', $5, NULL, $6, $7, $8, 0.00, $8, 'RECEPCIONADA', $9)
      RETURNING *`,
      [
        id_sucursal,
        id_almacen_destino,
        id_proveedor,
        req.user?.id_usuario || 1,
        numero_poliza_dui.trim(),
        condicion_pago.toUpperCase(),
        parseInt(dias_plazo, 10) || 0,
        montoTotalLiquidadoBob,
        observaciones?.trim() || `Importación Póliza DUI ${numero_poliza_dui}`
      ]
    );

    const compraCreada = insCabecera.rows[0];
    const idCompra = compraCreada.id_compra;

    // 2. Insertar Registro en importaciones_dui
    const insDui = await client.query(
      `INSERT INTO importaciones_dui (
        id_compra, numero_poliza_dui, fecha_aceptacion_dui, pais_origen,
        valor_fob_usd, flete_usd, seguro_usd, otros_gastos_usd,
        valor_cif_usd, tipo_cambio_oficial, valor_cif_bob,
        gravamen_arancelario_ga, gastos_agencia_aduanera, gastos_transporte_interno,
        total_gastos_nacionalizacion_bob, metodo_prorrateo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'VALOR')
      RETURNING *`,
      [
        idCompra,
        numero_poliza_dui.trim(),
        fecha_aceptacion_dui,
        pais_origen.trim().toUpperCase(),
        fobUsd,
        fleteUsd,
        seguroUsd,
        otrosUsd,
        cifUsd,
        tc,
        cifBob,
        gaBob,
        agenciaBob,
        transporteBob,
        totalNacionalizacionBob
      ]
    );

    // 3. Insertar Detalle con Costos Prorrateados (Activa Trigger Kardex con Costo Real Liquidado)
    for (const item of itemsConProrrateo) {
      await client.query(
        `INSERT INTO compras_detalle (
          id_compra, id_almacen, codigo_producto, cantidad,
          costo_unitario_compra, costo_adicional_prorrateado,
          costo_unitario_final, subtotal, numero_serie,
          numero_lote, fecha_vencimiento
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          idCompra,
          id_almacen_destino,
          item.codigo_producto,
          item.cantidad,
          item.costo_base_bob,
          item.costo_adicional_prorrateado,
          item.costo_unitario_final,
          item.subtotal_final,
          item.numero_serie || null,
          item.numero_lote || null,
          item.fecha_vencimiento || null
        ]
      );

      // Alerta de reprecio si el costo liquidado supera el costo anterior
      if (item.costo_anterior > 0 && item.costo_unitario_final > item.costo_anterior * 1.01) {
        const incrementoPct = ((item.costo_unitario_final - item.costo_anterior) / item.costo_anterior) * 100;
        let margenObjetivo = 0.30;
        if (item.precio_venta_base > item.costo_anterior) {
          const margenPrevio = (item.precio_venta_base - item.costo_anterior) / item.precio_venta_base;
          if (margenPrevio >= 0.15) margenObjetivo = margenPrevio;
        }

        const precioVentaSugerido = Math.round((item.costo_unitario_final / (1 - margenObjetivo)) * 100) / 100;

        alertasReprecio.push({
          codigo_producto: item.codigo_producto,
          descripcion: item.descripcion,
          costo_anterior: item.costo_anterior,
          costo_nuevo: item.costo_unitario_final,
          incremento_porcentaje: parseFloat(incrementoPct.toFixed(2)),
          precio_venta_actual: item.precio_venta_base,
          precio_venta_sugerido: precioVentaSugerido,
          margen_sugerido_pct: parseFloat((margenObjetivo * 100).toFixed(1))
        });
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'Liquidación de importación DUI procesada exitosamente e ingresada a Kardex.',
      compra: compraCreada,
      dui: insDui.rows[0],
      liquidacion: {
        valor_cif_usd: cifUsd,
        valor_cif_bob: cifBob,
        gastos_adicionales_prorrateados_bob: gastosAdicionalesBob,
        total_desembolso_bob: totalNacionalizacionBob
      },
      items_prorrateados: itemsConProrrateo.map(i => ({
        codigo_producto: i.codigo_producto,
        cantidad: i.cantidad,
        costo_base_bob: i.costo_base_bob,
        costo_adicional_prorrateado: i.costo_adicional_prorrateado,
        costo_unitario_final: i.costo_unitario_final,
        subtotal_final: i.subtotal_final
      })),
      alertas_reprecio: alertasReprecio
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/compras/importacion-dui]:', error);
    return res.status(500).json({ error: error.message || 'Error interno al liquidar importación DUI.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/compras - Listar compras con filtros
// =====================================================================
comprasRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { tipo_compra, id_proveedor, id_sucursal, fecha_desde, fecha_hasta, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT c.*,
             p.razon_social AS proveedor_razon_social,
             p.nit_ci AS proveedor_nit,
             s.nombre AS sucursal_nombre,
             a.nombre AS almacen_destino_nombre,
             u.nombre_completo AS usuario_nombre,
             d.numero_poliza_dui,
             d.pais_origen
      FROM compras_cabecera c
      JOIN proveedores p ON c.id_proveedor = p.id_proveedor
      JOIN sucursales s ON c.id_sucursal = s.id_sucursal
      JOIN almacenes a ON c.id_almacen_destino = a.id_almacen
      JOIN usuarios u ON c.id_usuario_registro = u.id_usuario
      LEFT JOIN importaciones_dui d ON c.id_compra = d.id_compra
      WHERE 1=1
    `;
    const params: any[] = [];

    if (tipo_compra) {
      params.push(tipo_compra.toString().toUpperCase());
      sql += ` AND c.tipo_compra = $${params.length}`;
    }

    if (id_proveedor) {
      params.push(id_proveedor);
      sql += ` AND c.id_proveedor = $${params.length}`;
    }

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND c.id_sucursal = $${params.length}`;
    }

    if (fecha_desde) {
      params.push(fecha_desde);
      sql += ` AND c.fecha_compra >= $${params.length}`;
    }

    if (fecha_hasta) {
      params.push(fecha_hasta);
      sql += ` AND c.fecha_compra <= $${params.length}`;
    }

    sql += ` ORDER BY c.id_compra DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit as string, 10) || 50, parseInt(offset as string, 10) || 0);

    const result = await query(sql, params);

    return res.status(200).json({
      total: result.rows.length,
      compras: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/compras]:', error);
    return res.status(500).json({ error: 'Error interno al consultar compras.' });
  }
});

// =====================================================================
// GET /api/compras/alertas-reprecio - Consultar alertas de reprecio
// =====================================================================
comprasRouter.get('/alertas-reprecio', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(`
      SELECT p.codigo_producto,
             p.descripcion,
             p.precio_costo,
             p.precio_venta_base,
             CASE
               WHEN p.precio_venta_base > 0 THEN
                 ROUND(((p.precio_venta_base - p.precio_costo) / p.precio_venta_base) * 100, 2)
               ELSE 0.00
             END AS margen_actual_pct,
             ROUND((p.precio_costo / (1 - 0.30)), 2) AS precio_venta_sugerido_30pct,
             p.updated_at AS fecha_ultimo_costo
      FROM productos p
      WHERE p.activo = TRUE
        AND p.precio_costo > 0
        AND (p.precio_venta_base < p.precio_costo * 1.25)
      ORDER BY (p.precio_costo / NULLIF(p.precio_venta_base, 0)) DESC
      LIMIT 100
    `);

    return res.status(200).json({
      total: result.rows.length,
      alertas: result.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/compras/alertas-reprecio]:', error);
    return res.status(500).json({ error: 'Error interno al consultar alertas de reprecio.' });
  }
});

// =====================================================================
// GET /api/compras/:id - Detalle completo de Compra
// =====================================================================
comprasRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT c.*,
              p.razon_social AS proveedor_razon_social,
              p.nit_ci AS proveedor_nit,
              p.pais AS proveedor_pais,
              s.nombre AS sucursal_nombre,
              a.nombre AS almacen_destino_nombre,
              u.nombre_completo AS usuario_nombre
       FROM compras_cabecera c
       JOIN proveedores p ON c.id_proveedor = p.id_proveedor
       JOIN sucursales s ON c.id_sucursal = s.id_sucursal
       JOIN almacenes a ON c.id_almacen_destino = a.id_almacen
       JOIN usuarios u ON c.id_usuario_registro = u.id_usuario
       WHERE c.id_compra = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).json({ error: 'Compra no encontrada.' });
    }

    const compra = cabRes.rows[0];

    const detRes = await query(
      `SELECT d.*, p.descripcion AS producto_descripcion, p.unidad_medida
       FROM compras_detalle d
       JOIN productos p ON d.codigo_producto = p.codigo_producto
       WHERE d.id_compra = $1
       ORDER BY d.id_compra_detalle ASC`,
      [id]
    );

    let duiData = null;
    if (compra.tipo_compra === 'IMPORTACION_DUI') {
      const duiRes = await query(`SELECT * FROM importaciones_dui WHERE id_compra = $1`, [id]);
      if (duiRes.rows.length > 0) {
        duiData = duiRes.rows[0];
      }
    }

    return res.status(200).json({
      compra,
      dui: duiData,
      detalles: detRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/compras/:id]:', error);
    return res.status(500).json({ error: 'Error interno al consultar detalle de compra.' });
  }
});
