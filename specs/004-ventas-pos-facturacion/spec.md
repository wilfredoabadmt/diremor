# Feature Spec: 004-ventas-pos-facturacion

## Contexto y Justificación del Negocio
En DIREMOR S.R.L., el proceso de venta es el motor central del negocio que articula el flujo de caja, el control de inventario y la relación con los clientes. Para garantizar la integridad operativa y fiscal (normativa boliviana e interna):
1. Toda venta debe ejecutarse bajo una **transacción atómica ACID**: la cabecera de venta, el detalle de productos y el descargo físico de inventario en el Kardex (`tipo_movimiento = 'VENTA'`) deben grabarse conjuntamente o abortarse por completo si falla alguna validación.
2. Si la venta es a **crédito** (`tipo_pago = 'CREDITO'`), el sistema debe impedir la venta si el cliente se encuentra con **bloqueo por mora** (`bloqueo_mora = true`) o si el importe neto excede su **límite de crédito disponible**.
3. Si un producto exige trazabilidad de serie (`maneja_serie = true`), el vendedor debe registrar obligatoriamente el número de serie de la unidad despachada.
4. Las ventas deben permitir consulta detallada y opción de anulación por parte de perfiles autorizados (`ADMIN`, `VENTAS`), revirtiendo automáticamente las unidades al almacén vía Kardex (`tipo_movimiento = 'AJUSTE_ENTRADA'` o anulación con trazabilidad).

---

## User Stories y Criterios de Aceptación

### US1: Emisión de Venta en Mostrador / POS (Contado y QR)
**Como** Vendedor o Cajero de una sucursal  
**Quiero** registrar una venta especificando el cliente (o cliente genérico de mostrador), almacén de despacho y la lista de productos con sus cantidades y precios  
**Para** concretar la operación comercial de forma ágil y emitir el comprobante de venta.

#### Criterios de Aceptación:
- **AC1.1**: Permite registrar ventas asociadas al cliente genérico (`id_cliente = 1`) o a cualquier cliente activo registrado.
- **AC1.2**: Calcula automáticamente `total_bruto`, `descuento` y `total_neto = total_bruto - descuento`.
- **AC1.3**: Asocia automáticamente la venta a la sucursal del usuario autenticado (`req.user.id_sucursal`) y al identificador del vendedor (`req.user.id_usuario`).
- **AC1.4**: Admite modalidades de pago `CONTADO` y `QR` sin requerir evaluación crediticia previa.

---

### US2: Emisión de Venta a Crédito con Validación Antifraude y Control de Mora
**Como** Encargado de Créditos y Cobranzas / Vendedor  
**Quiero** que el sistema verifique el estado del cliente antes de autorizar una venta a crédito  
**Para** proteger a la empresa de sobregiros crediticios o ventas a clientes con cuentas vencidas.

#### Criterios de Aceptación:
- **AC2.1**: Si `tipo_pago = 'CREDITO'` y el cliente tiene `bloqueo_mora = true`, la API debe rechazar la transacción con código `400` y mensaje explicativo claro.
- **AC2.2**: Si `tipo_pago = 'CREDITO'` y el `total_neto` excede el `limite_credito` disponible del cliente, la API debe rechazar la transacción con código `400` indicando el límite y el monto solicitado.
- **AC2.3**: Si el cliente está apto, la venta se registra con estado `EMITIDA`.

---

### US3: Descargo Atómico de Inventarios y Trazabilidad en Kardex
**Como** Jefe de Almacenes  
**Quiero** que cada venta reste de forma automática e inmediata el stock del almacén de despacho en el Kardex Físico-Valorado  
**Para** mantener el balance de existencias actualizado en tiempo real sin descuadres.

#### Criterios de Aceptación:
- **AC3.1**: Por cada ítem vendido, se genera una línea en `kardex_movimientos` con `tipo_movimiento = 'VENTA'`, `cantidad_salida = cantidad`, `costo_unitario = precio_costo_actual` del producto, recalculando el nuevo `saldo_cantidad` y `saldo_valorado`.
- **AC3.2**: Si algún ítem no cuenta con stock suficiente en el almacén especificado, la transacción completa es revertida (`ROLLBACK`) con código `400` sin guardar la venta ni afectar el Kardex.
- **AC3.3**: Si un producto tiene `maneja_serie = true`, el campo `numero_serie` es obligatorio en el detalle y se propaga al registro de Kardex.

---

### US4: Consulta de Ventas y Trazabilidad de Comprobante
**Como** Vendedor, Auditor o Administrador  
**Quiero** listar y consultar las ventas realizadas con filtros por fecha, cliente y sucursal, así como obtener el detalle completo de una venta  
**Para** auditar las operaciones del día y emitir reimpresiones o reportes.

#### Criterios de Aceptación:
- **AC4.1**: `GET /api/ventas` permite filtrar por `fecha_desde`, `fecha_hasta`, `id_cliente`, `tipo_pago` y `estado`.
- **AC4.2**: `GET /api/ventas/:id` retorna la cabecera completa con datos del cliente, usuario, sucursal y la lista de productos de `ventas_detalle`.

---

### US5: Anulación Controlada de Venta
**Como** Administrador o Supervisor de Sucursal  
**Quiero** anular una venta emitida erróneamente  
**Para** corregir el registro contable y reponer automáticamente el stock físico en el almacén correspondiente.

#### Criterios de Aceptación:
- **AC5.1**: `POST /api/ventas/:id/anular` actualiza el estado a `ANULADA`.
- **AC5.2**: Genera movimientos de reingreso en Kardex (`tipo_movimiento = 'AJUSTE_ENTRADA'` o anulación referenciada) restituyendo las unidades al almacén de origen.
- **AC5.3**: No permite re-anular una venta previamente anulada.
