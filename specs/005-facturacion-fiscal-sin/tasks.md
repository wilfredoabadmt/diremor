# Tasks: 005-facturacion-fiscal-sin

**Input**: Documentos de diseño de `specs/005-facturacion-fiscal-sin/` (`spec.md`, `plan.md`).  
**Prerequisites**: Feature `001-setup-db-core`, `002-productos-kardex`, `003-clientes-credito-mora` y `004-ventas-pos-facturacion` completadas y verificadas.

---

## Phase 1: Lógica Fiscal y Controladores (US1, US2, US3, US4)

- [x] **T001** [SIN Core] Implementar `src/utils/sinFiscal.ts`:
  - Cálculo de dígito verificador Módulo 11 (algoritmo oficial SIN).
  - Algoritmo generador de CUF (campos fijos + Base 16 Hexadecimal).
  - Constructor de cadena oficial para Código QR Fiscal.
- [x] **T002** [US1] Implementar `POST /api/facturas`:
  - Validación de existencia y estado de la venta.
  - Comprobación de no duplicidad (una venta = una factura).
  - Asignación de correlativo automático por sucursal.
  - Obtención de CUFD activo desde `dosificaciones_sin`.
  - Inserción en `facturas_fiscales`.
- [x] **T003** [US3] Implementar `GET /api/facturas/:id` y `GET /api/facturas/venta/:id_venta` con representación completa.
- [x] **T004** [US4] Implementar `POST /api/facturas/:id/anular` con motivo SIN y opción de sincronización con la venta.
- [x] **T005** [Core] Registrar `facturacionRouter` en `src/index.ts` y validar compilación limpia con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [ ] **T006** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [ ] **T007** Disparar despliegue en Coolify y confirmar estado saludable (`running:healthy`).
- [ ] **T008** Crear y ejecutar script E2E en vivo (`scratch/test_live_005.js`):
  - Emisión de venta POS.
  - Emisión de factura fiscal con generación de CUF y QR válidos.
  - Intento de re-facturación sobre la misma venta (rechazo HTTP 409).
  - Consulta de factura completa por ID y por ID de venta.
  - Anulación de factura fiscal con motivo reglamentario.
  - Intento de anular una factura ya anulada (rechazo HTTP 400).
