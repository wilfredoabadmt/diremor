-- =====================================================================
-- DIREMOR SAC - Esquema de Cajas Físicas, Turnos y Arqueos (PostgreSQL 16+)
-- Versión: 003_cajas_turnos_schema.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
--             Principio VII (Inalterabilidad Contable)
-- =====================================================================

-- 1. Cajas Físicas / Puntos de Cobro
CREATE TABLE IF NOT EXISTS cajas_fisicas (
    id_caja INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_caja_sucursal_codigo UNIQUE(id_sucursal, codigo)
);

CREATE INDEX IF NOT EXISTS idx_cajas_sucursal ON cajas_fisicas(id_sucursal);

-- 2. Turnos de Caja (Apertura, Arqueo Ciego y Cierre)
CREATE TABLE IF NOT EXISTS cajas_turnos (
    id_turno BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_caja INT NOT NULL REFERENCES cajas_fisicas(id_caja) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMPTZ,
    monto_apertura NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    monto_efectivo_declarado NUMERIC(14,2),
    monto_teorico_efectivo NUMERIC(14,2),
    diferencia_corte NUMERIC(14,2),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO', -- 'ABIERTO', 'CERRADO'
    observaciones TEXT,
    resumen_ventas JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turnos_usuario_estado ON cajas_turnos(id_usuario, estado);
CREATE INDEX IF NOT EXISTS idx_turnos_caja_estado ON cajas_turnos(id_caja, estado);
CREATE INDEX IF NOT EXISTS idx_turnos_sucursal ON cajas_turnos(id_sucursal);

-- 3. Movimientos Manuales en Turno (Ingresos de cambio / Egresos menores)
CREATE TABLE IF NOT EXISTS cajas_movimientos_manuales (
    id_movimiento BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_turno BIGINT NOT NULL REFERENCES cajas_turnos(id_turno) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    tipo VARCHAR(20) NOT NULL, -- 'INGRESO', 'EGRESO'
    monto NUMERIC(14,2) NOT NULL,
    concepto VARCHAR(250) NOT NULL,
    fecha TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_monto_movimiento CHECK (monto > 0)
);

CREATE INDEX IF NOT EXISTS idx_mov_cajas_turno ON cajas_movimientos_manuales(id_turno);
