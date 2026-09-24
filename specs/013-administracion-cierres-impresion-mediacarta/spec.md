# Feature Specification: 013-administracion-cierres-impresion-mediacarta

## 1. Visión General y Contexto
El Módulo de **Administración, Cierres de Período e Impresión Media Carta** de DIREMOR SAC consolida el gobierno operativo y la presentación documental corporativa del sistema. Provee:
1. **Control de Períodos Contables y Comerciales:** Mecanismo de blindaje contra registros extemporáneos o manipulaciones retrospectivas mediante el cierre y bloqueo de meses contables.
2. **Configuración de Sucursales:** Gestión de metadatos fiscales, puntos de venta y parámetros operativos por sede.
3. **Motor de Renderizado Documental Media Carta:** Generación de formatos impresos estandarizados en tamaño media carta (5.5" x 8.5" / 140mm x 216mm) con logotipo oficial de DIREMOR S.R.L., códigos QR tributarios, conversión de importes a literal y casillas de rúbricas/firmas de auditoría.

---

## 2. Requerimientos de Usuario (User Stories)

### US1: Control de Cierres de Períodos Contables
**Como** Administrador o Contador General de DIREMOR S.R.L.  
**Quiero** consultar y gestionar el estado de los períodos mensuales (Abierto/Cerrado)  
**Para** congelar los libros contables y tributarios una vez declarados al SIN, impidiendo que los cajeros o usuarios alteren datos históricos.

- **Criterio de Aceptación 1.1:** Solo los usuarios con rol `ADMIN` pueden ejecutar el cierre o reapertura de un período mensual (`año`, `mes`).
- **Criterio de Aceptación 1.2:** Toda transacción con fecha perteneciente a un período `CERRADO` (asientos contables, ventas, compras) debe ser rechazada con HTTP 403 Forbidden.
- **Criterio de Aceptación 1.3:** Debe existir un endpoint para consultar el estado del período para una fecha determinada.

### US2: Parámetros y Configuración Operativa de Sucursales
**Como** Gerente de Operaciones  
**Quiero** administrar los datos comerciales, fiscales y de contacto de cada sucursal  
**Para** que los documentos impresos y comprobantes reflejen la dirección, teléfono, municipio y pie de página fiscal correctos.

- **Criterio de Aceptación 2.1:** Cada sucursal dispone de campos para leyenda fiscal personalizada, código de punto de venta SIN, teléfono de soporte y correo de contacto.
- **Criterio de Aceptación 2.2:** Se pueden actualizar los parámetros de la sucursal mediante endpoint protegido por RBAC.

### US3: Motor de Impresión Media Carta (HTML/Print Ready)
**Como** Cajero, Vendedor o Responsable de Tesorería  
**Quiero** obtener documentos listos para imprimir en tamaño **Media Carta** con estilos CSS optimizados para impresión directa  
**Para** emitir comprobantes contables, facturas fiscales, recibos de caja y proformas con imagen corporativa impecable y tamaño económico de papel.

- **Criterio de Aceptación 3.1:** El motor genera vistas HTML con directivas `@page { size: 140mm 216mm; margin: 8mm; }` y diseño responsive listo para imprimir (`window.print()`).
- **Criterio de Aceptación 3.2:** Comprobante Contable Media Carta: Muestra encabezado corporativo DIREMOR, número de comprobante, tipo (`INGRESO`, `EGRESO`, `TRASPASO`), glosa general, tabla balanceada de partidas (Código, Cuenta, Debe, Haber), y 3 casillas de firmas (`Elaborado Por`, `Revisado Por`, `Autorizado Por`).
- **Criterio de Aceptación 3.3:** Factura Fiscal Media Carta: Muestra cabecera tributaria, CUF, CUFD, datos del cliente, detalle de ítems, totales, código QR SIN y leyenda de la Ley Nro 453.
- **Criterio de Aceptación 3.4:** Recibo de Cobranza Media Carta: Muestra número correlativo de recibo, cliente, concepto, importe numérico, importe en literal en bolivianos y firma del cobrador.
- **Criterio de Aceptación 3.5:** Cotización / Proforma Media Carta: Muestra vigencia temporal, cliente, validez de oferta y totales.

---

## 3. Modelo de Datos

### 1. `periodos_contables`
- `id_periodo` (PK, INT)
- `anio` (INT NOT NULL)
- `mes` (INT NOT NULL CHECK (mes BETWEEN 1 AND 12))
- `estado` (VARCHAR 20 NOT NULL DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'CERRADO')))
- `fecha_cierre` (TIMESTAMPTZ)
- `id_usuario_cierre` (FK usuarios)
- `observaciones` (TEXT)
- UNIQUE (anio, mes)

### 2. Ampliación de `sucursales` (Parámetros)
- `telefono` (VARCHAR 50)
- `email` (VARCHAR 100)
- `leyenda_fiscal` (TEXT)
- `codigo_punto_venta_sin` (INT DEFAULT 0)
