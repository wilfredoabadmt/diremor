# Tasks: 008-compras-proveedores-dui

**Input**: Documentos de diseño de `specs/008-compras-proveedores-dui/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `007-cotizaciones-pedidos-reserva` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Lógica Transaccional (US1, US2, US3)

- [x] **T001** [DB] Crear migración `database/migrations/005_compras_dui_schema.sql` con tablas `proveedores`, `compras_cabecera`, `compras_detalle`, `importaciones_dui` y trigger PostgreSQL `trg_ingresar_kardex_compra`.
- [x] **T002** [US1] Implementar endpoints de gestión de proveedores (`POST /api/proveedores`, `GET /api/proveedores`, `GET /api/proveedores/:id`).
- [x] **T003** [US2] Implementar registro de compras locales (`POST /api/compras`, `GET /api/compras`, `GET /api/compras/:id`) con ingreso atómico a Kardex.
- [x] **T004** [US3] Implementar registro de importaciones con póliza DUI y prorrateo de costos (`POST /api/compras/importacion-dui`).
- [x] **T005** [US4] Implementar generación de alertas de reprecio y consulta (`GET /api/compras/alertas-reprecio`).
- [x] **T006** [Core] Registrar `proveedoresRouter` y `comprasRouter` en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y compilar con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [ ] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [ ] **T008** Disparar despliegue en Coolify y confirmar estado saludable (`healthy`).
- [ ] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_008.js`):
  - Creación de proveedor nacional e internacional.
  - Registro de compra local con aumento de stock y costo promedio en Kardex.
  - Registro de importación con póliza DUI y prorrateo de gastos de nacionalización.
  - Verificación de alertas de reprecio ante incremento de costo.
  - Validación de caminos infelices (duplicidad DUI, cantidades inválidas).
- [ ] **T010** Ejecutar suite completa de no-regresión (003, 005, 006, 007).
