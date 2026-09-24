# Tasks: 003-clientes-credito-mora

**Input**: Documentos de diseño de `specs/003-clientes-credito-mora/` (`spec.md`, `plan.md`).  
**Prerequisites**: Feature `001-setup-db-core` y `002-productos-kardex` completadas y verificadas.

---

## Phase 1: Rutas y Lógica de Negocio de Clientes (US1, US2, US3)

- [x] **T001** [US3] Implementar `GET /api/clientes/generico` para auto-inicializar o devolver el cliente mostrador ("Sin Nombre", NIT "0").
- [x] **T002** [US1] Implementar `GET /api/clientes` (con búsqueda y filtros), `POST /api/clientes`, `GET /api/clientes/:id` y `PUT /api/clientes/:id`.
- [x] **T003** [US2] Implementar `PATCH /api/clientes/:id/credito` para gobernanza de límites de crédito y bloqueo de mora (`ADMIN`, `CONTABILIDAD`).
- [x] **T004** [US2] Implementar `GET /api/clientes/:id/evaluacion-credito` que evalúe si el cliente puede comprar a crédito validando mora y saldo disponible.
- [x] **T005** [Core] Registrar `clientesRouter` en `src/index.ts` y validar compilación limpia con `npm run build`.

---

## Phase 2: Despliegue en Coolify y Verificación en Vivo (Principio IX)

- [x] **T006** Sincronizar cambios en git y enviar a GitHub (`git push origin main`).
- [x] **T007** Disparar despliegue en Coolify y confirmar estado `running:healthy`.
- [x] **T008** Ejecutar suite de pruebas E2E en vivo (crear cliente, consultar genérico, evaluar crédito normal, activar bloqueo por mora y comprobar rechazo de crédito). Todos los 11 tests E2E aprobados.
