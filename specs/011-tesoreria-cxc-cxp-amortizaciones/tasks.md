# Tasks: 011-tesoreria-cxc-cxp-amortizaciones

**Input**: Documentos de diseño de `specs/011-tesoreria-cxc-cxp-amortizaciones/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `010-produccion-bom-costos` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Lógica Financiera (US1, US2, US3, US4, US5)

- [x] **T001** [DB] Crear migración `database/migrations/008_tesoreria_cxc_cxp_schema.sql` con tablas `cxc_cuentas`, `cxc_cobros`, `cxp_cuentas` y `cxp_pagos`.
- [x] **T002** [US1] Implementar endpoints de Cuentas por Cobrar (`POST /api/tesoreria/cxc`, `GET /api/tesoreria/cxc`, `GET /api/tesoreria/cxc/:id`).
- [x] **T003** [US2] Implementar cobros de clientes (`POST /api/tesoreria/cxc/cobros`) con emisión de recibos y desbloqueo automático de mora.
- [x] **T004** [US3, US4] Implementar Cuentas por Pagar y pagos a proveedores (`POST /api/tesoreria/cxp`, `GET /api/tesoreria/cxp`, `POST /api/tesoreria/cxp/pagos`, `GET /api/tesoreria/cxp/:id`).
- [x] **T005** [US5] Implementar reportes de Antigüedad de Saldos y Estados de Cuenta (`GET /api/tesoreria/cxc/antiguedad-saldos`, `GET /api/tesoreria/cxc/estado-cuenta/:id_cliente`, `GET /api/tesoreria/cxp/estado-cuenta/:id_proveedor`).
- [x] **T006** [Core] Registrar `tesoreriaRouter` en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y compilar con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T008** Disparar despliegue en Coolify y confirmar estado saludable (`healthy`).
- [x] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_011.js`):
  - Creación de CxC y amortización parcial/total con recibos de cobranza.
  - Validación de desbloqueo automático de mora tras saldo deudor en cero.
  - Creación de CxP y amortización a proveedor con comprobante de egreso.
  - Generación de reporte de Antigüedad de Saldos (tramos por vencimiento).
  - Validación de caminos infelices (sobre-amortización 400, recibo duplicado 409).
- [x] **T010** Ejecutar suite completa de no-regresión (003, 005, 006, 007, 008, 009, 010).
