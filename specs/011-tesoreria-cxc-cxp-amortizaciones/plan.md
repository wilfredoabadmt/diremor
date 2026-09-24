# Technical Plan: 011-tesoreria-cxc-cxp-amortizaciones

## Architecture & Design Decisions

### 1. Modelo de Datos DDL (PostgreSQL 16+)
- **Migración**: `database/migrations/008_tesoreria_cxc_cxp_schema.sql`
- **Tablas**:
  - `cxc_cuentas`:
    - `id_cxc BIGINT PRIMARY KEY`
    - `id_venta BIGINT REFERENCES ventas_cabecera` (opcional si es saldo inicial)
    - `id_cliente BIGINT REFERENCES clientes`
    - `id_sucursal INT REFERENCES sucursales`
    - `numero_documento_ref VARCHAR(50)`
    - `monto_total NUMERIC(14,2)`
    - `monto_amortizado NUMERIC(14,2) DEFAULT 0.00`
    - `monto_saldo NUMERIC(14,2)`
    - `fecha_emision TIMESTAMPTZ`
    - `fecha_vencimiento DATE`
    - `dias_credito INT`
    - `estado VARCHAR(20) DEFAULT 'PENDIENTE'` ('PENDIENTE', 'PAGADO', 'VENCIDO')
  - `cxc_cobros`:
    - `id_cobro BIGINT PRIMARY KEY`
    - `id_cxc BIGINT REFERENCES cxc_cuentas`
    - `numero_recibo VARCHAR(50) UNIQUE`
    - `fecha_cobro TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
    - `monto_cobrado NUMERIC(14,2)`
    - `forma_pago VARCHAR(25)`
    - `numero_referencia VARCHAR(50)`
    - `observaciones TEXT`
    - `id_usuario BIGINT REFERENCES usuarios`
  - `cxp_cuentas`:
    - `id_cxp BIGINT PRIMARY KEY`
    - `id_compra BIGINT REFERENCES compras_cabecera` (opcional si es saldo inicial)
    - `id_proveedor BIGINT REFERENCES proveedores`
    - `id_sucursal INT REFERENCES sucursales`
    - `numero_documento_ref VARCHAR(50)`
    - `monto_total NUMERIC(14,2)`
    - `monto_amortizado NUMERIC(14,2) DEFAULT 0.00`
    - `monto_saldo NUMERIC(14,2)`
    - `fecha_emision TIMESTAMPTZ`
    - `fecha_vencimiento DATE`
    - `dias_credito INT`
    - `estado VARCHAR(20) DEFAULT 'PENDIENTE'` ('PENDIENTE', 'PAGADO', 'VENCIDO')
  - `cxp_pagos`:
    - `id_pago BIGINT PRIMARY KEY`
    - `id_cxp BIGINT REFERENCES cxp_cuentas`
    - `numero_comprobante VARCHAR(50) UNIQUE`
    - `fecha_pago TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`
    - `monto_pagado NUMERIC(14,2)`
    - `forma_pago VARCHAR(25)`
    - `numero_referencia VARCHAR(50)`
    - `observaciones TEXT`
    - `id_usuario BIGINT REFERENCES usuarios`

---

### 2. Algoritmos de Cobranzas, Pagos y Mora
1. **Cobro a Cliente (`POST /api/tesoreria/cxc/cobros`)**:
   - Bloquea `cxc_cuentas WHERE id_cxc = $1 FOR UPDATE`.
   - Verifica: `monto_cobrado <= monto_saldo`.
   - Inserta en `cxc_cobros`.
   - Actualiza `cxc_cuentas`:
     - `monto_amortizado = monto_amortizado + monto_cobrado`
     - `monto_saldo = monto_total - monto_amortizado`
     - Si `monto_saldo == 0`, `estado = 'PAGADO'`.
   - Evaluación de mora del cliente:
     - Cuenta si el cliente tiene otras cuentas en `cxc_cuentas` con `fecha_vencimiento < CURRENT_DATE AND estado != 'PAGADO'`.
     - Si no tiene deudas vencidas pendientes, actualiza `clientes SET bloqueo_mora = FALSE WHERE id_cliente = $1`.
2. **Pago a Proveedor (`POST /api/tesoreria/cxp/pagos`)**:
   - Bloquea `cxp_cuentas WHERE id_cxp = $1 FOR UPDATE`.
   - Verifica: `monto_pagado <= monto_saldo`.
   - Inserta en `cxp_pagos`.
   - Actualiza `cxp_cuentas` (amortizado, saldo, estado).
3. **Reporte de Antigüedad de Saldos**:
   - Clasifica los saldos pendientes por diferencia de fechas:
     $$\Delta = \text{CURRENT\_DATE} - \text{fecha\_vencimiento}$$
   - Si $\Delta \le 0 \rightarrow \text{NO\_VENCIDO}$
   - Si $1 \le \Delta \le 30 \rightarrow \text{DE\_1\_A\_30\_DIAS}$
   - Si $31 \le \Delta \le 60 \rightarrow \text{DE\_31\_A\_60\_DIAS}$
   - Si $61 \le \Delta \le 90 \rightarrow \text{DE\_61\_A\_90\_DIAS}$
   - Si $\Delta > 90 \rightarrow \text{MAS\_DE\_90\_DIAS}$

---

### 3. Endpoints Diseñados
- `POST /api/tesoreria/cxc`: Crear / registrar cuenta por cobrar
- `GET /api/tesoreria/cxc`: Listar cuentas por cobrar con filtros
- `GET /api/tesoreria/cxc/:id`: Detalle y cobros asociados
- `POST /api/tesoreria/cxc/cobros`: Registrar cobro y amortización con recibo
- `GET /api/tesoreria/cxc/antiguedad-saldos`: Reporte consolidado de cartera
- `GET /api/tesoreria/cxc/estado-cuenta/:id_cliente`: Extracto financiero del cliente
- `POST /api/tesoreria/cxp`: Crear cuenta por pagar
- `GET /api/tesoreria/cxp`: Listar cuentas por pagar
- `GET /api/tesoreria/cxp/:id`: Detalle y pagos asociados
- `POST /api/tesoreria/cxp/pagos`: Registrar pago y comprobante a proveedor
- `GET /api/tesoreria/cxp/estado-cuenta/:id_proveedor`: Extracto financiero del proveedor

---

### 4. Plan de Verificación E2E en Vivo (`scratch/test_live_011.js`)
1. **Creación de CxC y Cobro**:
   - Emitir cuenta por cobrar para un cliente por 1,000 Bs (plazo 15 días).
   - Realizar cobro parcial de 400 Bs (recibo oficial), verificar que el saldo baje a 600 Bs.
   - Realizar cobro final de 600 Bs, verificar que el estado pase a `PAGADO` y saldo a 0 Bs.
2. **Rehabilitación Automática de Mora**:
   - Activar mora en un cliente con deuda vencida.
   - Liquidar la deuda vencida y verificar que `bloqueo_mora` pase automáticamente a `false`.
3. **Creación de CxP y Pago a Proveedor**:
   - Emitir cuenta por pagar a proveedor por 5,000 Bs.
   - Pagar 2,500 Bs con comprobante, saldo pasa a 2,500 Bs.
4. **Reporte de Antigüedad de Saldos**:
   - Consultar `antiguedad-saldos` y verificar distribución de carteras.
5. **Caminos Infelices**:
   - Cobro superior al saldo exigible (400).
   - Recibo con número duplicado (409).
   - Cuenta inexistente (404).
