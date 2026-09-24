# Technical Plan: 008-compras-proveedores-dui

## Architecture & Design Decisions

### 1. Modelo de Datos DDL (PostgreSQL 16+)
- **Migración**: `database/migrations/005_compras_dui_schema.sql`
- **Tablas**:
  - `proveedores`: Padrón con NIT/CI, razón social, país, contacto, tipo (`NACIONAL`/`INTERNACIONAL`), días de crédito.
  - `compras_cabecera`: Registro de compras con sucursal, almacén destino, proveedor, tipo de compra (`LOCAL`/`IMPORTACION_DUI`), condición de pago (`CONTADO`/`CREDITO`), totales brutos/descuentos/netos, estado (`RECEPCIONADA`/`ANULADA`).
  - `compras_detalle`: Líneas de compra con `costo_unitario_compra`, `costo_adicional_prorrateado`, `costo_unitario_final`, cantidad, subtotal y trazabilidad opcional de lote/serie.
  - `importaciones_dui`: Vínculo 1:1 con `compras_cabecera`, almacena `numero_poliza_dui`, fecha aceptación, país origen, FOB, Flete, Seguro, CIF USD/BOB, Gravamen Arancelario GA, Agencia Aduanera, Transporte local y método de prorrateo.
- **Trigger Transaccional**:
  - `trg_ingresar_kardex_compra` sobre `compras_detalle` ejecutado `AFTER INSERT`.
  - Bloquea con `FOR UPDATE` el último registro en `kardex_movimientos` para `(codigo_producto, id_almacen)`.
  - Calcula el nuevo saldo físico y el nuevo saldo valorado con el costo unitario final.
  - Recalcula el costo promedio ponderado ($C_{\text{prom}}$).
  - Actualiza `productos.precio_costo = C_{\text{prom}}`.
  - Inserta el movimiento `'COMPRA'` en `kardex_movimientos`.

---

### 2. Algoritmo de Prorrateo de Importaciones (DUI)
Para una póliza DUI con $N$ ítems:
1. Se calcula el gasto adicional total en moneda local (BOB):
   $$\text{Gastos Adicionales BOB} = (\text{Flete USD} + \text{Seguro USD} + \text{Otros USD}) \times \text{TC} + \text{GA BOB} + \text{Agencia BOB} + \text{Transporte BOB}$$
2. Para cada ítem $i$:
   $$\text{Base BOB}_i = \text{Cantidad}_i \times \text{Costo Unitario Base BOB}_i$$
   $$\text{Base Total BOB} = \sum_{k=1}^N \text{Base BOB}_k$$
   $$\text{Factor}_i = \frac{\text{Base BOB}_i}{\text{Base Total BOB}}$$
   $$\text{Gasto Asignado}_i = \text{Gastos Adicionales BOB} \times \text{Factor}_i$$
   $$\text{Costo Adicional Unitario}_i = \frac{\text{Gasto Asignado}_i}{\text{Cantidad}_i}$$
   $$\text{Costo Unitario Final}_i = \text{Costo Unitario Base BOB}_i + \text{Costo Adicional Unitario}_i$$

---

### 3. Algoritmo de Alerta de Reprecio
Tras procesar la compra:
1. Compara el `costo_unitario_final` con el `precio_costo` previo del producto.
2. Si $\text{Costo Final} > \text{Costo Previo} \times 1.01$ (incremento $> 1\%$):
   - Calcula el margen actual:
     $$\text{Margen Previo} = \frac{\text{Precio Venta Base} - \text{Costo Previo}}{\text{Precio Venta Base}}$$
   - Si no hay margen previo o es menor al 20%, se aplica un margen objetivo estándar del 30%:
     $$\text{Precio Venta Sugerido} = \frac{\text{Costo Final}}{1 - 0.30}$$
   - Se incluye en el payload de respuesta de la compra para notificación inmediata al usuario.

---

### 4. Endpoints de la API
- **Proveedores**:
  - `POST /api/proveedores` (Crear proveedor)
  - `GET /api/proveedores` (Listar / Buscar proveedores)
  - `GET /api/proveedores/:id` (Consultar detalle)
- **Compras**:
  - `POST /api/compras` (Registrar compra local e ingreso directo a Kardex)
  - `POST /api/compras/importacion-dui` (Registrar importación con póliza DUI y prorrateo automático)
  - `GET /api/compras` (Listado con filtros por fecha, proveedor y tipo)
  - `GET /api/compras/:id` (Detalle con desglose de ítems, DUI y liquidación)
  - `GET /api/compras/alertas-reprecio` (Productos con incremento de costo para revisión)

---

### 5. Plan de Pruebas E2E en Vivo (`scratch/test_live_008.js`)
1. **Padrón de Proveedores**: Crear proveedor nacional y proveedor extranjero.
2. **Compra Local**: Adquirir ítems para Almacén Central, verificar aumento de stock y actualización de costo promedio en Kardex.
3. **Liquidación DUI**: Registrar póliza de importación con FOB, flete, seguro y aranceles; verificar que el prorrateo eleve el costo unitario final e ingrese al Kardex con el costo real de internación.
4. **Alerta de Reprecio**: Verificar que una compra a costo superior genere alerta con precio de venta sugerido.
5. **Caminos Infelices**:
   - Compra con proveedor inexistente (404/400).
   - Cantidades o costos negativos/cero (400).
   - DUI con número de póliza duplicado (409).
