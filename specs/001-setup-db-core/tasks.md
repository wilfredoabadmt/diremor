# Tasks: 001-setup-db-core

**Input**: Documentos de diseño de `specs/001-setup-db-core/` (`spec.md`, `plan.md`, `data-model.md`, `contracts/`).  
**Prerequisites**: Aprobación de la Constitución de DIREMOR SAC (v2.0.0) y Plan de Implementación.

---

## Phase 1: Configuración de Infraestructura y Despliegue en Coolify

- [x] **T001** Crear el archivo de definición de orquestación `docker-compose.yml` para Coolify con servicios `sac-postgres` (PostgreSQL 16 en red privada `coolify-network`), `sac-api` (Backend con labels de Traefik) y volúmenes persistentes.
- [x] **T002** Configurar el template de variables de entorno `.env.example` con los parámetros obligatorios de conexión interna a PostgreSQL, secreto JWT y configuración de puerto.

---

## Phase 2: Esquema Relacional Core en PostgreSQL (User Story 3 - P1)

- [x] **T003** [US3] Crear script de migración DDL `database/migrations/001_initial_schema.sql` conteniendo las tablas `sucursales`, `roles`, `usuarios`, `almacenes`, `dosificaciones_sin`, `clientes`, `productos`, `kardex_movimientos`, `ventas_cabecera`, `facturas_fiscales` con llaves foráneas `ON DELETE RESTRICT` e índices B-Tree.
- [x] **T004** [US3] Crear script de datos semilla iniciales `database/seeds/001_seed_core.sql` con la Casa Matriz (Santa Cruz), Sucursal Cochabamba, roles predefinidos (`ADMIN`, `VENTAS_POS`, `ALMACEN`, `CONTABILIDAD`) y usuario administrador inicial con contraseña hasheada.
- [x] **T005** [US3] Implementar la función transaccional en PL/pgSQL y disparador en `database/migrations/002_kardex_trigger.sql` para el descuento atómico de stock físico y valorado en Kardex.

---

## Phase 3: Servicio de Monitoreo y Salud (User Story 4 - P2)

- [x] **T006** [US4] Implementar el endpoint `GET /api/health` en el backend para verificar conectividad con PostgreSQL (`SELECT 1`) y reportar estado para Traefik y Coolify conforme al contrato `contracts/api-contracts.yaml`.
- [x] **T007** [US4] Configurar la directiva de healthcheck en `docker-compose.yml` y validar que retorne HTTP 200 cuando la base de datos está conectada y HTTP 503 ante fallas simuladas.

---

## Phase 4: Autenticación, RBAC y Contexto Multi-Sucursal (User Story 1 & 2 - P1)

- [x] **T008** [US1] Implementar el servicio de autenticación con hash de contraseñas (Argon2id/bcrypt) y generación de tokens JWT firmados con claim de `id_usuario`, `rol` y `id_sucursal`.
- [x] **T009** [US1] Implementar el endpoint `POST /api/auth/login` y el middleware de protección de rutas JWT (`verifyToken` y `requireRole`).
- [x] **T010** [US1] Implementar el endpoint `GET /api/auth/me` para retornar el perfil del usuario autenticado y su lista de permisos.
- [x] **T011** [US2] Implementar el endpoint `GET /api/sucursales` y `GET /api/almacenes` con filtrado por sucursal activa.

---

## Phase 5: Verificación de Comportamiento en Vivo (Principio IX)

- [ ] **T012** Ejecutar prueba E2E de inicio de sesión exitoso y validación de restricción de acceso con token inválido o expirado.
- [ ] **T013** Verificar que el puerto 5432 de PostgreSQL no sea accesible desde el exterior del contenedor y que la comunicación solo ocurra dentro de `coolify-network`.
- [ ] **T014** Ejecutar prueba de verificación de salud en `/api/health` confirmando tiempo de respuesta < 50ms.
