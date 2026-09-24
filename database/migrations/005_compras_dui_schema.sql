-- =====================================================================
-- DIREMOR SAC - Módulo de Compras, Proveedores y Liquidación DUI
-- Migración: 005_compras_dui_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
-- =====================================================================

-- 1. MAESTRO DE PROVEEDORES
CREATE TABLE IF NOT EXISTS proveedores (
    id_proveedor BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(15) NOT NULL DEFAULT 'NIT', -- 'NIT', 'CI', 'EXTRANJERO'
    nit_ci VARCHAR(35) NOT NULL UNIQUE,
    contacto_nombre VARCHAR(100),
    telefono VARCHAR(35),
    email VARCHAR(100),
    direccion VARCHAR(200),
    pais VARCHAR(50) NOT NULL DEFAULT 'BOLIVIA',
    tipo_proveedor VARCHAR(20) NOT NULL DEFAULT 'NACIONAL', -- 'NACIONAL', 'INTERNACIONAL'
    dias_credito INT NOT NULL DEFAULT 0 CHECK (dias_credito >= 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proveedores_nit ON proveedores(nit_ci);
CREATE INDEX IF NOT EXISTS idx_proveedores_razon ON proveedores(razon_social);

-- 2. CABECERA DE COMPRAS Y RECEPCIONES
CREATE TABLE IF NOT EXISTS compras_cabecera (
    id_compra BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_almacen_destino INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    id_proveedor BIGINT NOT NULL REFERENCES proveedores(id_proveedor) ON DELETE RESTRICT,
    id_usuario_registro BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    tipo_compra VARCHAR(25) NOT NULL DEFAULT 'LOCAL', -- 'LOCAL', 'IMPORTACION_DUI'
    numero_factura_proveedor VARCHAR(50),
    autorizacion_factura VARCHAR(100),
    fecha_compra TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    condicion_pago VARCHAR(20) NOT NULL DEFAULT 'CONTADO', -- 'CONTADO', 'CREDITO'
    dias_plazo INT NOT NULL DEFAULT 0,
    monto_total_bruto NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    monto_descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    monto_total_neto NUMERIC(14,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'RECEPCIONADA', -- 'RECEPCIONADA', 'ANULADA'
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compras_prov ON compras_cabecera(id_proveedor);
CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras_cabecera(fecha_compra);

-- 3. DETALLE DE COMPRAS
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

-- 4. PÓLIZAS DE IMPORTACIÓN Y LIQUIDACIÓN DUI
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

-- 5. TRIGGER TRANSACCIONAL: INGRESO ATÓMICO A KARDEX POR COMPRA
CREATE OR REPLACE FUNCTION fn_ingresar_kardex_por_compra()
RETURNS TRIGGER AS $$
DECLARE
    v_ultimo_saldo_cant NUMERIC(12,2) := 0.00;
    v_ultimo_saldo_val NUMERIC(16,4) := 0.00;
    v_nuevo_saldo_cant NUMERIC(12,2);
    v_nuevo_saldo_val NUMERIC(16,4);
    v_nuevo_costo_ponderado NUMERIC(14,4);
BEGIN
    -- Bloquear y consultar el último movimiento para el producto en el almacén
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

    -- Calcular nuevos saldos físicos y valorados
    v_nuevo_saldo_cant := v_ultimo_saldo_cant + NEW.cantidad;
    v_nuevo_saldo_val := v_ultimo_saldo_val + (NEW.cantidad * NEW.costo_unitario_final);

    IF v_nuevo_saldo_cant > 0 THEN
        v_nuevo_costo_ponderado := v_nuevo_saldo_val / v_nuevo_saldo_cant;
    ELSE
        v_nuevo_costo_ponderado := NEW.costo_unitario_final;
    END IF;

    -- Actualizar el costo del producto en el catálogo maestro
    UPDATE productos
    SET precio_costo = v_nuevo_costo_ponderado,
        updated_at = CURRENT_TIMESTAMP
    WHERE codigo_producto = NEW.codigo_producto;

    -- Insertar movimiento atómico de entrada por compra en el kardex
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
