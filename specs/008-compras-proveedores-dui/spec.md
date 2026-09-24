# Specification: 008-compras-proveedores-dui

## Business Context & Vision
DIREMOR S.R.L. requiere un circuito completo de abastecimiento y compras tanto a nivel nacional como internacional (importaciones bajo pólizas aduaneras DUI). Este módulo garantiza el ingreso formal de mercaderías al inventario, el costeo promedio ponderado móvil en el Kardex físico-valorado, el prorrateo riguroso de fletes, seguros y Gravamen Arancelario (GA) para importaciones, y la generación de sugerencias de reprecio para proteger el margen bruto de comercialización.

---

## User Stories

### US1: Gestión del Padrón de Proveedores
**Como** Encargado de Adquisiciones o Administrador,  
**Quiero** registrar y consultar proveedores nacionales e internacionales con su identificación tributaria (NIT o Documento Extranjero), datos de contacto y condiciones comerciales (días de crédito),  
**Para** mantener un registro fidedigno de los socios de abastecimiento y gestionar compras y cuentas por pagar.

**Acceptance Criteria**:
1. `POST /api/proveedores` registra un nuevo proveedor con validación de campos obligatorios (`razon_social`, `nit_ci`, `tipo_proveedor`).
2. `GET /api/proveedores` lista y busca proveedores con filtros por razón social, NIT o país.
3. Se rechaza el registro con NIT duplicado si ya existe un proveedor activo.
4. El proveedor permite clasificar entre `NACIONAL` e `INTERNACIONAL`.

---

### US2: Registro de Compras Locales e Ingreso a Kardex
**Como** Encargado de Almacén o Administrador,  
**Quiero** registrar facturas o notas de compras locales con selección de almacén de destino, proveedor e ítems con su costo unitario de adquisición,  
**Para** incrementar automáticamente el stock en Kardex, actualizar el costo promedio ponderado de los productos y mantener el historial de compras.

**Acceptance Criteria**:
1. `POST /api/compras` registra cabecera y detalle de compra dentro de una transacción ACID.
2. Cada ítem de compra insertado activa el ingreso positivo al Kardex físico-valorado en el almacén especificado (`kardex_movimientos` con `tipo_movimiento = 'COMPRA'`).
3. El costo promedio ponderado del producto se recalcula automáticamente:
   $$\text{Costo Promedio} = \frac{\text{Saldo Valorado Previo} + (\text{Cantidad Entrada} \times \text{Costo Entrada})}{\text{Saldo Cantidad Previo} + \text{Cantidad Entrada}}$$
4. El campo `precio_costo` en la tabla `productos` se actualiza con el nuevo costo ponderado.
5. Se valida que la cantidad y el costo unitario de compra sean estrictamente mayores a cero.

---

### US3: Liquidación de Importaciones y Póliza DUI con Prorrateo de Costos
**Como** Responsable de Comercio Exterior o Finanzas,  
**Quiero** liquidar una compra de importación asociándola a una Póliza DUI, registrando el valor FOB, fletes internacionales, seguro, Gravamen Arancelario (GA) y gastos de nacionalización,  
**Para** prorratear automáticamente los costos aduaneros entre los productos importados e ingresar la mercadería al Kardex con el **Costo Unitario Real de Internación**.

**Acceptance Criteria**:
1. `POST /api/compras/importacion-dui` registra la compra con `tipo_compra = 'IMPORTACION_DUI'` y genera el registro en `importaciones_dui`.
2. Se calculan los totales de nacionalización:
   $$\text{Valor CIF USD} = \text{FOB} + \text{Flete} + \text{Seguro} + \text{Otros Gastos}$$
   $$\text{Valor CIF BOB} = \text{Valor CIF USD} \times \text{Tipo de Cambio Oficial (ej. 6.96)}$$
   $$\text{Total Gastos Nacionalización BOB} = \text{CIF BOB} + \text{Gravamen Arancelario} + \text{Agencia Aduanera} + \text{Transporte Local}$$
3. El sistema prorratea el sobrecosto de internación entre las líneas de detalle:
   $$\text{Factor Prorrateo}_i = \frac{\text{Subtotal Base}_i}{\sum \text{Subtotales Base}}$$
   $$\text{Costo Unitario Final}_i = \text{Costo Base}_i + \frac{\text{Total Gastos Gastos Adicionales} \times \text{Factor Prorrateo}_i}{\text{Cantidad}_i}$$
4. El Kardex registra el ingreso físico con el `costo_unitario_final` ya liquidado, garantizando que el inventario refleje el costo real desembolsado.

---

### US4: Alertas de Reprecio y Protección de Margen Comercial
**Como** Gerente Comercial o Administrador,  
**Quiero** recibir una alerta y recomendación de reprecio cuando el costo de adquisición de un producto supere el costo histórico registrado,  
**Para** sugerir nuevos precios de venta base que mantengan el margen bruto objetivo configurado.

**Acceptance Criteria**:
1. Si el nuevo costo de internación supera al costo previo, la respuesta del endpoint de compra incluye una sección `alertas_reprecio` con:
   - `codigo_producto`
   - `costo_anterior`
   - `costo_nuevo`
   - `incremento_porcentual`
   - `precio_venta_actual`
   - `precio_venta_sugerido` (calculado manteniendo el margen previo o un markup configurado del 30%).
2. `GET /api/compras/alertas-reprecio` permite consultar los productos cuyo costo ha sufrido variaciones recientes y requieren revisión de precios de mostrador.

---

## Constraints & System Invariants
1. **Principio I (Consistencia Transaccional ACID)**: La cabecera de compra, el detalle, la póliza DUI y los registros de Kardex deben ejecutarse en un único bloque de transacción de base de datos; ante cualquier fallo, se ejecuta `ROLLBACK`.
2. **Principio II (Cero Desincronización de Costos)**: El Kardex físico-valorado y la tabla de productos no deben divergir en su costo unitario ponderado.
3. **No-Regresión**: Los módulos 001 al 007 deben seguir respondiendo con código HTTP 200/201 en sus endpoints correspondientes.
