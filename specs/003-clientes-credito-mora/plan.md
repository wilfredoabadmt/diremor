# Technical Plan: 003-clientes-credito-mora

**Feature**: Maestro de Clientes, Límites de Crédito y Control de Bloqueo por Mora  
**Branch**: `main`  
**Deploy Platform**: Coolify PaaS (PostgreSQL 16 en red interna Docker)

---

## 1. Arquitectura Técnica

### Controlador y Rutas (`src/routes/clientes.ts`):
- `GET /api/clientes/generico`: Retorna o crea el cliente comodín (`nit_ci: '0'`, `razon_social: 'CONTROL DE MOSTRADOR / SIN NOMBRE'`).
- `GET /api/clientes`: Búsqueda por término (`q`), filtro por mora (`bloqueo_mora`), estado (`estado`), paginación (`limit`, `offset`).
- `POST /api/clientes`: Registro con validación de tipo de documento y verificación de NIT único.
- `GET /api/clientes/:id`: Detalle del cliente.
- `PUT /api/clientes/:id`: Actualización de datos generales.
- `PATCH /api/clientes/:id/credito`: Modificación de `limite_credito` y `bloqueo_mora` (Roles: `ADMIN`, `CONTABILIDAD`).
- `GET /api/clientes/:id/evaluacion-credito`: Evaluación crediticia en tiempo real recibiendo `monto_solicitado` para calcular si procede una venta a crédito.

---

## 2. Constitution Check

- **Principio I (ACID y Consistencia Financiera)**: ✅ El cálculo de crédito disponible compara el límite autorizado frente a cuentas por cobrar pendientes. Si el cliente está en mora, la venta a crédito se rechaza inmediatamente.
- **Principio II (Soberanía y Seguridad)**: ✅ Endpoints protegidos con JWT. Modificación de límites crediticios y mora restringida a perfiles autorizados (`ADMIN`, `CONTABILIDAD`).
- **Definición de Hecho REFORZADA**: ✅ Verificación E2E en el entorno real de Coolify.
