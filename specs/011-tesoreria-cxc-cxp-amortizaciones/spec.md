# Specification: 011-tesoreria-cxc-cxp-amortizaciones

## Business Context & Vision
DIREMOR S.R.L. ofrece facilidades de crédito a clientes corporativos calificados y gestiona plazos de pago comercial con proveedores nacionales e importadores. Este módulo financiero consolida el control de **Cuentas por Cobrar (CxC)** y **Cuentas por Pagar (CxP)**, asegurando la trazabilidad de amortizaciones mediante recibos oficiales y comprobantes de egreso, la actualización dinámica de saldos insolutos, la rehabilitación de clientes morosos tras liquidar sus pasivos y el reporte gerencial de **Antigüedad de Saldos** segmentado por plazos de vencimiento (corriente, 30, 60, 90+ días).

---

## User Stories

### US1: Gestión de Cuentas por Cobrar (CxC) y Emisión de Créditos
**Como** Encargado de Créditos y Cobranzas o Administrador,  
**Quiero** registrar y consultar las cuentas por cobrar generadas por ventas a plazo,  
**Para** realizar el seguimiento de las fechas de vencimiento, montos amortizados y saldo deudor por cliente.

**Acceptance Criteria**:
1. `POST /api/tesoreria/cxc` permite registrar o asociar una cuenta por cobrar vinculada a una venta (`id_venta`) y cliente (`id_cliente`) con fecha de vencimiento y monto total.
2. `GET /api/tesoreria/cxc` lista las cuentas por cobrar con filtros por estado (`PENDIENTE`, `PAGADO`, `VENCIDO`), cliente y sucursal.
3. Se calcula automáticamente el saldo insoluto:
   $$\text{Monto Saldo} = \text{Monto Total} - \text{Monto Amortizado}$$
4. Si la fecha actual supera a la fecha de vencimiento y el saldo es mayor a cero, la cuenta se clasifica como `VENCIDA`.

---

### US2: Cobros y Amortizaciones con Recibo Oficial de Cobranza
**Como** Cajero o Encargado de Cobranzas,  
**Quiero** registrar pagos parciales o totales de clientes contra una cuenta por cobrar emitiendo un recibo oficial numerado,  
**Para** disminuir el saldo adeudado y actualizar el estado financiero del cliente.

**Acceptance Criteria**:
1. `POST /api/tesoreria/cxc/cobros` registra el pago con número de recibo correlativo único, forma de pago (`EFECTIVO`, `TRANSFERENCIA`, `CHEQUE`, `QR`), referencia bancaria y monto cobrado.
2. Se valida que el monto cobrado no supere el saldo pendiente de la cuenta; ante un exceso, se rechaza la transacción con HTTP 400.
3. La cuenta pasa a estado `PAGADO` de forma automática si el saldo restante llega a 0.00.
4. Si el cliente tenía bloqueo por mora y liquida la totalidad de sus deudas vencidas, el sistema desactiva preventivamente el flag de mora (`bloqueo_mora = FALSE`).

---

### US3: Gestión de Cuentas por Pagar (CxP) a Proveedores
**Como** Encargado de Tesorería o Administrador,  
**Quiero** controlar las obligaciones pendientes de pago con proveedores por compras locales o importaciones a crédito,  
**Para** programar el flujo de caja, evitar recargos y gestionar los desembolsos.

**Acceptance Criteria**:
1. `POST /api/tesoreria/cxp` registra la cuenta por pagar vinculada a una compra (`id_compra`) y proveedor (`id_proveedor`) con monto y fecha de vencimiento.
2. `GET /api/tesoreria/cxp` lista las obligaciones comerciales pendientes y canceladas.

---

### US4: Pagos a Proveedores con Comprobante de Egreso
**Como** Tesorero o Administrador,  
**Quiero** asentar pagos y amortizaciones a proveedores,  
**Para** amortizar las facturas de compra y emitir el comprobante de pago comercial.

**Acceptance Criteria**:
1. `POST /api/tesoreria/cxp/pagos` registra el egreso asociando número de comprobante, forma de pago, fecha y monto.
2. Descuenta el saldo deudor de la cuenta por pagar y actualiza su estado a `PAGADO` al liquidarse en su totalidad.
3. Rechaza pagos que excedan el saldo exigible.

---

### US5: Reporte de Antigüedad de Saldos y Estados de Cuenta
**Como** Gerente Financiero o Supervisor,  
**Quiero** visualizar el reporte consolidado de antigüedad de saldos de cartera (CxC) y proveedores (CxP),  
**Para** analizar el riesgo de mora, provisionar incobrables y tomar decisiones de concesión de nuevos créditos.

**Acceptance Criteria**:
1. `GET /api/tesoreria/cxc/antiguedad-saldos` clasifica la deuda de cada cliente en:
   - `NO_VENCIDO` (días restantes $> 0$)
   - `DE_1_A_30_DIAS`
   - `DE_31_A_60_DIAS`
   - `DE_61_A_90_DIAS`
   - `MAS_DE_90_DIAS`
2. `GET /api/tesoreria/cxc/estado-cuenta/:id_cliente` retorna el extracto cronológico de cargos (ventas) y abonos (recibos) con saldo progresivo.
3. `GET /api/tesoreria/cxp/estado-cuenta/:id_proveedor` retorna el extracto cronológico de compras y pagos.

---

## Constraints & System Invariants
1. **Principio I (Consistencia Transaccional ACID)**: Cada amortización y actualización de saldo debe ejecutarse bajo transacciones atómicas con bloqueo `FOR UPDATE`.
2. **Principio II (No Sobre-Amortización)**: La suma acumulada de cobros/pagos nunca puede superar el monto contractual del documento de crédito.
3. **No-Regresión**: Los módulos 001 al 010 deben mantenerse completamente operativos.
