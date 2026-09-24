# Tasks: 012-contabilidad-general-asientos

**Input**: Documentos de diseño de `specs/012-contabilidad-general-asientos/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `011-tesoreria-cxc-cxp-amortizaciones` completadas y verificadas en producción.

---

## Phase 1: Esquema de Base de Datos y Lógica Contable (US1, US2, US3, US4, US5)

- [x] **T001** [DB] Crear migración `database/migrations/009_contabilidad_schema.sql` con tablas `plan_cuentas`, `asientos_cabecera`, `asientos_detalle` y seed contable estándar boliviano.
- [x] **T002** [US1] Implementar endpoints de Plan de Cuentas (`GET /api/contabilidad/cuentas`, `POST /api/contabilidad/cuentas`).
- [x] **T003** [US2] Implementar registro de asientos contables (`POST /api/contabilidad/asientos`, `GET /api/contabilidad/asientos`, `GET /api/contabilidad/asientos/:id`, `PUT /api/contabilidad/asientos/:id/anular`) con validación estricta de partida doble ($\sum Debe = \sum Haber$) y cuentas imputables.
- [x] **T004** [US3, US4] Implementar reportes de Libro Diario (`GET /api/contabilidad/libro-diario`), Libro Mayor (`GET /api/contabilidad/libro-mayor`) y Balance de Sumas y Saldos (`GET /api/contabilidad/balance-sumas-saldos`).
- [x] **T005** [US5] Implementar reportes de Libros Fiscales IVA (`GET /api/contabilidad/libros-fiscales/ventas-iva`, `GET /api/contabilidad/libros-fiscales/compras-iva`).
- [x] **T006** [Core] Registrar `contabilidadRouter` en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y validar compilación local con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T008** Disparar despliegue en Coolify y confirmar estado finalizado (`finished`).
- [x] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_012.js`):
  - Consulta del Plan de Cuentas y alta de cuenta imputable.
  - Validación de camino infeliz: Intento de asiento desbalanceado ($\Delta \ne 0 \rightarrow 400$).
  - Validación de camino infeliz: Intento de asentar en cuenta no imputable ($\rightarrow 400$).
  - Registro exitoso de Asiento de Ingreso, Egreso y Traspaso balanceados.
  - Consulta de Libro Diario cronológico.
  - Consulta de Libro Mayor con saldos acumulados deudores/acreedores.
  - Emisión de Balance de Comprobación de Sumas y Saldos cuadrado.
  - Consulta de reportes fiscales de Ventas IVA y Compras IVA.
  - Anulación de asiento contable y confirmación de estado.
- [x] **T010** Ejecutar suite completa de no-regresión (003, 005, 006, 007, 008, 009, 010, 011).
