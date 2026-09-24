-- =====================================================================
-- MIGRACIÓN 009: CONTABILIDAD GENERAL INTEGRADA
-- Plan de Cuentas, Asientos/Comprobantes de Partida Doble y Libros Fiscales
-- =====================================================================

-- 1. Catálogo del Plan de Cuentas Contable
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

-- 2. Comprobantes / Asientos Contables - Cabecera
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
    modulo_origen VARCHAR(30) NOT NULL DEFAULT 'MANUAL', -- 'VENTAS', 'COMPRAS', 'TESORERIA', 'MANUAL'
    id_documento_origen BIGINT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    motivo_anulacion TEXT,
    fecha_anulacion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asientos_fecha ON asientos_cabecera(fecha_asiento);
CREATE INDEX IF NOT EXISTS idx_asientos_tipo ON asientos_cabecera(tipo_asiento);
CREATE INDEX IF NOT EXISTS idx_asientos_estado ON asientos_cabecera(estado);

-- 3. Partidas de Asientos Contables - Detalle
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

-- 4. Seed del Plan de Cuentas Estándar Boliviano (Comercial / Industrial)
INSERT INTO plan_cuentas (codigo_cuenta, nombre_cuenta, tipo_cuenta, nivel, es_imputable)
VALUES
    -- 1. ACTIVO
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

    -- 2. PASIVO
    ('2', 'PASIVO', 'PASIVO', 1, FALSE),
    ('2.1', 'PASIVO CORRIENTE', 'PASIVO', 2, FALSE),
    ('2.1.1', 'OBLIGACIONES COMERCIALES', 'PASIVO', 3, FALSE),
    ('2.1.1.01', 'Cuentas por Pagar Proveedores', 'ACTIVO', 4, FALSE),
    ('2.1.1.01.001', 'Cuentas por Pagar Proveedores Nacionales', 'PASIVO', 5, TRUE),
    ('2.1.1.01.002', 'Cuentas por Pagar Proveedores Extranjeros', 'PASIVO', 5, TRUE),
    ('2.1.2', 'OBLIGACIONES FISCALES Y TRIBUTARIAS', 'PASIVO', 3, FALSE),
    ('2.1.2.01', 'Débito Fiscal IVA', 'PASIVO', 4, FALSE),
    ('2.1.2.01.001', 'Débito Fiscal IVA 13% por Pagar', 'PASIVO', 5, TRUE),
    ('2.1.2.02', 'Impuesto a las Transacciones por Pagar', 'PASIVO', 4, FALSE),
    ('2.1.2.02.001', 'IT por Pagar 3%', 'PASIVO', 5, TRUE),

    -- 3. PATRIMONIO
    ('3', 'PATRIMONIO NETO', 'PATRIMONIO', 1, FALSE),
    ('3.1', 'CAPITAL SOCIAL', 'PATRIMONIO', 2, FALSE),
    ('3.1.1.01.001', 'Capital Social DIREMOR S.R.L.', 'PATRIMONIO', 3, TRUE),

    -- 4. INGRESOS
    ('4', 'INGRESOS', 'INGRESO', 1, FALSE),
    ('4.1', 'INGRESOS OPERATIVOS', 'INGRESO', 2, FALSE),
    ('4.1.1.01.001', 'Ventas Netas de Mercaderías (87%)', 'INGRESO', 3, TRUE),
    ('4.1.2.01.001', 'Servicios de Maquila y Fabricación', 'INGRESO', 3, TRUE),

    -- 5. COSTOS
    ('5', 'COSTOS DE VENTA Y PRODUCCIÓN', 'COSTO', 1, FALSE),
    ('5.1', 'COSTO DE VENTAS', 'COSTO', 2, FALSE),
    ('5.1.1.01.001', 'Costo de Mercaderías Vendidas', 'COSTO', 3, TRUE),

    -- 6. GASTOS
    ('6', 'GASTOS OPERATIVOS', 'GASTO', 1, FALSE),
    ('6.1', 'GASTOS DE COMERCIALIZACIÓN Y TRIBUTARIOS', 'GASTO', 2, FALSE),
    ('6.1.1.01.001', 'Impuesto a las Transacciones (Gasto 3%)', 'GASTO', 3, TRUE),
    ('6.1.2.01.001', 'Gastos Generales de Administración', 'GASTO', 3, TRUE)
ON CONFLICT (codigo_cuenta) DO NOTHING;
