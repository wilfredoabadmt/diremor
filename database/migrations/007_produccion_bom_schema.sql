-- =====================================================================
-- DIREMOR SAC - Módulo de Producción Fabril, Recetas (BOM) y Costos
-- Migración: 007_produccion_bom_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
-- =====================================================================

-- 1. MAESTRO DE RECETAS DE FABRICACIÓN (BOM - Bill of Materials)
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

-- 2. DETALLE DE INSUMOS DE LA RECETA
CREATE TABLE IF NOT EXISTS produccion_recetas_detalle (
    id_receta_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_receta BIGINT NOT NULL REFERENCES produccion_recetas_cabecera(id_receta) ON DELETE CASCADE,
    codigo_insumo VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    cantidad_requerida NUMERIC(12,4) NOT NULL CHECK (cantidad_requerida > 0),
    merma_permitida_pct NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (merma_permitida_pct >= 0)
);

CREATE INDEX IF NOT EXISTS idx_recetas_det_receta ON produccion_recetas_detalle(id_receta);
CREATE INDEX IF NOT EXISTS idx_recetas_det_insumo ON produccion_recetas_detalle(codigo_insumo);

-- 3. CABECERA DE ÓRDENES DE PRODUCCIÓN
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
    estado VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADA', -- 'PLANIFICADA', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA'
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

-- 4. CONSUMOS REALES DE MATERIA PRIMA (MP)
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

-- 5. COSTOS ADICIONALES (MOD - MANO DE OBRA Y CIF - COSTOS INDIRECTOS)
CREATE TABLE IF NOT EXISTS produccion_costos_adicionales (
    id_costo_adicional BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_orden BIGINT NOT NULL REFERENCES produccion_ordenes(id_orden) ON DELETE CASCADE,
    tipo_costo VARCHAR(10) NOT NULL, -- 'MOD', 'CIF'
    descripcion VARCHAR(150) NOT NULL,
    horas_hombre NUMERIC(8,2) NOT NULL DEFAULT 0.00 CHECK (horas_hombre >= 0),
    tarifa_hora NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (tarifa_hora >= 0),
    monto_total NUMERIC(14,2) NOT NULL CHECK (monto_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_costos_adic_orden ON produccion_costos_adicionales(id_orden);
