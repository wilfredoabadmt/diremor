# Quickstart: 001-setup-db-core

**Feature**: `001-setup-db-core`  
**Date**: 2026-09-23  

---

## 1. Variables de Entorno Requeridas (.env)

Configurar en el panel de **Coolify** o en `.env` local para desarrollo:

```bash
# Entorno
NODE_ENV=production
PORT=3000

# Base de Datos PostgreSQL 16+ en Red Privada Docker
POSTGRES_DB=sac_diremor
POSTGRES_USER=sac_admin
POSTGRES_PASSWORD=CAMBIAR_POR_PASSWORD_SEGURO_2026
DATABASE_URL=postgresql://sac_admin:CAMBIAR_POR_PASSWORD_SEGURO_2026@sac-database:5432/sac_diremor

# Seguridad JWT
JWT_SECRET=GENERAR_CADENA_ALEATORIA_64_BYTES_PARA_JWT
JWT_EXPIRES_IN=8h

# Dominio Público en Coolify
APP_DOMAIN=sac.diremor.com
```

---

## 2. Ejecución Local con Docker Compose

Para reproducir localmente la topología de Coolify:

```bash
# 1. Levantar PostgreSQL y servicios en red local
docker compose up -d

# 2. Verificar que PostgreSQL esté saludable
docker compose ps

# 3. Probar el endpoint de salud
curl -i http://localhost:3000/api/health
```

---

## 3. Despliegue en Coolify PaaS

1. **Crear Servicio de Base de Datos:**
   * En Coolify, agregar nueva base de datos **PostgreSQL 16**.
   * Conectar a la red `coolify-network`.
2. **Crear Aplicación API Backend:**
   * Conectar repositorio GitHub (`diremor`).
   * Configurar variables de entorno (`DATABASE_URL`, `JWT_SECRET`).
   * Definir **Pre-Deployment Command**: `npm run db:migrate` (o script equivalente).
   * Definir **Healthcheck URL**: `/api/health`.
3. **Despliegue Automático:**
   * Cada commit en `main` dispara el pipeline de build, migraciones de esquema y conmutación sin tiempo de inactividad (zero-downtime).
