# Architecture & Implementation Plan: 006-cajas-turnos-arqueos

## 1. Diseño de Base de Datos y Modelo DDL
Para soportar el ciclo de cajas y turnos sin modificar ni romper el esquema existente, se define la migración `database/migrations/003_cajas_turnos_schema.sql`:

```sql
-- Cajas Físicas
CREATE TABLE IF NOT EXISTS cajas_fisicas (
    id_caja INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    codigo VARCHAR(20) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_caja_sucursal_codigo UNIQUE(id_sucursal, codigo)
);

-- Turnos de Caja
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

-- Movimientos Manuales en Turno (Ingresos / Egresos)
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
```

---

## 2. Contratos de API (Endpoints)

### 2.1. `GET /api/cajas` y `POST /api/cajas`
- Permite listar y registrar cajas físicas en la sucursal del usuario o en cualquier sucursal (para administradores).

### 2.2. `POST /api/cajas/turnos/abrir`
- **Request**:
```json
{
  "id_caja": 1,
  "monto_apertura": 200.00,
  "observaciones": "Apertura turno mañana"
}
```
- **Validaciones**:
  - Verifica que el usuario no tenga ya un turno abierto.
  - Verifica que la caja física no esté ya ocupada por un turno abierto.

### 2.3. `GET /api/cajas/turnos/activo`
- Devuelve el turno actualmente abierto para el usuario en sesión (o `null` si no tiene turno abierto).

### 2.4. `POST /api/cajas/turnos/:id/movimientos`
- Registra un ingreso o egreso de caja menor:
```json
{
  "tipo": "EGRESO", // "INGRESO" | "EGRESO"
  "monto": 35.00,
  "concepto": "Compra de artículos de limpieza urgente"
}
```

### 2.5. `POST /api/cajas/turnos/:id/cerrar`
- Realiza el **Arqueo Ciego**:
```json
{
  "monto_efectivo_declarado": 2165.00,
  "observaciones": "Cierre conforme sin novedades"
}
```
- **Cálculo del Arqueo**:
  - `ventas_efectivo`: `SELECT COALESCE(SUM(total_neto), 0) FROM ventas_cabecera WHERE id_usuario = $1 AND id_sucursal = $2 AND tipo_pago = 'CONTADO' AND fecha_venta >= $fecha_apertura AND fecha_venta <= CURRENT_TIMESTAMP AND estado = 'EMITIDA'`
  - `ventas_qr`: cobros QR en el mismo intervalo.
  - `ventas_credito`: ventas a crédito en el mismo intervalo.
  - `total_ingresos`: suma de movimientos tipo `INGRESO`.
  - `total_egresos`: suma de movimientos tipo `EGRESO`.
  - `saldo_teorico = monto_apertura + ventas_efectivo + total_ingresos - total_egresos`.
  - `diferencia = monto_efectivo_declarado - saldo_teorico`.
  - Guarda `resumen_ventas` en JSONB para congelar los valores del arqueo.

---

## 3. Principios SDD Aplicados
- **Inalterabilidad Contable (Principio VII)**: Los datos del corte quedan congelados en el registro del turno y nunca se recalculan a posteriori.
- **Aislamiento Multi-Sucursal (Principio III)**: Cada turno y caja pertenece a una sucursal física determinada.
- **Verificación en Vivo en Coolify (Principio IX)**: Suite E2E completa en `scratch/test_live_006.js`.
