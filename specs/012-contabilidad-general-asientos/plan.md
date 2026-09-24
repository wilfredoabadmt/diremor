# Implementation Plan: 012-contabilidad-general-asientos

## 1. Arquitectura Técnica
El Módulo de **Contabilidad General Integrada** se construye sobre PostgreSQL 16 y Node.js/TypeScript en `src/routes/contabilidad.ts`. Implementa transacciones ACID en cada asiento con validación de balance $\sum Debe = \sum Haber$ en memoria antes de persistir, asegurando la imposibilidad matemática de comprobantes desbalanceados.

---

## 2. Fases de Implementación

### Fase 1: Esquema de Base de Datos y Seed Contable
1. Archivo DDL: `database/migrations/009_contabilidad_schema.sql`:
   - `plan_cuentas`: Catálogo con índices jerárquicos y unicidad de `codigo_cuenta`.
   - Seed de cuentas estándar bolivianas:
     - `1.1.1.01.001` - Caja Moneda Nacional (Activo / Imputable)
     - `1.1.1.02.001` - Banco Moneda Nacional (Activo / Imputable)
     - `1.1.2.01.001` - Cuentas por Cobrar Clientes (Activo / Imputable)
     - `1.1.3.01.001` - Crédito Fiscal IVA (Activo / Imputable)
     - `1.1.4.01.001` - Inventario de Mercaderías (Activo / Imputable)
     - `2.1.1.01.001` - Cuentas por Pagar Proveedores (Pasivo / Imputable)
     - `2.1.2.01.001` - Débito Fiscal IVA (Pasivo / Imputable)
     - `2.1.2.02.001` - Impuesto a las Transacciones por Pagar (Pasivo / Imputable)
     - `3.1.1.01.001` - Capital Social (Patrimonio / Imputable)
     - `4.1.1.01.001` - Ventas de Mercaderías (Ingreso / Imputable)
     - `5.1.1.01.001` - Costo de Mercaderías Vendidas (Costo / Imputable)
     - `6.1.1.01.001` - Impuesto a las Transacciones (Gasto / Imputable)
     - `6.1.2.01.001` - Gastos de Administración y Operación (Gasto / Imputable)
   - `asientos_cabecera`: Registro de comprobantes.
   - `asientos_detalle`: Partidas contables deudoras y acreedoras.

### Fase 2: Servicios REST y Controladores en Express (`src/routes/contabilidad.ts`)
- **Plan de Cuentas**:
  - `GET /api/contabilidad/cuentas`: Listado del plan de cuentas con filtros.
  - `POST /api/contabilidad/cuentas`: Crear nueva cuenta contable con validación de padre e imputabilidad.
- **Asientos Contables / Comprobantes**:
  - `POST /api/contabilidad/asientos`: Registrar asiento manual o automatizado.
    - Validación: Al menos 2 partidas, suma débitos = suma créditos, cuentas deben existir y ser imputables.
  - `GET /api/contabilidad/asientos`: Listado de asientos con rango de fechas y tipo.
  - `GET /api/contabilidad/asientos/:id`: Detalle del asiento y desglose de partidas.
  - `PUT /api/contabilidad/asientos/:id/anular`: Anulación de asiento con reversión lógica.
- **Reportes Financieros**:
  - `GET /api/contabilidad/libro-diario`: Comprobantes cronológicos completos.
  - `GET /api/contabilidad/libro-mayor`: Movimientos acumulados y saldos deudores/acreedores por cuenta.
  - `GET /api/contabilidad/balance-sumas-saldos`: Balance integral de 4 columnas (Sumas Debe, Sumas Haber, Saldo Deudor, Saldo Acreedor).
  - `GET /api/contabilidad/libros-fiscales/ventas-iva`: Consolidado fiscal según RND SIN.
  - `GET /api/contabilidad/libros-fiscales/compras-iva`: Consolidado de compras con crédito fiscal.

### Fase 3: Integración en Portal y Build
- Montar `contabilidadRouter` en `src/index.ts` bajo `/api/contabilidad`.
- Añadir la tarjeta `012-CONTABILIDAD` en `src/portal.ts`.
- Compilar con `npm run build`.

### Fase 4: Despliegue y Validación E2E en Vivo
- Git push a `main`.
- Despliegue en Coolify (`deploy` a `ygodaygbxqjqqlssdy8clib8`).
- Ejecutar `scratch/test_live_012.js` validando todos los flujos contables, sumas y saldos, y caminos infelices (asiento desbalanceado 400, cuenta no imputable 400).
- Ejecutar suite de no-regresión completa (003, 005, 006, 007, 008, 009, 010, 011).
