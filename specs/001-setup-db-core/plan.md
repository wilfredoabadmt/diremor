# Implementation Plan: 001-setup-db-core

**Branch**: `001-setup-db-core` | **Date**: 2026-09-23 | **Spec**: [specs/001-setup-db-core/spec.md](spec.md)

---

## Summary

Establecimiento del núcleo fundacional del sistema SAC para DIREMOR S.R.L. adaptado a Coolify PaaS: provisión de persistencia en PostgreSQL 16+ sobre red privada Docker (`coolify-network`), migraciones DDL con integridad referencial ACID, módulo de autenticación segura con JWT y contexto multi-sucursal (Casa Matriz y agencias), y endpoint de supervisión `/api/health` para Traefik y Coolify.

---

## Technical Context

* **Plataforma de Despliegue:** Coolify PaaS (Docker Engine 26+, Traefik Reverse Proxy con TLS 1.3 automático).
* **Motor de Persistencia:** PostgreSQL 16+ (Alpine) en red aislada sin puertos públicos expuestos.
* **Backend Runtime:** Node.js (TypeScript) / .NET 8 con conexión pooling y migraciones DDL automáticas.
* **Seguridad & Auth:** JSON Web Tokens (JWT) con HMAC-SHA256 y hashing de contraseñas con Argon2id / bcrypt.
* **Contratos de API:** OpenAPI 3.0 para endpoints `/api/health`, `/api/auth/login`, `/api/auth/me`, `/api/sucursales`.
* **Testing:** Pruebas unitarias de integridad de datos y tests de integración HTTP de punta a punta.

---

## Constitution Check

*GATE: Evaluación frente a los 9 principios de la Constitución de DIREMOR SAC (v2.0.0).*

| Principio Constitucional | Estado | Evidencia y Justificación Técnica |
| :--- | :---: | :--- |
| **I. Seguridad & Consistencia ACID** | **PASSED** | Transacciones atómicas en PostgreSQL, hashing seguro de contraseñas y cero secretos en logs o respuestas. |
| **II. Soberanía / Self-Hosted Coolify** | **PASSED** | PostgreSQL 16+ desplegado en contenedor sin dependencias de Oracle ni SaaS externos. |
| **III. Multi-Sucursal en Tiempo Real** | **PASSED** | Entidades `sucursales` y `almacenes` como scope primario en el modelo de datos y claims de JWT. |
| **IV. Idempotencia y Norma SIN** | **PASSED** | Tabla `dosificaciones_sin` lista para albergar CUFD, modalidades y puntos de venta según RND 102100000011. |
| **V. Calidad Verificable** | **PASSED** | Typecheck estricto, migraciones idempotentes y suite de pruebas de integración. |
| **VI. Specs Antes de Código** | **PASSED** | Especificación completada en `spec.md`, investigación en `research.md`, contratos en `contracts/`. |
| **VII. Inalterabilidad y Auditoría** | **PASSED** | Reglas `ON DELETE RESTRICT` en todas las llaves foráneas y trazabilidad con `created_at` y `updated_at`. |
| **VIII. Foco Vertical DIREMOR** | **PASSED** | Estructura preparada para multialmacén, control de series/lotes y facturación en media carta. |
| **IX. Verificación en Vivo** | **PASSED** | Endpoint `/api/health` real y plan de pruebas de integración E2E sobre contenedor. |

---

## Project Structure

```text
specs/001-setup-db-core/
├── spec.md              # Especificación funcional de requerimientos y criterios de éxito
├── research.md          # Decisiones técnicas arquitectónicas (PostgreSQL, Docker, JWT)
├── data-model.md        # Definición DDL y entidades del núcleo (Sucursales, Roles, Usuarios, Almacenes)
├── contracts/           # Contratos OpenAPI 3.0 de endpoints core
│   └── api-contracts.yaml
├── quickstart.md        # Guía de ejecución local y despliegue en Coolify
├── plan.md              # Plan de implementación (este documento)
└── tasks.md             # Tareas ordenadas por dependencias (Fase siguiente)
```

---

## Fases de Ejecución

### Fase 0: Investigación y Decisiones (COMPLETADA)
* Verificación de viabilidad en Coolify PaaS y descarte de Oracle XE a favor de PostgreSQL 16+.
* Documentado formalmente en [`research.md`](research.md).

### Fase 1: Diseño y Contratos (COMPLETADA)
* Modelado entidad-relación y diccionario de datos en [`data-model.md`](data-model.md).
* Especificación OpenAPI 3.0 en [`contracts/api-contracts.yaml`](contracts/api-contracts.yaml).
* Guía de arranque en [`quickstart.md`](quickstart.md).

### Fase 2: Tareas de Construcción (Siguiente Paso)
* Generación de `tasks.md` ordenadas cronológicamente para:
  1. Script DDL de migraciones (`001_core_schema.sql`) y datos semilla iniciales (`seed.sql`).
  2. Implementación del backend API (rutas `/health`, `/auth/login`, `/sucursales`).
  3. Verificación E2E de salud y autenticación en contenedor Docker.

---

## Complexity Tracking

| Complejidad Identificada | Justificación Técnica | Mitigación |
| :--- | :--- | :--- |
| Concurrencia de múltiples sucursales sobre el mismo pool de BD | Evitar agotamiento de conexiones en PostgreSQL | Configuración de pooling con límite de conexiones (`max: 20`) y timeouts estrictos. |
| Aislamiento estricto de base de datos sin puerto público | Impide conectarse con clientes GUI externos directamente | Uso de Coolify Terminal o túnel temporal SSH cuando se requiera mantenimiento administrativo. |
