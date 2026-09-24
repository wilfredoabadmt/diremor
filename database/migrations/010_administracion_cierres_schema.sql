-- =====================================================================
-- MIGRACIÓN 010: ADMINISTRACIÓN, CIERRE DE MESES Y PARÁMETROS
-- Control de Períodos Contables y Configuración por Sucursal
-- =====================================================================

-- 1. Tabla de Períodos Contables y Comerciales
CREATE TABLE IF NOT EXISTS periodos_contables (
    id_periodo INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    anio INT NOT NULL,
    mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')),
    fecha_cierre TIMESTAMPTZ,
    id_usuario_cierre BIGINT REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_periodo_anio_mes UNIQUE (anio, mes)
);

CREATE INDEX IF NOT EXISTS idx_periodos_anio_mes ON periodos_contables(anio, mes);
CREATE INDEX IF NOT EXISTS idx_periodos_estado ON periodos_contables(estado);

-- 2. Ampliación de Columnas de Configuración en Sucursales
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'telefono') THEN
        ALTER TABLE sucursales ADD COLUMN telefono VARCHAR(50) DEFAULT '3-3456789';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'email') THEN
        ALTER TABLE sucursales ADD COLUMN email VARCHAR(100) DEFAULT 'contacto@diremor.com.bo';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'leyenda_fiscal') THEN
        ALTER TABLE sucursales ADD COLUMN leyenda_fiscal TEXT DEFAULT 'Ley N° 453: El proveedor debe exhibir el precio total del bien o servicio en moneda nacional.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sucursales' AND column_name = 'codigo_punto_venta_sin') THEN
        ALTER TABLE sucursales ADD COLUMN codigo_punto_venta_sin INT DEFAULT 0;
    END IF;
END $$;
