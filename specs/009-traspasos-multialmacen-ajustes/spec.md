# Specification: 009-traspasos-multialmacen-ajustes

## Business Context & Vision
DIREMOR S.R.L. opera bajo un esquema multi-sucursal y multi-almacén (almacenes centrales, almacenes de mostrador en agencias, depósitos secundarios y talleres). Este módulo gobierna los movimientos de mercadería entre bodegas con control de estado en tránsito y confirmación de recepción en destino, así como los ajustes formales de inventario físico (tomas de inventario periódicas, mermas por rotura o deterioro, faltantes y sobrantes), asegurando la integridad del Kardex físico-valorado y la trazabilidad de números de serie y lotes.

---

## User Stories

### US1: Solicitud y Despacho de Traspasos Entre Almacenes
**Como** Encargado de Bodega Central o Administrador,  
**Quiero** registrar el despacho de productos desde un almacén de origen hacia un almacén de destino,  
**Para** reservar y descontar inmediatamente la mercadería de la bodega de origen y mantenerla en estado `EN_TRANSITO`.

**Acceptance Criteria**:
1. `POST /api/traspasos` registra la cabecera y el detalle del traspaso dentro de una transacción ACID.
2. Se valida que el almacén de origen y el almacén de destino sean diferentes (`id_almacen_origen <> id_almacen_destino`).
3. Se verifica que haya existencias suficientes en el almacén de origen para cada producto. Si el stock es insuficiente, se rechaza con HTTP 400.
4. Se descuenta atómicamente el stock del almacén de origen mediante un movimiento en `kardex_movimientos` (`tipo_movimiento = 'TRASPASO_SALIDA'`).
5. El estado inicial del traspaso queda registrado como `EN_TRANSITO`.

---

### US2: Confirmación de Recepción Física en Destino
**Como** Encargado del Almacén de Destino o Administrador,  
**Quiero** confirmar la llegada de mercaderías transferidas tras inspección física,  
**Para** ingresar formalmente los productos al stock del almacén receptor y cerrar el circuito de tránsito.

**Acceptance Criteria**:
1. `POST /api/traspasos/:id/recibir` procesa la recepción física de un traspaso en estado `EN_TRANSITO`.
2. Se incrementa atómicamente el stock del almacén de destino mediante un movimiento en `kardex_movimientos` (`tipo_movimiento = 'TRASPASO_ENTRADA'`).
3. El estado del traspaso cambia a `RECIBIDO` registrando la fecha de recepción y el usuario receptor.
4. Si el traspaso ya fue recibido o rechazado previamente, se bloquea la operación con HTTP 409 Conflict.

---

### US3: Rechazo o Devolución de Traspaso
**Como** Encargado de Almacén de Destino o Supervisor,  
**Quiero** rechazar un traspaso en tránsito ante discrepancias físicas o errores de envío,  
**Para** devolver la mercadería al almacén de origen de forma controlada y revertir los movimientos en Kardex.

**Acceptance Criteria**:
1. `POST /api/traspasos/:id/rechazar` permite rechazar un traspaso con motivo justificado.
2. Se reingresa atómicamente el inventario al almacén de origen (`tipo_movimiento = 'TRASPASO_REVERSION'`).
3. El estado del traspaso cambia a `RECHAZADO`.

---

### US4: Ajustes de Inventario Físico (Mermas, Roturas, Sobrantes, Faltantes)
**Como** Auditor de Inventarios o Administrador,  
**Quiero** registrar ajustes de inventario físico justificados,  
**Para** corregir discrepancias entre el conteo físico real y los saldos teóricos del sistema.

**Acceptance Criteria**:
1. `POST /api/ajustes` registra un ajuste de inventario con tipo (`SOBRANTE`, `FALTANTE`, `MERMA`, `ROTURA`, `INVENTARIO_FISICO`), motivo obligatorio y lista de productos con cantidad y sentido (`ENTRADA` o `SALIDA`).
2. Para ajustes de tipo `SALIDA` (mermas, faltantes), se verifica disponibilidad de stock; si el saldo es insuficiente, se rechaza la operación para preservar el Principio de No Stock Negativo.
3. Se asienta el movimiento en `kardex_movimientos` (`tipo_movimiento = 'AJUSTE_ENTRADA'` o `'AJUSTE_SALIDA'`) con afectación directa al saldo valorado.
4. `GET /api/ajustes` y `GET /api/ajustes/:id` permiten consultar el historial y detalle de ajustes para auditoría.

---

## Constraints & System Invariants
1. **Principio I (Consistencia Transaccional ACID)**: Todos los movimientos de salida y entrada en Kardex deben ejecutarse dentro de transacciones de base de datos protegidas por bloqueos `FOR UPDATE`.
2. **Principio II (Cero Stock Negativo)**: Ningún traspaso ni ajuste de salida puede provocar saldo físico negativo en ningún almacén.
3. **Principio III (Trazabilidad Inalterable)**: Los números de serie y lotes trasladados deben asociarse a los movimientos de Kardex.
