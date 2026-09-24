# Specification: 010-produccion-bom-costos

## Business Context & Vision
DIREMOR S.R.L. no solo comercializa productos terminados, sino que realiza ensamblaje, armado de paquetes industriales, kits mecánicos/hidráulicos y procesos de manufactura o transformación. Este módulo formaliza la gestión de recetas de fabricación (BOM - Bill of Materials), la emisión y seguimiento de órdenes de producción, la absorción rigurosa de costos en sus tres componentes canónicos (**Materia Prima - MP**, **Mano de Obra Directa - MOD** y **Costos Indirectos de Fabricación - CIF**), el descargo atómico de insumos desde el almacén de materia prima y el ingreso físico-valorado del Producto Terminado (PT) al almacén receptor.

---

## User Stories

### US1: Gestión de Recetas de Fabricación (BOM - Bill of Materials)
**Como** Jefe de Planta o Administrador,  
**Quiero** definir la lista de materiales e insumos necesarios para fabricar una unidad o lote de producto terminado,  
**Para** estandarizar los consumos teóricos, porcentajes de merma y asegurar consistencia técnica en la producción.

**Acceptance Criteria**:
1. `POST /api/produccion/recetas` permite crear una nueva fórmula con código de producto terminado (`codigo_producto_pt`), nombre de receta, rendimiento base e insumos requeridos con sus cantidades unitarias y porcentaje de merma tolerada.
2. `GET /api/produccion/recetas` lista las recetas activas con su desglose de insumos y costos estimados teóricos basados en el catálogo maestro.
3. Se rechaza la creación de recetas con productos terminados o insumos inexistentes en el catálogo.

---

### US2: Emisión y Apertura de Órdenes de Producción
**Como** Encargado de Producción o Administrador,  
**Quiero** emitir una Orden de Producción indicando la receta, la cantidad planificada a elaborar, el almacén de insumos y el almacén de destino del producto terminado,  
**Para** planificar el trabajo en planta y autorizar el consumo de insumos.

**Acceptance Criteria**:
1. `POST /api/produccion/ordenes` genera una orden en estado `PLANIFICADA` con número correlativo único.
2. `POST /api/produccion/ordenes/:id/iniciar` cambia el estado de la orden a `EN_PROCESO`, validando la disponibilidad de materia prima en el almacén de insumos.

---

### US3: Imputación de Costos Fabriles (MP, MOD, CIF)
**Como** Analista de Costos o Supervisor de Planta,  
**Quiero** imputar el consumo real de materias primas y cargar las horas hombre de mano de obra directa (MOD) y costos indirectos de fabricación (CIF),  
**Para** conformar la Hoja de Costos real acumulada de la orden.

**Acceptance Criteria**:
1. `POST /api/produccion/ordenes/:id/consumir-mp` registra el consumo real de insumos, realizando el descargo atómico en `kardex_movimientos` (`tipo_movimiento = 'PRODUCCION_SALIDA'`) al costo promedio ponderado vigente en el almacén de insumos.
2. `POST /api/produccion/ordenes/:id/imputar-costos` permite imputar costos de mano de obra directa (horas hombre $\times$ tarifa) y costos indirectos de fabricación (electricidad, depreciación, insumos menores).
3. Se totaliza en tiempo real:
   $$\text{Costo Total Fabricación} = \text{Costo MP} + \text{Costo MOD} + \text{Costo CIF}$$

---

### US4: Cierre de Orden e Ingreso Valorado de Producto Terminado a Kardex
**Como** Jefe de Planta o Encargado de Almacén,  
**Quiero** finalizar la orden de producción registrando la cantidad real obtenida de producto terminado,  
**Para** calcular el Costo Unitario de Producción real e ingresar automáticamente el stock valorado al Kardex del almacén receptor.

**Acceptance Criteria**:
1. `POST /api/produccion/ordenes/:id/finalizar` liquida la orden:
   $$\text{Costo Unitario PT} = \frac{\text{Costo Total Fabricación}}{\text{Cantidad Real Producida}}$$
2. Ingresa atómicamente el producto terminado en `kardex_movimientos` (`tipo_movimiento = 'PRODUCCION_ENTRADA'`) con la cantidad real producida y el costo unitario liquidado en el almacén de producto terminado.
3. Actualiza el costo ponderado en `productos.precio_costo` para el producto terminado.
4. Cambia el estado de la orden a `FINALIZADA` registrando la fecha de conclusión.
5. Si la orden ya está finalizada o cancelada, se bloquea con HTTP 409 Conflict.

---

## Constraints & System Invariants
1. **Principio I (Consistencia Transaccional ACID)**: El descargo de insumos y el ingreso de producto terminado deben ejecutarse mediante transacciones ACID seguras con bloqueos `FOR UPDATE`.
2. **Principio II (Conservación del Valor)**: Todo costo descargado en insumos más los costos agregados de mano de obra y CIF deben transferirse íntegramente a la valoración del producto terminado obtenido.
3. **No-Regresión**: Los módulos 001 al 009 deben continuar operando al 100% de efectividad.
