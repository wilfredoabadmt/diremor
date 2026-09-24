# Tasks: 009-traspasos-multialmacen-ajustes

**Input**: Documentos de diseño de `specs/009-traspasos-multialmacen-ajustes/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `008-compras-proveedores-dui` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Lógica Transaccional (US1, US2, US3, US4)

- [x] **T001** [DB] Crear migración `database/migrations/006_traspasos_ajustes_schema.sql` con tablas `traspasos_cabecera`, `traspasos_detalle`, `ajustes_cabecera` y `ajustes_detalle`.
- [x] **T002** [US1] Implementar despacho de traspaso (`POST /api/traspasos`) con verificación de saldo en origen y descuento atómico a tránsito en Kardex.
- [x] **T003** [US2] Implementar recepción de traspaso (`POST /api/traspasos/:id/recibir`) con acreditación física en almacén de destino.
- [x] **T004** [US3] Implementar rechazo y reversión de traspaso (`POST /api/traspasos/:id/rechazar`).
- [x] **T005** [US4] Implementar ajustes de inventario físico (`POST /api/ajustes`, `GET /api/ajustes`, `GET /api/ajustes/:id`) para mermas, roturas, sobrantes y faltantes.
- [x] **T006** [Core] Registrar `traspasosRouter` y `ajustesRouter` en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y compilar con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T008** Disparar despliegue en Coolify y confirmar estado saludable (`healthy`).
- [x] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_009.js`):
  - Creación de producto y abastecimiento en almacén origen.
  - Despacho de traspaso hacia almacén secundario y verificación de estado `EN_TRANSITO`.
  - Confirmación de recepción física en almacén destino y verificación de stock en ambos almacenes.
  - Validación de caminos infelices (re-recepción 409, almacenes idénticos 400, sobregiro 400).
  - Registro de ajuste positivo (sobrante) y verificación de incremento en Kardex.
  - Registro de ajuste negativo (merma/rotura) y verificación de descuento en Kardex.
- [x] **T010** Ejecutar suite completa de no-regresión (003, 005, 006, 007, 008).
