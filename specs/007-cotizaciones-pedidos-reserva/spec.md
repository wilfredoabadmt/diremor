# Feature Spec: 007-cotizaciones-pedidos-reserva

## Contexto y Justificación del Negocio
En DIREMOR S.R.L., una parte sustancial de las ventas a empresas constructoras, mineras y talleres industriales se formaliza a través de **Cotizaciones y Pedidos Formales**.
Para asegurar un flujo comercial ágil y profesional:
1. Los asesores comerciales deben poder emitir cotizaciones formales con vigencia delimitada (ej: 7 o 15 días calendario), congelando temporalmente los precios pactados para el cliente.
2. Cada cotización calcula de manera automática los subtotales, descuentos y total neto.
3. El sistema debe permitir la **conversión directa de una cotización aprobada a Venta POS** en un solo clic/endpoint, evitando la doble digitación manual por parte del cajero y garantizando que se respeten los precios y cantidades cotizadas.
4. Si la cotización ha superado su `fecha_vencimiento`, el sistema debe alertar y bloquear la conversión automática para evitar vender con precios desactualizados.

---

## User Stories y Criterios de Aceptación

### US1: Emisión de Cotización Comercial
**Como** Asesor Comercial o Vendedor  
**Quiero** elaborar una cotización especificando el cliente, lista de productos, precios y días de vigencia  
**Para** entregar una propuesta formal al cliente con validez comercial garantizada.

#### Criterios de Aceptación:
- **AC1.1**: Permite registrar cotizaciones para clientes corporativos o cliente genérico mostrador (`POST /api/cotizaciones`).
- **AC1.2**: Asigna automáticamente `fecha_emision = CURRENT_TIMESTAMP` y calcula `fecha_vencimiento` según los `dias_validez` indicados (por defecto 7 días).
- **AC1.3**: Valida que los productos existan y estén activos en el catálogo.
- **AC1.4**: Asocia automáticamente la cotización a la sucursal del usuario en sesión (`req.user.id_sucursal`) y al vendedor emisor.

---

### US2: Conversión Directa de Cotización a Venta POS
**Como** Vendedor o Cajero  
**Quiero** convertir una cotización aprobada por el cliente directamente en una Venta POS  
**Para** concretar la operación comercial sin reescribir los ítems y descargar el inventario automáticamente.

#### Criterios de Aceptación:
- **AC2.1**: `POST /api/cotizaciones/:id/convertir-a-venta` genera la venta en `ventas_cabecera` y `ventas_detalle` en una transacción atómica.
- **AC2.2**: El trigger de PostgreSQL `trg_descontar_kardex_venta` descuenta automáticamente las existencias del almacén de despacho.
- **AC2.3**: Si la cotización ya fue convertida previamente (`estado = 'CONVERTIDA'`), rechaza con código `409 Conflict`.
- **AC2.4**: Si la cotización está vencida (`fecha_vencimiento < NOW()`), rechaza la conversión automática con código `400 Bad Request`.
- **AC2.5**: Actualiza el estado de la cotización a `CONVERTIDA` y vincula el `id_venta_generada`.

---

### US3: Consulta y Búsqueda de Cotizaciones
**Como** Vendedor, Auditor o Administrador  
**Quiero** consultar y filtrar las cotizaciones emitidas por cliente, fecha, sucursal o estado  
**Para** realizar seguimiento comercial a los presupuestos pendientes de cierre.

#### Criterios de Aceptación:
- **AC3.1**: `GET /api/cotizaciones` permite filtrar por `id_cliente`, `estado` (`PENDIENTE`, `CONVERTIDA`, `VENCIDA`), `fecha_desde` y `fecha_hasta`.
- **AC3.2**: `GET /api/cotizaciones/:id` retorna la cabecera completa con datos del cliente, vendedor y la lista detallada de productos.
- **AC3.3**: Determina dinámicamente si una cotización pendiente ha caducado por fecha y refleja su estado de vigencia.

---

### US4: Cancelación o Rechazo de Cotización
**Como** Asesor Comercial o Administrador  
**Quiero** marcar como rechazada o cancelada una cotización descartada por el cliente  
**Para** mantener limpio el pipeline de oportunidades y estadísticas comerciales.

#### Criterios de Aceptación:
- **AC4.1**: `POST /api/cotizaciones/:id/rechazar` actualiza el estado a `RECHAZADA`.
- **AC4.2**: Impide rechazar una cotización que ya fue convertida a venta.
