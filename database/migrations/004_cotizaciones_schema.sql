-- =====================================================================
-- DIREMOR SAC - Esquema de Cotizaciones y Pedidos (PostgreSQL 16+)
-- Versión: 004_cotizaciones_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
--             Principio II (Gobernanza de Precios y Vigencia)
-- =====================================================================

CREATE TABLE IF NOT EXISTS cotizaciones_cabecera (
    id_cotizacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    total_bruto NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_neto NUMERIC(14,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'CONVERTIDA', 'VENCIDA', 'RECHAZADA'
    id_venta_generada BIGINT REFERENCES ventas_cabecera(id_venta) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones_cabecera(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones_cabecera(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_vencimiento ON cotizaciones_cabecera(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_sucursal ON cotizaciones_cabecera(id_sucursal);

CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones_cabecera(id_cotizacion) ON DELETE CASCADE,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(14,4) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    CONSTRAINT chk_cotizacion_cantidad CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_cotiz ON cotizaciones_detalle(id_cotizacion);
