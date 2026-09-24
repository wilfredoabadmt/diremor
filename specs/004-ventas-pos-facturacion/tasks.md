# Tasks: 004-ventas-pos-facturacion

**Input**: Documentos de diseño de `specs/004-ventas-pos-facturacion/` (`spec.md`, `plan.md`).  
**Prerequisites**: Features `001-setup-db-core`, `002-productos-kardex` y `003-clientes-credito-mora` completadas y verificadas.

---

## Phase 1: Rutas y Lógica Transaccional de Ventas (US1, US2, US3, US4, US5)

- [x] **T001** [US1, US2, US3] Implementar `POST /api/ventas` con transacción ACID en PostgreSQL:
  - Validación de cliente activo y evaluación crediticia si `tipo_pago = 'CREDITO'`.
  - Validación de stock disponible y números de serie obligatorios por ítem.
  - Inserción en `ventas_cabecera` y `ventas_detalle`.
  - Generación de salidas en `kardex_movimientos` con recálculo de saldo y saldo valorado.
- [x] **T002** [US4] Implementar `GET /api/ventas` con filtros y paginación.
- [x] **T003** [US4] Implementar `GET /api/ventas/:id` con la cabecera y el array detallado de ítems.
- [x] **T004** [US5] Implementar `POST /api/ventas/:id/anular` con reversión en Kardex de los ítems vendidos.
- [x] **T005** [Core] Registrar `ventasRouter` en `src/index.ts` y validar compilación limpia con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [ ] **T006** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [ ] **T007** Disparar despliegue en Coolify y confirmar estado saludable.
- [ ] **T008** Crear y ejecutar script E2E en vivo (`scratch/test_live_004.js`):
  - Venta de mostrador (Contado) con decremento automático en Kardex.
  - Venta a crédito exitosa (dentro de límite de crédito).
  - Rechazo de venta a crédito por exceder límite de crédito.
  - Rechazo de venta a crédito por cliente con bloqueo por mora.
  - Rechazo de venta por falta de stock (camino infeliz).
  - Rechazo de venta por falta de número de serie obligatorio (camino infeliz).
  - Consulta de detalle de venta.
  - Anulación de venta y comprobación de reposición de stock en Kardex.
