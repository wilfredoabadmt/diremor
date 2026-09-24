# Feature Spec: 005-facturacion-fiscal-sin

## Contexto y Justificación del Negocio
En Bolivia, la normativa del Servicio de Impuestos Nacionales (SIN) —específicamente la Resolución Normativa de Directorio **RND 102100000011** (Sistema de Facturación)— establece que las empresas comerciales categorizadas en la modalidad de Facturación Electrónica en Línea o Computarizada en Línea deben emitir facturas con:
1. **CUF (Código Único de Facturación)** generado de forma algorítmica e irrepetible para cada comprobante.
2. **CUFD (Código Único de Facturación Diario)** vigente obtenido para la sucursal y punto de venta.
3. **Cadena oficial para Código QR Fiscal** que permita al comprador y a la administración tributaria verificar la autenticidad del documento digital.
4. **Numeración correlativa continua e inalterable** por sucursal y punto de venta.
5. **Procedimiento estricto de anulación fiscal** con registro de motivo reglamentario.

---

## User Stories y Criterios de Aceptación

### US1: Emisión de Factura Fiscal para una Venta Emitida
**Como** Facturador o Cajero  
**Quiero** generar la factura fiscal correspondiente a una venta emitida en el sistema  
**Para** cumplir con la obligación tributaria y entregar el documento fiscal legal al cliente.

#### Criterios de Aceptación:
- **AC1.1**: Permite emitir factura a partir de una venta existente en estado `EMITIDA`. Si la venta ya fue facturada, rechaza con código `409 Conflict`.
- **AC1.2**: Asigna automáticamente el siguiente número correlativo de factura para la sucursal emisora.
- **AC1.3**: Genera el **CUF** único combinando:
  - NIT Emisor (DIREMOR S.R.L.: `1020304050`)
  - Fecha y hora en formato `YYYYMMDDHHmmssSSS`
  - Código de Sucursal (`id_sucursal`)
  - Modalidad de facturación (`1` = Electrónica en Línea)
  - Tipo de Emisión (`1` = Online)
  - Tipo de Documento Fiscal (`1` = Factura Compra/Venta)
  - Tipo de Documento Sector (`1` = Factura Estándar)
  - Número correlativo de factura
  - Código de Punto de Venta
  - Dígito verificador Módulo 11
- **AC1.4**: Construye la cadena de datos requerida para el código QR fiscal oficial del SIN:
  `https://siat.impuestos.gob.bo/consulta/QR?nit={nit}&cuf={cuf}&numero={nro}&t={monto}`.
- **AC1.5**: Registra la factura en `facturas_fiscales` con estado `VALIDA`.

---

### US2: Emisión Directa Venta + Factura en un Solo Paso
**Como** Vendedor en Mostrador  
**Quiero** la opción de emitir la venta y su factura fiscal en una sola llamada de API  
**Para** reducir la latencia operativa en puntos de venta con alto flujo de clientes.

#### Criterios de Aceptación:
- **AC2.1**: Si en `POST /api/ventas` se envía el flag `facturar: true`, el sistema emite la venta, descuenta inventario en Kardex y genera la factura fiscal en la misma transacción ACID.

---

### US3: Consulta de Factura y Representación Gráfica (Media Carta / Rollo)
**Como** Cliente, Auditor o Cajero  
**Quiero** consultar los datos completos de una factura emitida o generarla en formato de impresión  
**Para** imprimir el documento tributario o enviarlo en formato digital.

#### Criterios de Aceptación:
- **AC3.1**: `GET /api/facturas/:id` retorna los datos fiscales completos: Razón Social, NIT cliente, número de factura, CUF, CUFD, fecha de emisión, lista de ítems, totales, leyenda tributaria de ley y cadena QR.
- **AC3.2**: `GET /api/facturas/venta/:id_venta` permite obtener la factura asociada a una venta específica.

---

### US4: Anulación de Factura Fiscal
**Como** Administrador o Supervisor de Sucursal  
**Quiero** anular una factura fiscal emitida  
**Para** corregir errores en el documento fiscal y notificar el motivo de anulación.

#### Criterios de Aceptación:
- **AC4.1**: `POST /api/facturas/:id/anular` exige especificar un `motivo_anulacion` válido (ej: `1: FACTURA MAL EMITIDA`, `2: DATOS DE EMISION INCORRECTOS`, `3: FACTURA O NOTA DE CREDITO-DEBITO DEVUELTA`).
- **AC4.2**: Actualiza el estado fiscal a `ANULADA` y registra metadata de anulación con fecha y usuario responsable.
- **AC4.3**: Si la venta asociada no estaba anulada, permite opcionalmente anular la venta y restituir el stock en Kardex.
- **AC4.4**: No permite anular una factura ya anulada previamente.
