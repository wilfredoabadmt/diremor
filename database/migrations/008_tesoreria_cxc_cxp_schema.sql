-- =====================================================================
-- DIREMOR SAC - Módulo de Tesorería, Cuentas por Cobrar (CxC) y Cuentas por Pagar (CxP)
-- Migración: 008_tesoreria_cxc_cxp_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
-- =====================================================================

-- 1. CUENTAS POR COBRAR (CxC)
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
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PAGADO', 'VENCIDO'
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxc_cliente ON cxc_cuentas(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cxc_estado ON cxc_cuentas(estado);
CREATE INDEX IF NOT EXISTS idx_cxc_vencimiento ON cxc_cuentas(fecha_vencimiento);

-- 2. RECIBOS DE COBRANZA Y AMORTIZACIONES (CxC)
CREATE TABLE IF NOT EXISTS cxc_cobros (
    id_cobro BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cxc BIGINT NOT NULL REFERENCES cxc_cuentas(id_cxc) ON DELETE CASCADE,
    numero_recibo VARCHAR(50) NOT NULL UNIQUE,
    fecha_cobro TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto_cobrado NUMERIC(14,2) NOT NULL CHECK (monto_cobrado > 0),
    forma_pago VARCHAR(25) NOT NULL DEFAULT 'EFECTIVO', -- 'EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'QR'
    numero_referencia VARCHAR(50),
    observaciones TEXT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxc_cobros_cxc ON cxc_cobros(id_cxc);
CREATE INDEX IF NOT EXISTS idx_cxc_cobros_recibo ON cxc_cobros(numero_recibo);

-- 3. CUENTAS POR PAGAR A PROVEEDORES (CxP)
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
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'PAGADO', 'VENCIDO'
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxp_prov ON cxp_cuentas(id_proveedor);
CREATE INDEX IF NOT EXISTS idx_cxp_estado ON cxp_cuentas(estado);
CREATE INDEX IF NOT EXISTS idx_cxp_vencimiento ON cxp_cuentas(fecha_vencimiento);

-- 4. COMPROBANTES DE EGRESO Y PAGOS A PROVEEDORES (CxP)
CREATE TABLE IF NOT EXISTS cxp_pagos (
    id_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cxp BIGINT NOT NULL REFERENCES cxp_cuentas(id_cxp) ON DELETE CASCADE,
    numero_comprobante VARCHAR(50) NOT NULL UNIQUE,
    fecha_pago TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto_pagado NUMERIC(14,2) NOT NULL CHECK (monto_pagado > 0),
    forma_pago VARCHAR(25) NOT NULL DEFAULT 'TRANSFERENCIA', -- 'EFECTIVO', 'TRANSFERENCIA', 'CHEQUE'
    numero_referencia VARCHAR(50),
    observaciones TEXT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cxp_pagos_cxp ON cxp_pagos(id_cxp);
CREATE INDEX IF NOT EXISTS idx_cxp_pagos_comp ON cxp_pagos(numero_comprobante);
