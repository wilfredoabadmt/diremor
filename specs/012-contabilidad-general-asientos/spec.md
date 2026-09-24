# Feature Specification: 012-contabilidad-general-asientos

## 1. Visión General y Contexto
El Módulo de **Contabilidad General Integrada** de DIREMOR SAC proporciona la base financiera, tributaria y analítica de la empresa conforme a la normativa contable y tributaria del Estado Plurinacional de Bolivia. Permite la administración estructurada del Plan de Cuentas, el registro y balanceo estricto de asientos contables (Comprobantes de Ingreso, Egreso y Traspaso), la generación en tiempo real de Libros Mayores, Libro Diario, Balance de Sumas y Saldos, y la consolidación de los Libros Fiscales de Compras y Ventas IVA según estándares del Servicio de Impuestos Nacionales (SIN).

---

## 2. Requerimientos de Usuario (User Stories)

### US1: Administración del Plan de Cuentas Jerárquico
**Como** Contador General o Administrador de DIREMOR S.R.L.  
**Quiero** gestionar el catálogo de cuentas contables con jerarquía multinivel, clasificación por rubro (Activo, Pasivo, Patrimonio, Ingresos, Costos, Gastos) e indicador de imputabilidad  
**Para** estructurar los estados financieros de la empresa y asegurar que los asientos solo afecten cuentas operativas de último nivel.

- **Criterio de Aceptación 1.1:** Cada cuenta contable debe tener un código único formateado (ej. `1.1.1.01.001`), descripción, tipo de cuenta, nivel jerárquico y bandera booleana `es_imputable`.
- **Criterio de Aceptación 1.2:** Solo las cuentas marcadas como `es_imputable = true` pueden recibir cargos (Debe) o abonos (Haber) en los comprobantes.
- **Criterio de Aceptación 1.3:** Debe proveerse un seed inicial con el plan de cuentas comercial e industrial estándar de Bolivia.

### US2: Registro y Balanceo Estricto de Asientos Contables (Partida Doble)
**Como** Responsable de Contabilidad  
**Quiero** registrar comprobantes contables clasificados en Ingreso, Egreso o Traspaso con desglose de débitos y créditos  
**Para** garantizar la integridad transaccional bajo el principio universal de la partida doble ($\sum Debe = \sum Haber$).

- **Criterio de Aceptación 2.1:** Un comprobante no puede ser asentado si la sumatoria de débitos no coincide con la sumatoria de créditos al centavo ($\Delta \ne 0.00$ genera error HTTP 400).
- **Criterio de Aceptación 2.2:** La cabecera del comprobante registra tipo (`INGRESO`, `EGRESO`, `TRASPASO`), número correlativo, fecha de emisión, glosa general, sucursal y usuario emisor.
- **Criterio de Aceptación 2.3:** Cada línea del asiento debe indicar `id_cuenta`, glosa particular, `debe` y `haber`.

### US3: Consulta de Libro Diario y Libro Mayor
**Como** Auditor Contable o Contador  
**Quiero** emitir el Libro Diario cronológico y el Libro Mayor por cuenta contable para cualquier rango de fechas  
**Para** fiscalizar los movimientos financieros y conocer el saldo deudor o acreedor actualizado.

- **Criterio de Aceptación 3.1:** El endpoint de Libro Diario debe listar los comprobantes con todas sus líneas ordenadas correlativamente.
- **Criterio de Aceptación 3.2:** El Libro Mayor debe reflejar movimientos históricos, saldo anterior y saldo acumulado dinámico según la naturaleza de la cuenta (Deudora para Activos/Gastos/Costos; Acreedora para Pasivos/Patrimonio/Ingresos).

### US4: Balance de Comprobación de Sumas y Saldos
**Como** Gerencia General y Finanzas  
**Quiero** generar el Balance de Comprobación a cualquier fecha de corte  
**Para** verificar que la contabilidad esté cuadrada en su totalidad (Sumas Debe = Sumas Haber y Saldos Deudores = Saldos Acreedores).

- **Criterio de Aceptación 4.1:** Debe listar cada cuenta imputable con Total Debe, Total Haber, Saldo Deudor y Saldo Acreedor.
- **Criterio de Aceptación 4.2:** El reporte debe totalizar ambas columnas y certificar el cuadre contable.

### US5: Reportes de Libros Fiscales IVA (Compras y Ventas para el SIN)
**Como** Encargado Tributario  
**Quiero** obtener los reportes consolidados de Compras IVA y Ventas IVA en los formatos exigidos por la RND 102100000011  
**Para** cumplir oportunamente con las declaraciones juradas del Formulario 200 (IVA) y Formulario 400 (IT).

- **Criterio de Aceptación 5.1:** El reporte de Ventas IVA debe consolidar facturas emitidas, CUF, NIT cliente, importe total, crédito/débito fiscal (13%) e IT (3%).
- **Criterio de Aceptación 5.2:** El reporte de Compras IVA debe consolidar facturas de compras locales y pólizas DUI con desglose de crédito fiscal computable.

---

## 3. Modelo de Datos Contable

### Entidades Principales:
1. `plan_cuentas`:
   - `id_cuenta` (PK, INT / BIGINT)
   - `codigo_cuenta` (VARCHAR 30, UNIQUE, ej. '1.1.1.01.001')
   - `nombre_cuenta` (VARCHAR 150)
   - `tipo_cuenta` (VARCHAR 20, 'ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'COSTO', 'GASTO')
   - `nivel` (INT)
   - `es_imputable` (BOOLEAN DEFAULT TRUE)
   - `id_cuenta_padre` (FK self-referential)
   - `activo` (BOOLEAN DEFAULT TRUE)

2. `asientos_cabecera` (Comprobantes):
   - `id_asiento` (PK, BIGINT)
   - `numero_asiento` (VARCHAR 50, UNIQUE)
   - `tipo_asiento` (VARCHAR 20: 'INGRESO', 'EGRESO', 'TRASPASO')
   - `id_sucursal` (FK sucursales)
   - `fecha_asiento` (DATE / TIMESTAMPTZ)
   - `glosa_general` (TEXT)
   - `total_debe` (NUMERIC 14,2)
   - `total_haber` (NUMERIC 14,2)
   - `estado` (VARCHAR 20: 'ASENTADO', 'ANULADO')
   - `modulo_origen` (VARCHAR 30: 'VENTAS', 'COMPRAS', 'TESORERIA', 'MANUAL')
   - `id_documento_origen` (BIGINT)
   - `id_usuario` (FK usuarios)

3. `asientos_detalle`:
   - `id_detalle` (PK, BIGINT)
   - `id_asiento` (FK asientos_cabecera)
   - `id_cuenta` (FK plan_cuentas)
   - `glosa_detalle` (TEXT)
   - `debe` (NUMERIC 14,2 DEFAULT 0.00)
   - `haber` (NUMERIC 14,2 DEFAULT 0.00)
