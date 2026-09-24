# Tasks: 013-administracion-cierres-impresion-mediacarta

**Input**: Documentos de diseño de `specs/013-administracion-cierres-impresion-mediacarta/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core` hasta `012-contabilidad-general-asientos` completadas y verificadas en producción.

---

## Phase 1: Esquema de Base de Datos y Lógica Administrativa (US1, US2, US3)

- [x] **T001** [DB] Crear migración `database/migrations/010_administracion_cierres_schema.sql` con tabla `periodos_contables` y columnas de configuración en `sucursales`.
- [x] **T002** [US1, US2] Implementar endpoints de Administración (`src/routes/administracion.ts`):
  - Consulta y verificación de períodos (`GET /api/administracion/periodos`, `GET /api/administracion/periodos/verificar`).
  - Cierre y reapertura de períodos (`POST /api/administracion/periodos/cerrar`, `POST /api/administracion/periodos/reabrir`).
  - Parámetros de sucursal (`GET /api/administracion/sucursales/:id`, `PUT /api/administracion/sucursales/:id`).
- [x] **T003** [US3] Implementar motor de renderizado de plantillas Media Carta (`src/routes/impresion.ts`):
  - Comprobante Contable (`GET /api/impresion/comprobante/:id`).
  - Factura Fiscal SIN (`GET /api/impresion/factura/:id`).
  - Recibo Oficial de Cobranza (`GET /api/impresion/recibo-cobro/:id`).
  - Proforma / Cotización (`GET /api/impresion/proforma/:id`).
- [x] **T004** [Core] Registrar routers en `src/index.ts`, actualizar portal (`src/portal.ts`) y catálogo API (`/api`), y validar compilación local con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T005** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T006** Disparar despliegue en Coolify y confirmar estado finalizado (`finished`).
- [x] **T007** Crear y ejecutar script E2E en vivo (`scratch/test_live_013.js`):
  - Consulta y actualización de parámetros de sucursal.
  - Cierre de período mensual (ej. mes anterior) y verificación de estado `CERRADO`.
  - Intento de operación en período cerrado (bloqueo verificado).
  - Reapertura de período mensual y confirmación de estado `ABIERTO`.
  - Renderizado HTML de Comprobante Contable Media Carta con firmas.
  - Renderizado HTML de Factura Fiscal Media Carta con CUF y QR.
  - Renderizado HTML de Recibo de Cobranza Media Carta con importe literal.
  - Renderizado HTML de Proforma Comercial Media Carta.
- [x] **T008** Ejecutar suite completa de no-regresión (003, 005, 006, 010, 011, 012).
