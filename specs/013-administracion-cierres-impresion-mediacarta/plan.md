# Implementation Plan: 013-administracion-cierres-impresion-mediacarta

## 1. Arquitectura Técnica
Este módulo implementa:
1. Esquema de persistencia para el bloqueo de períodos contables (`periodos_contables`) y campos adicionales en `sucursales`.
2. Rutas administrativas en `src/routes/administracion.ts` para consulta, cierre y reapertura de meses.
3. Rutas de renderizado de documentos en `src/routes/impresion.ts` retornando HTML con diseño para tamaño Media Carta (`140mm x 216mm`), membrete DIREMOR, logos, fuentes legibles y directivas CSS `@media print`.

---

## 2. Fases de Implementación

### Fase 1: Esquema de Base de Datos DDL
- Archivo: `database/migrations/010_administracion_cierres_schema.sql`.
  - Crear tabla `periodos_contables`.
  - Agregar columnas de configuración a la tabla `sucursales`.
  - Procedimiento o función de validación de período abierto.

### Fase 2: Controladores y Rutas de Administración (`src/routes/administracion.ts`)
- `GET /api/administracion/periodos`: Lista de períodos y estados.
- `POST /api/administracion/periodos/cerrar`: Cierre de período mensual (exclusivo `ADMIN`).
- `POST /api/administracion/periodos/reabrir`: Reapertura excepcional de período (exclusivo `ADMIN`).
- `GET /api/administracion/periodos/verificar`: Verifica si una fecha cae en período abierto o cerrado.
- `GET /api/administracion/sucursales/:id`: Consulta de parámetros de sucursal.
- `PUT /api/administracion/sucursales/:id`: Actualización de parámetros operativos de sucursal.

### Fase 3: Motor de Impresión Media Carta (`src/routes/impresion.ts`)
- `GET /api/impresion/comprobante/:id`: Plantilla Media Carta de Comprobante Contable (Ingreso, Egreso, Traspaso) con 3 firmas de auditoría.
- `GET /api/impresion/factura/:id`: Plantilla Media Carta de Factura Fiscal SIN con código QR, CUF y leyendas tributarias.
- `GET /api/impresion/recibo-cobro/:id`: Plantilla Media Carta de Recibo Oficial de Cobranza con desglose numérico y literal.
- `GET /api/impresion/proforma/:id`: Plantilla Media Carta de Cotización Comercial.

### Fase 4: Integración en Portal y Compilación
- Registrar `administracionRouter` e `impresionRouter` en `src/index.ts`.
- Añadir la tarjeta `013-ADMINISTRACIÓN & IMPRESIÓN` en `src/portal.ts`.
- Validar compilación local con `npm run build`.

### Fase 5: Despliegue en Coolify y Verificación en Vivo
- Sincronizar en git (`git push origin main`).
- Desplegar vía Coolify (`deploy` a `ygodaygbxqjqqlssdy8clib8`).
- Ejecutar suite E2E `scratch/test_live_013.js`.
- Ejecutar suite de no-regresión completa (003, 005, 006, 010, 011, 012).
