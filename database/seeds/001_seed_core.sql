-- =====================================================================
-- DIREMOR SAC - Datos Semilla Iniciales (PostgreSQL 16+)
-- Versión: 001_seed_core.sql
-- =====================================================================

-- 1. Inserción de Roles Base
INSERT INTO roles (codigo, nombre, permisos) VALUES
('ADMIN', 'Administrador del Sistema', '["*"]'::jsonb),
('VENTAS_POS', 'Cajero / Operador POS', '["ventas.crear", "ventas.consultar", "clientes.consultar", "caja.arqueo"]'::jsonb),
('ALMACEN', 'Encargado de Bodega', '["almacenes.consultar", "kardex.consultar", "traspasos.crear", "ajustes.crear"]'::jsonb),
('CONTABILIDAD', 'Contador General', '["contabilidad.asientos", "libros.consultar", "estados.financieros", "auditoria.ver"]'::jsonb)
ON CONFLICT (codigo) DO NOTHING;

-- 2. Inserción de Sucursales de DIREMOR S.R.L.
INSERT INTO sucursales (codigo, nombre, ciudad, direccion, telefono, es_matriz, activo) VALUES
('SCZ-MATRIZ', 'Casa Matriz - Santa Cruz', 'Santa Cruz', 'Av. Cristo Redentor esq. 4to Anillo', '+591 3 344-5134', TRUE, TRUE),
('CBB-SUC01', 'Sucursal Cochabamba', 'Cochabamba', 'Plazuela Constitución No. 810 Av. Salamanca', '+591 4 452-6517', FALSE, TRUE)
ON CONFLICT (codigo) DO NOTHING;

-- 3. Inserción de Almacenes Asociados
INSERT INTO almacenes (id_sucursal, codigo, nombre, tipo, activo)
SELECT s.id_sucursal, 'ALM-SCZ-CENTRAL', 'Almacén Central Santa Cruz', 'PRINCIPAL', TRUE
FROM sucursales s WHERE s.codigo = 'SCZ-MATRIZ'
ON CONFLICT (id_sucursal, codigo) DO NOTHING;

INSERT INTO almacenes (id_sucursal, codigo, nombre, tipo, activo)
SELECT s.id_sucursal, 'ALM-CBB-PISO', 'Almacén Ventas Cochabamba', 'VENTAS', TRUE
FROM sucursales s WHERE s.codigo = 'CBB-SUC01'
ON CONFLICT (id_sucursal, codigo) DO NOTHING;

-- 4. Parámetros de Dosificación Fiscal SIN (RND 102100000011)
INSERT INTO dosificaciones_sin (id_sucursal, modalidad, codigo_punto_venta, cufd_vigente, activo)
SELECT s.id_sucursal, 'ELECTRONICA_EN_LINEA', 0, 'CUFD_PILOTO_SCZ_MATRIZ_2026', TRUE
FROM sucursales s WHERE s.codigo = 'SCZ-MATRIZ'
ON CONFLICT (id_sucursal, codigo_punto_venta) DO NOTHING;

INSERT INTO dosificaciones_sin (id_sucursal, modalidad, codigo_punto_venta, cufd_vigente, activo)
SELECT s.id_sucursal, 'ELECTRONICA_EN_LINEA', 1, 'CUFD_PILOTO_CBB_AGENCIA_2026', TRUE
FROM sucursales s WHERE s.codigo = 'CBB-SUC01'
ON CONFLICT (id_sucursal, codigo_punto_venta) DO NOTHING;

-- 5. Usuario Administrador Inicial
-- Contraseña por defecto: Diremor2026! (Hasheada con bcrypt vía pgcrypto)
INSERT INTO usuarios (id_sucursal, id_rol, username, password_hash, nombre_completo, email, activo)
SELECT 
    s.id_sucursal,
    r.id_rol,
    'admin',
    crypt('Diremor2026!', gen_salt('bf', 12)),
    'Administrador Principal DIREMOR',
    'admin@diremor.com',
    TRUE
FROM sucursales s, roles r
WHERE s.codigo = 'SCZ-MATRIZ' AND r.codigo = 'ADMIN'
ON CONFLICT (username) DO NOTHING;
