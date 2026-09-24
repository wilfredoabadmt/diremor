-- =====================================================================
-- DIREMOR SAC - Módulo de Traspasos Multialmacén y Ajustes de Inventario
-- Migración: 006_traspasos_ajustes_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
-- =====================================================================

-- 1. CABECERA DE TRASPASOS ENTRE ALMACENES
CREATE TABLE IF NOT EXISTS traspasos_cabecera (
    id_traspaso BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal_origen INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_almacen_origen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    id_sucursal_destino INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_almacen_destino INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    id_usuario_envio BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    id_usuario_recepcion BIGINT REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    estado VARCHAR(20) NOT NULL DEFAULT 'EN_TRANSITO', -- 'EN_TRANSITO', 'RECIBIDO', 'RECHAZADO'
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_recepcion TIMESTAMPTZ,
    motivo TEXT,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_traspasos_almacen_distinto CHECK (id_almacen_origen <> id_almacen_destino)
);

CREATE INDEX IF NOT EXISTS idx_traspaso_alm_orig ON traspasos_cabecera(id_almacen_origen);
CREATE INDEX IF NOT EXISTS idx_traspaso_alm_dest ON traspasos_cabecera(id_almacen_destino);
CREATE INDEX IF NOT EXISTS idx_traspaso_estado ON traspasos_cabecera(estado);

-- 2. DETALLE DE TRASPASOS
CREATE TABLE IF NOT EXISTS traspasos_detalle (
    id_traspaso_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_traspaso BIGINT NOT NULL REFERENCES traspasos_cabecera(id_traspaso) ON DELETE CASCADE,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
    numero_serie VARCHAR(50),
    numero_lote VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_traspaso_det_traspaso ON traspasos_detalle(id_traspaso);
CREATE INDEX IF NOT EXISTS idx_traspaso_det_prod ON traspasos_detalle(codigo_producto);

-- 3. CABECERA DE AJUSTES DE INVENTARIO
CREATE TABLE IF NOT EXISTS ajustes_cabecera (
    id_ajuste BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_almacen INT NOT NULL REFERENCES almacenes(id_almacen) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    tipo_ajuste VARCHAR(30) NOT NULL, -- 'SOBRANTE', 'FALTANTE', 'MERMA', 'ROTURA', 'INVENTARIO_FISICO'
    motivo TEXT NOT NULL,
    fecha_ajuste TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ajustes_alm ON ajustes_cabecera(id_almacen);
CREATE INDEX IF NOT EXISTS idx_ajustes_tipo ON ajustes_cabecera(tipo_ajuste);

-- 4. DETALLE DE AJUSTES DE INVENTARIO
CREATE TABLE IF NOT EXISTS ajustes_detalle (
    id_ajuste_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_ajuste BIGINT NOT NULL REFERENCES ajustes_cabecera(id_ajuste) ON DELETE CASCADE,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    tipo_movimiento VARCHAR(10) NOT NULL, -- 'ENTRADA', 'SALIDA'
    cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
    costo_unitario NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
    subtotal NUMERIC(14,2) NOT NULL,
    numero_serie VARCHAR(50),
    numero_lote VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_ajustes_det_ajuste ON ajustes_detalle(id_ajuste);
CREATE INDEX IF NOT EXISTS idx_ajustes_det_prod ON ajustes_detalle(codigo_producto);
