# Feature Specification: 003-clientes-credito-mora

**Feature Name**: Maestro de Clientes, Límites de Crédito y Control de Bloqueo por Mora  
**Target Milestone**: DIREMOR SAC v1.2.0  
**Related SDD Sections**: 3.5 (Módulo Financiero y Cobranzas), 4.2 (ERD), 4.3 (DDL Clientes)

---

## 1. Contexto y Justificación del Negocio

DIREMOR S.R.L. atiende tanto clientes corporativos mayoristas (que operan con líneas de crédito a 30, 60 o 90 días) como clientes minoristas y de mostrador (ventas al contado).
Para mitigar el riesgo crediticio y salvaguardar la liquidez empresarial, el sistema debe controlar los límites de crédito asignados, mantener la información fiscal (NIT/CI para facturación en línea según RND 102100000011 del SIN) y aplicar la regla de **bloqueo automático por mora** que impida ventas a crédito a clientes con saldos vencidos.

---

## 2. Historias de Usuario

### User Story 1 (P1): Padrón de Clientes y Validación Tributaria
**Como** Encargado de Ventas o Administrador  
**Quiero** registrar y mantener el padrón de clientes con su información fiscal (Razón Social, NIT/CI, Tipo de Documento, Teléfono, Dirección)  
**Para** emitir cotizaciones y facturas legales cumpliendo con los estándares del SIN.

#### Criterios de Aceptación:
- `POST /api/clientes`: Crea un cliente validando `razon_social`, `nit_ci` y `tipo_documento` ('NIT', 'CI', 'CEX', 'PAS'). Retorna `HTTP 201`.
- `GET /api/clientes`: Lista clientes con búsqueda insensible a mayúsculas (`?q=term` por razón social o NIT/CI) y filtros por estado y bloqueo de mora. Retorna `HTTP 200`.
- `GET /api/clientes/:id`: Obtiene el perfil detallado del cliente. Retorna `HTTP 200` o `HTTP 404`.
- `PUT /api/clientes/:id`: Actualiza datos de contacto y comerciales. Retorna `HTTP 200`.

---

### User Story 2 (P1): Asignación de Límites de Crédito y Control de Mora
**Como** Gerente Financiero o Responsable de Créditos y Cobranzas  
**Quiero** parametrizar el límite de crédito en Bs y activar/desactivar la bandera de bloqueo por mora  
**Para** proteger la cartera de la empresa de ventas desmedidas o incobrables.

#### Criterios de Aceptación:
- `PATCH /api/clientes/:id/credito`: Permite actualizar `limite_credito` (debe ser `>= 0`) y `bloqueo_mora` (`boolean`). Requiere rol `ADMIN` o `CONTABILIDAD`.
- Si `bloqueo_mora = true`, el endpoint de verificación crediticia `GET /api/clientes/:id/evaluacion-credito` debe reportar `apto_para_credito: false` con causal `Cliente bloqueado por mora`.
- Si el monto de una venta a crédito excede el saldo de crédito disponible, reporta `apto_para_credito: false` con causal `Límite de crédito excedido`.

---

### User Story 3 (P2): Cliente Genérico para Mostrador POS
**Como** Cajero de Punto de Venta  
**Quiero** disponer de un cliente genérico predeterminado ("Sin Nombre", NIT "0")  
**Para** agilizar ventas rápidas al contado sin requerir datos fiscales completos del comprador.

#### Criterios de Aceptación:
- `GET /api/clientes/generico`: Retorna el registro del cliente de mostrador (NIT "0", tipo "CI/NIT", límite de crédito 0). Si no existe, se auto-inicializa idempotentemente.
