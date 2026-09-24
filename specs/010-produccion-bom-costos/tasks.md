# Tasks: 010-produccion-bom-costos

**Input**: Documentos de diseño de `specs/010-produccion-bom-costos/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `009-traspasos-multialmacen-ajustes` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Lógica Fabril (US1, US2, US3, US4)

- [x] **T001** [DB] Crear migración `database/migrations/007_produccion_bom_schema.sql` con tablas `produccion_recetas_cabecera`, `produccion_recetas_detalle`, `produccion_ordenes`, `produccion_consumos_mp` y `produccion_costos_adicionales`.
- [x] **T002** [US1] Implementar endpoints de recetas BOM (`POST /api/produccion/recetas`, `GET /api/produccion/recetas`, `GET /api/produccion/recetas/:id`).
- [x] **T003** [US2] Implementar emisión y consulta de órdenes de producción (`POST /api/produccion/ordenes`, `GET /api/produccion/ordenes`, `GET /api/produccion/ordenes/:id`).
- [x] **T004** [US3] Implementar consumo de MP con descargo en Kardex (`POST /api/produccion/ordenes/:id/consumir-mp`) e imputación de MOD y CIF (`POST /api/produccion/ordenes/:id/imputar-costos`).
- [x] **T005** [US4] Implementar liquidación, cálculo del costo unitario e ingreso valorado de PT a Kardex (`POST /api/produccion/ordenes/:id/finalizar`).
- [x] **T006** [Core] Registrar `produccionRouter` en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y compilar limpiamente con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T008** Disparar despliegue en Coolify y confirmar estado saludable (`healthy`).
- [x] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_010.js`):
  - Creación de insumos y producto terminado.
  - Creación de receta BOM con insumos.
  - Emisión de orden de producción.
  - Consumo valorado de MP con descargo en Kardex.
  - Imputación de MOD y CIF.
  - Finalización de orden, absorción de costos e ingreso de PT al Kardex valorado.
  - Validación de caminos infelices (sobregiro MP 400, re-finalización 409).
- [x] **T010** Ejecutar suite completa de no-regresión (003, 005, 006, 007, 008, 009).
