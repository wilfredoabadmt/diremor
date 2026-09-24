# Tasks: 006-cajas-turnos-arqueos

**Input**: Documentos de diseño de `specs/006-cajas-turnos-arqueos/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core`, `002-productos-kardex`, `003-clientes-credito-mora`, `004-ventas-pos-facturacion` y `005-facturacion-fiscal-sin` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Rutas de Cajas (US1, US2, US3, US4, US5)

- [x] **T001** [DB] Crear migración `database/migrations/003_cajas_turnos_schema.sql` y función de inicialización de tablas si no existen.
- [x] **T002** [US1] Implementar endpoints de gestión de cajas físicas (`GET /api/cajas`, `POST /api/cajas`).
- [x] **T003** [US2] Implementar apertura de turnos (`POST /api/cajas/turnos/abrir`, `GET /api/cajas/turnos/activo`) con validaciones de no concurrencia.
- [x] **T004** [US3] Implementar movimientos manuales (`POST /api/cajas/turnos/:id/movimientos`).
- [x] **T005** [US4] Implementar arqueo ciego y cierre de turno (`POST /api/cajas/turnos/:id/cerrar`).
- [x] **T006** [US5] Implementar consulta y detalle de turnos (`GET /api/cajas/turnos`, `GET /api/cajas/turnos/:id`).
- [x] **T007** [Core] Registrar `cajasRouter` en `src/index.ts`, actualizar portal y catálogo API, y validar compilación limpia con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T008** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T009** Disparar despliegue en Coolify y confirmar estado saludable (`running:healthy`).
- [x] **T010** Crear y ejecutar script E2E en vivo (`scratch/test_live_006.js`):
  - [x] Creación y listado de caja física (auto-creación de `CAJA-01`).
  - [x] Apertura de turno con monto inicial de 200.00 Bs.
  - [x] Intento de abrir un segundo turno concurrente (rechazo HTTP 409).
  - [x] Consulta de turno activo.
  - [x] Emisión de venta POS en efectivo durante el turno (300.00 Bs).
  - [x] Registro de movimiento manual (ingreso de 50 Bs y egreso de 20 Bs).
  - [x] Ejecución de arqueo ciego declarando efectivo físico (530.00 Bs).
  - [x] Comprobación de saldo teórico exacto (530.00 Bs) y cálculo de diferencia de corte (0.00 Bs, CUADRADO).
  - [x] Intento de registrar movimiento o re-cerrar turno cerrado (rechazo HTTP 400). Todos los 12 tests E2E aprobados.
