# Research & Technical Decisions: 001-setup-db-core

**Feature**: `001-setup-db-core`  
**Date**: 2026-09-23  
**Status**: Completed  

---

## 1. Contexto y Objetivos de Investigación

Para materializar el sistema SAC de DIREMOR S.R.L. en Coolify PaaS bajo los principios constitucionales (ACID, soberanía self-hosted, seguridad de red y RND 102100000011), se investigaron las mejores opciones tecnológicas y de arquitectura para la persistencia, migración y comunicación inter-servicios.

---

## 2. Decisiones Técnicas Fundamentales

### D-01: Motor de Base de Datos y Aislamiento en Red
* **Decisión:** Emplear **PostgreSQL 16+ (Alpine)** como contenedor nativo dentro de la red Docker privada de Coolify (`coolify-network`).
* **Alternativas evaluadas:**
  * *Oracle XE:* Descartado por limitaciones artificiales (2 GB RAM, 12 GB disco, restricciones de CPU) y dificultad de licenciamiento/mantenimiento en contenedores Linux modernos.
  * *MySQL / MariaDB:* Descartado; PostgreSQL ofrece un soporte superior para transacciones complejas, extensiones (`pgcrypto`, `uuid-ossp`), tipos `JSONB` indexables por GIN (esenciales para auditoría fiscal del SIN) y control de concurrencia MVCC.
* **Justificación de Seguridad:** El puerto TCP 5432 **NO** se vincula al host (`ports:` omitido), solo se expone dentro de la red interna de Docker.

### D-02: Estrategia de Migraciones DDL y Control de Esquema
* **Decisión:** Utilizar un sistema de migraciones SQL versionadas secuenciales (scripts DDL con verificación de idempotencia `CREATE TABLE IF NOT EXISTS`, ejecutados en el **Pre-Deployment Command** de Coolify).
* **Beneficio:** Garantiza que antes de que el nuevo contenedor de la API backend atienda tráfico, el esquema de la base de datos se encuentre actualizado y alineado con los modelos de datos.

### D-03: Mecanismo de Autenticación y Autorización (RBAC)
* **Decisión:** Autenticación sin estado basada en **JSON Web Tokens (JWT)** con algoritmo HMAC-SHA256, con tiempo de expiración corto (8 horas) para puestos de venta y refresh token seguro.
* **Claims del Token:**
  * `sub`: ID del usuario (`id_usuario`).
  * `rol`: Rol corporativo (`ADMIN`, `VENTAS_POS`, `ALMACEN`, `CONTABILIDAD`, `GERENCIA`).
  * `sucursal_id`: ID de la sucursal activa asignada.
  * `sucursal_nombre`: Denominación de la sede para visualización inmediata en frontend.
* **Hash de Contraseñas:** Algoritmo Argon2id o bcrypt con coste 12, impidiendo ataques de fuerza bruta en caso de filtración de backups.

### D-04: Healthcheck y Supervisión desde Traefik / Coolify
* **Decisión:** Implementar el endpoint `GET /api/health` que ejecuta una verificación real en dos niveles:
  1. **Liveness:** El proceso HTTP responde.
  2. **Readiness:** El pool de conexiones a PostgreSQL ejecuta con éxito `SELECT 1;`.
* **Respuesta:**
  * HTTP 200 OK con payload de latencia si la base de datos responde.
  * HTTP 503 Service Unavailable si la base de datos no está accesible, permitiendo a Coolify orquestar alertas o reinicios.

---

## 3. Conclusiones y Próximos Pasos
Las decisiones anteriores aseguran una base sólida, ligera y 100% conforme a los 9 principios de la Constitución de DIREMOR SAC.
