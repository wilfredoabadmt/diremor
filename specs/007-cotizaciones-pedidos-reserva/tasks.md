# Tasks: 007-cotizaciones-pedidos-reserva

**Input**: Documentos de diseño de `specs/007-cotizaciones-pedidos-reserva/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core`, `002-productos-kardex`, `003-clientes-credito-mora`, `004-ventas-pos-facturacion`, `005-facturacion-fiscal-sin` y `006-cajas-turnos-arqueos` completadas y verificadas.

---

## Phase 1: Esquema de Base de Datos y Rutas de Cotizaciones (US1, US2, US3, US4)

- [x] **T001** [DB] Crear migración `database/migrations/004_cotizaciones_schema.sql` y función de inicialización idempotente.
- [x] **T002** [US1] Implementar emisión de cotizaciones (`POST /api/cotizaciones`) con cálculo de vencimiento y totales.
- [x] **T003** [US3] Implementar consulta de cotizaciones (`GET /api/cotizaciones`, `GET /api/cotizaciones/:id`).
- [x] **T004** [US2] Implementar conversión de cotización a venta POS (`POST /api/cotizaciones/:id/convertir-a-venta`) con transacción ACID y descargo en Kardex.
- [x] **T005** [US4] Implementar rechazo/cancelación de cotizaciones (`POST /api/cotizaciones/:id/rechazar`).
- [x] **T006** [Core] Registrar `cotizacionesRouter` en `src/index.ts`, actualizar portal y catálogo API, y validar compilación limpia con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T007** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T008** Disparar despliegue en Coolify y confirmar estado saludable (`running:healthy`).
- [x] **T009** Crear y ejecutar script E2E en vivo (`scratch/test_live_007.js`):
  - Emisión de cotización comercial con 15 días de validez.
  - Consulta de detalle de cotización con cálculo de vigencia.
  - Conversión exitosa de cotización a venta POS y verificación de stock restado en Kardex.
  - Intento de re-convertir cotización ya convertida (rechazo HTTP 409).
  - Emisión de cotización vencida artificialmente e intento de conversión (rechazo HTTP 400).
  - Emisión de cotización y rechazo/cancelación explícita.
