# Architecture & Implementation Plan: 005-facturacion-fiscal-sin

## 1. Fundamentos Técnicos y Normativa SIN (RND 102100000011)

### 1.1. Algoritmo Oficial de Generación del CUF (Código Único de Facturación)
El CUF es una cadena en base 16 (hexadecimal) generada a partir de los siguientes campos concatenados numéricamente con longitudes fijas:

| Campo | Longitud | Descripción |
| :--- | :---: | :--- |
| NIT Emisor | 13 | NIT de DIREMOR S.R.L. (`1020304050`) relleno con ceros a la izquierda |
| Fecha y Hora | 17 | `YYYYMMDDHHmmssSSS` (milisegundos) |
| Código Sucursal | 4 | Relleno con ceros (`0000` = Matriz, `0001` = Agencia) |
| Modalidad | 1 | `1` = Electrónica en Línea, `2` = Computarizada en Línea |
| Tipo de Emisión | 1 | `1` = Online, `2` = Offline / Contingencia |
| Tipo Documento Fiscal | 1 | `1` = Factura con Derecho a Crédito Fiscal |
| Tipo Documento Sector | 2 | `01` = Factura Compra Venta estándar |
| Número Correlativo Factura | 10 | Número de factura consecutivo relleno con ceros |
| Código Punto de Venta | 4 | `0000` = Punto de venta por defecto |

A esta concatenación se le añade un **Dígito Verificador Módulo 11 (Base 11)**.
Finalmente, la cadena numérica resultante se convierte a representación **Hexadecimal (Base 16)** en mayúsculas, produciendo el CUF oficial del SIN de aproximadamente 40 a 64 caracteres.

### 1.2. Cadena del Código QR Fiscal
El formato estándar emitido por el SIN para consulta en línea es:
`https://siat.impuestos.gob.bo/consulta/QR?nit={nit}&cuf={cuf}&numero={numero_factura}&t={total_neto}`

---

## 2. Contratos de API (Endpoints)

### 2.1. `POST /api/facturas`
Genera la factura fiscal para una venta emitida.
- **Payload Request**:
```json
{
  "id_venta": 11,
  "codigo_punto_venta": 0
}
```
- **Response 201 Created**:
```json
{
  "message": "Factura fiscal emitida exitosamente.",
  "factura": {
    "id_factura": 1,
    "id_venta": 11,
    "numero_factura": 1001,
    "cuf": "4F9A83BC...",
    "cufd": "CUFD_PILOTO_SCZ_MATRIZ_2026",
    "fecha_emision": "2026-09-24T03:45:00.000Z",
    "total_neto": 1000.00,
    "qr_data": "https://siat.impuestos.gob.bo/consulta/QR?nit=1020304050&cuf=4F9A...&numero=1001&t=1000",
    "estado_sin": "VALIDA"
  }
}
```

### 2.2. `GET /api/facturas/:id`
Consulta factura por ID, incluyendo cabecera, cliente, sucursal, detalle y datos de representación gráfica.

### 2.3. `GET /api/facturas/venta/:id_venta`
Obtiene la factura asociada a una venta específica.

### 2.4. `POST /api/facturas/:id/anular`
Anula la factura fiscal con código de motivo reglamentario.
- **Payload**:
```json
{
  "codigo_motivo": 1,
  "motivo": "FACTURA MAL EMITIDA",
  "anular_venta_asociada": true
}
```

---

## 3. Integración y Módulo Utilitario Fiscal
- Archivo utilitario: `src/utils/sinFiscal.ts`:
  - `calcularDigitoModulo11(cadena: string): number`
  - `generarCUF(params: CUFParams): string`
  - `generarCadenaQRFiscal(params: QRParams): string`
- Controlador: `src/routes/facturacion.ts`
- Montaje en: `src/index.ts` bajo `/api/facturas`.
