-- =====================================================================
-- DIREMOR SAC - Migración Inicial DDL (PostgreSQL 16+)
-- Versión: 001_initial_schema.sql
-- Cumple con: Principio I (ACID), Principio III (Multi-Sucursal),
--             Principio VII (Inalterabilidad Contable) y RND 102100000011
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. SUCURSALES (Casa Matriz y Agencias Departamentales)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sucursales (
    id_sucursal INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(10) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    ciudad VARCHAR(50) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    es_matriz BOOLEAN NOT NULL DEFAULT FALSE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sucursales_ciudad ON sucursales(ciudad);

-- ---------------------------------------------------------------------
-- 2. ROLES Y USUARIOS (Control de Acceso RBAC)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    permisos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_rol INT NOT NULL REFERENCES roles(id_rol) ON DELETE RESTRICT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_usuarios_sucursal ON usuarios(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(id_rol);

-- ---------------------------------------------------------------------
-- 3. ALMACENES Y BODEGAS FÍSICAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS almacenes (
    id_almacen INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL DEFAULT 'VENTAS', -- 'PRINCIPAL', 'VENTAS', 'TRANSITO', 'MERMA'
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_almacen_sucursal_codigo UNIQUE(id_sucursal, codigo)
);

CREATE INDEX IF NOT EXISTS idx_almacenes_sucursal ON almacenes(id_sucursal);

-- ---------------------------------------------------------------------
-- 4. PARÁMETROS FISCALES Y DOSIFICACIÓN SIN (RND 102100000011)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dosificaciones_sin (
    id_dosificacion INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    modalidad VARCHAR(40) NOT NULL DEFAULT 'ELECTRONICA_EN_LINEA',
    codigo_punto_venta INT NOT NULL DEFAULT 0,
    cufd_vigente VARCHAR(120),
    codigo_control_vigente VARCHAR(50),
    fecha_vigencia_cufd TIMESTAMPTZ,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_dosificacion_sucursal_pv UNIQUE(id_sucursal, codigo_punto_venta)
);

-- ---------------------------------------------------------------------
-- 5. MAESTRO DE CLIENTES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clientes (
    id_cliente BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razon_social VARCHAR(150) NOT NULL,
    tipo_documento VARCHAR(10) NOT NULL DEFAULT 'NIT', -- 'NIT', 'CI', 'CEX', 'PAS'
    nit_ci VARCHAR(25) NOT NULL,
    direccion VARCHAR(200),
    telefono VARCHAR(30),
    zona VARCHAR(50),
    limite_credito NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    bloqueo_mora BOOLEAN NOT NULL DEFAULT FALSE,
    estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVO',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_clientes_limite CHECK (limite_credito >= 0)
);

CREATE INDEX IF NOT EXISTS idx_clientes_nit ON clientes(nit_ci);
CREATE INDEX IF NOT EXISTS idx_clientes_mora ON clientes(bloqueo_mora) WHERE bloqueo_mora = TRUE;

-- ---------------------------------------------------------------------
-- 6. CATÁLOGO DE PRODUCTOS E INSUMOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias_producto (
    id_categoria INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
    codigo_producto VARCHAR(30) PRIMARY KEY,
    id_categoria INT NOT NULL REFERENCES categorias_producto(id_categoria) ON DELETE RESTRICT,
    codigo_fabrica VARCHAR(50),
    descripcion VARCHAR(250) NOT NULL,
    unidad_medida VARCHAR(20) NOT NULL DEFAULT 'PZA',
    peso_kg NUMERIC(10,3) DEFAULT 0.000,
    precio_costo NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    precio_venta_base NUMERIC(14,4) NOT NULL DEFAULT 0.0000,
    precio_venta_mayorista NUMERIC(14,4),
    stock_minimo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    stock_maximo NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    maneja_serie BOOLEAN NOT NULL DEFAULT FALSE,
    maneja_lote BOOLEAN NOT NULL DEFAULT FALSE,
    url_imagen TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_productos_fabrica ON productos(codigo_fabrica);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(id_categoria);

-- ---------------------------------------------------------------------
-- 7. KARDEX DE INVENTARIOS (Histórico Físico-Valorado)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kardex_movimientos (
    id_kardex BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_almacen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    tipo_movimiento VARCHAR(25) NOT NULL, -- 'VENTA', 'COMPRA', 'TRASPASO', 'AJUSTE', 'PRODUCCION'
    id_documento_ref BIGINT NOT NULL,
    cantidad_entrada NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    cantidad_salida NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    saldo_cantidad NUMERIC(12,2) NOT NULL,
    costo_unitario NUMERIC(14,4) NOT NULL,
    saldo_valorado NUMERIC(16,4) NOT NULL,
    numero_serie VARCHAR(50),
    numero_lote VARCHAR(50),
    fecha_vencimiento DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kardex_prod_alm ON kardex_movimientos(codigo_producto, id_almacen);
CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex_movimientos(fecha_movimiento);
CREATE INDEX IF NOT EXISTS idx_kardex_serie ON kardex_movimientos(numero_serie) WHERE numero_serie IS NOT NULL;

-- ---------------------------------------------------------------------
-- 8. VENTAS, DETALLE Y FACTURACIÓN FISCAL
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas_cabecera (
    id_venta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_venta TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_bruto NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_neto NUMERIC(14,2) NOT NULL,
    tipo_pago VARCHAR(20) NOT NULL, -- 'CONTADO', 'CREDITO', 'QR'
    estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA', -- 'EMITIDA', 'ANULADA'
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_venta_totales CHECK (total_neto >= 0)
);

CREATE TABLE IF NOT EXISTS ventas_detalle (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta BIGINT NOT NULL REFERENCES ventas_cabecera(id_venta) ON DELETE RESTRICT,
    id_almacen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(14,4) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    numero_serie VARCHAR(50),
    numero_lote VARCHAR(50),
    CONSTRAINT chk_detalle_cantidad CHECK (cantidad > 0)
);

CREATE TABLE IF NOT EXISTS facturas_fiscales (
    id_factura BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta BIGINT NOT NULL UNIQUE REFERENCES ventas_cabecera(id_venta) ON DELETE RESTRICT,
    numero_factura BIGINT NOT NULL,
    cuf VARCHAR(120) NOT NULL UNIQUE,
    cufd VARCHAR(120) NOT NULL,
    codigo_control VARCHAR(50),
    qr_data TEXT NOT NULL,
    estado_sin VARCHAR(20) NOT NULL DEFAULT 'VALIDA', -- 'VALIDA', 'ANULADA'
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata_sin JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_facturas_cuf ON facturas_fiscales(cuf);
CREATE INDEX IF NOT EXISTS idx_facturas_numero ON facturas_fiscales(numero_factura);
CREATE INDEX IF NOT EXISTS idx_facturas_metadata ON facturas_fiscales USING gin(metadata_sin);
