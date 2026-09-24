# Feature Spec: 006-cajas-turnos-arqueos

## Contexto y Justificación del Negocio
En DIREMOR S.R.L., el flujo diario de ventas en mostrador requiere un estricto control de tesorería y efectivo físico para prevenir mermas, descuadres o fraudes internos.
Para lograr una gobernanza financiera transparente:
1. Ningún cajero puede procesar ventas en efectivo si no cuenta con un **Turno de Caja Abierto** en la sucursal.
2. Cada turno inicia con un fondo de cambio o sencillo (`monto_apertura`).
3. El sistema debe permitir registrar entradas y salidas de efectivo imprevistas (`cajas_movimientos_manuales`) como pagos a mensajería, reposición de cambio o retiros de seguridad a caja fuerte.
4. El cierre de turno implementa la práctica de **Arqueo Ciego**: el cajero cuenta físicamente el dinero en gaveta e introduce su monto total sin que el sistema le revele previamente el saldo esperado, calculando de forma automática e imparcial la diferencia de corte (cuadre exacto, sobrante o faltante).

---

## User Stories y Criterios de Aceptación

### US1: Gestión de Cajas Físicas por Sucursal
**Como** Administrador o Supervisor de Sucursal  
**Quiero** registrar y consultar las cajas o puntos de cobro físicos disponibles en cada agencia  
**Para** asignar adecuadamente las estaciones de trabajo a los cajeros y operadores POS.

#### Criterios de Aceptación:
- **AC1.1**: Permite crear y listar cajas físicas vinculadas a una sucursal (`POST /api/cajas`, `GET /api/cajas`).
- **AC1.2**: No permite duplicar el código de caja dentro de la misma sucursal.
- **AC1.3**: Auto-inicializa al menos una "Caja Principal - Mostrador" en la sucursal si no existe ninguna.

---

### US2: Apertura de Turno de Caja
**Como** Cajero o Vendedor POS  
**Quiero** abrir mi turno diario especificando la caja física y el monto de dinero recibido para cambio  
**Para** habilitar la emisión de ventas y responsabilizarme de los valores recibidos.

#### Criterios de Aceptación:
- **AC2.1**: `POST /api/cajas/turnos/abrir` registra un nuevo turno en estado `ABIERTO` con `monto_apertura >= 0`.
- **AC2.2**: Impide que el mismo usuario abra un segundo turno si ya tiene un turno `ABIERTO` activo (`409 Conflict`).
- **AC2.3**: Impide abrir un turno en una caja física que ya esté ocupada por otro turno abierto simultáneo (`409 Conflict`).

---

### US3: Movimientos Manuales de Caja (Ingresos y Egresos Menores)
**Como** Cajero o Supervisor  
**Quiero** asentar entradas adicionales de sencillo o retiros menores de efectivo durante el turno  
**Para** justificar los movimientos físicos de dinero no vinculados directamente a una venta.

#### Criterios de Aceptación:
- **AC3.1**: `POST /api/cajas/turnos/:id/movimientos` registra movimientos de tipo `INGRESO` o `EGRESO` con un concepto obligatorio y `monto > 0`.
- **AC3.2**: Impide registrar movimientos manuales en turnos que ya se encuentren en estado `CERRADO` (`400 Bad Request`).

---

### US4: Arqueo Ciego y Cierre de Turno
**Como** Cajero y Supervisor de Caja  
**Quiero** realizar el conteo físico final, declarar el dinero en gaveta y cerrar el turno  
**Para** consolidar las ventas del turno, contrastar el efectivo teórico y determinar si hubo sobrante o faltante.

#### Criterios de Aceptación:
- **AC4.1**: `POST /api/cajas/turnos/:id/cerrar` recibe `monto_efectivo_declarado` y observaciones.
- **AC4.2**: Calcula el saldo teórico esperado:
  `saldo_teorico = monto_apertura + ventas_efectivo + total_ingresos_manuales - total_egresos_manuales`.
- **AC4.3**: Calcula la diferencia de corte:
  `diferencia = monto_efectivo_declarado - saldo_teorico`.
- **AC4.4**: Registra el desglose de ventas por modalidad (efectivo, QR, crédito) y marca el turno como `CERRADO`.
- **AC4.5**: Impide cerrar un turno ya cerrado previamente (`400 Bad Request`).

---

### US5: Reporte Resumido y Consulta de Turnos
**Como** Auditor o Administrador  
**Quiero** consultar los turnos abiertos y cerrados con sus arqueos y detalles de cobro  
**Para** auditar la recaudación diaria por sucursal y vendedor.

#### Criterios de Aceptación:
- **AC5.1**: `GET /api/cajas/turnos` permite filtrar por fecha, sucursal, estado y cajero.
- **AC5.2**: `GET /api/cajas/turnos/activo` devuelve el turno actualmente abierto para el usuario en sesión.
- **AC5.3**: `GET /api/cajas/turnos/:id` retorna la ficha completa del turno: totales de ventas por forma de pago, movimientos manuales, monto declarado y diferencia de cuadre.
