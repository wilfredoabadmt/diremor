# Tasks: 002-productos-kardex

**Input**: Documentos de diseño de `specs/002-productos-kardex/` (`spec.md`, `plan.md`, `data-model.md`).  
**Prerequisites**: Feature `001-setup-db-core` desplegada y operativa en Coolify.

---

## Phase 1: Rutas de Categorías y Catálogo de Productos (US1)

- [x] **T001** [US1] Implementar endpoints de categorías `GET /api/productos/categorias` y `POST /api/productos/categorias` con autenticación JWT y roles autorizados.
- [x] **T002** [US1] Implementar endpoints de productos `POST /api/productos`, `GET /api/productos` (con paginación y búsqueda `?q=`), `GET /api/productos/:codigo` y `PUT /api/productos/:codigo`.
- [x] **T003** [US1] Registrar el router de productos en `src/index.ts` y validar tipado y compilación con `npm run build`.

---

## Phase 2: Existencias Multialmacén y Control de Stock Mínimo (US2)

- [x] **T004** [US2] Implementar el endpoint `GET /api/productos/:codigo/stock` que retorne el saldo acumulado en cada almacén cruzado con la sucursal y la bandera `alerta_stock_bajo`.

---

## Phase 3: Transaccionalidad de Kardex Físico-Valorado (US3 & US4)

- [x] **T005** [US3] Implementar `POST /api/kardex/movimientos` con transacción ACID en PostgreSQL para registro de entradas y salidas con cálculo automático de saldos y validación de stock no negativo.
- [x] **T006** [US4] Agregar validaciones de `numero_serie` y `numero_lote`/`fecha_vencimiento` para productos con banderas de trazabilidad activas.
- [x] **T007** [US3] Implementar `GET /api/kardex/:codigo_producto` con histórico de movimientos por almacén y orden cronológico.

---

## Phase 4: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [ ] **T008** Compilar código local, sincronizar cambios y subir a GitHub (`git push origin main`).
- [ ] **T009** Disparar despliegue en Coolify y confirmar que el contenedor se actualice a estado `running:healthy`.
- [ ] **T010** Ejecutar suite de pruebas E2E en vivo (crear categoría, registrar producto, realizar movimiento en kardex, consultar stock, verificar alertas y rechazo de salida con stock insuficiente).
