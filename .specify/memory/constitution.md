<!--
SYNC IMPACT REPORT
==================
Constitución formal para el proyecto DIREMOR - Sistema SAC (Sistema de Gestión Administrativo Comercial integrado a Contabilidad).
Adaptada a arquitectura empresarial basada en Coolify PaaS, Docker y PostgreSQL 16+.

Versión: 2.0.0 (Ratificada para DIREMOR S.R.L.)
Principios definidos (9):
  - I.    Seguridad de Datos y Consistencia Transaccional ACID (NO NEGOCIABLE)
  - II.   Soberanía / Self-Hosted en Coolify (Docker + PostgreSQL 16+)
  - III.  Multi-Sucursal con Centralización en Tiempo Real
  - IV.   Idempotencia y Cumplimiento Normativo Fiscal SIN (RND 102100000011)
  - V.    Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)
  - VI.   Specs Antes de Código (SDD Core)
  - VII.  Inalterabilidad Contable y Auditoría Transaccional
  - VIII. Foco Vertical: Comercialización, Importaciones (DUI) y Manufactura
  - IX.   Verificación de Comportamiento en Vivo (NO NEGOCIABLE)

Historial:
  - 1.1.0: Plantilla starter genérica.
  - 2.0.0: Ratificación de la Constitución de DIREMOR SAC sobre Coolify PaaS,
           PostgreSQL 16+, Traefik Proxy y facturación en línea certificada SIN.
-->

# DIREMOR SAC Constitution

Sistema en Línea de Gestión Administrativo Comercial integrado a Contabilidad (**SAC**) para **DIREMOR S.R.L.**, desplegado sobre **Coolify PaaS** con persistencia en **PostgreSQL 16+**. Esta constitución establece las directrices fundamentales, principios arquitectónicos y reglas no negociables que gobiernan todo el ciclo de vida del software (especificación, planificación, diseño de tareas, implementación y verificación). Cualquier decisión de diseño o código que entre en conflicto con esta constitución **SE RESUELVE OBLIGATORIAMENTE A FAVOR DE ESTA CONSTITUCIÓN**.

---

## Core Principles

### I. Seguridad de Datos y Consistencia Transaccional ACID (NO NEGOCIABLE)

La protección de los datos y la consistencia matemática de la información financiera y de existencias son la máxima responsabilidad del sistema.

- **Confidencialidad de Secretos:** Llaves dosificadas del SIN, certificados digitales de firma electrónica, tokens JWT de sesión, cadenas de conexión a base de datos y contraseñas jamás se exponen en el cliente (frontend web, respuestas JSON, consolas) ni se registran en logs o volcados de excepciones.
- **Aislamiento Criptográfico:** Toda credencial se inyecta mediante variables de entorno en tiempo de ejecución (`DATABASE_URL`, `JWT_SECRET`, `SIN_PRIVATE_KEY`) administradas en Coolify.
- **Atomicidad Transaccional Indivisible:** Las operaciones comerciales críticas (como la emisión de una factura de venta) constituyen una única transacción ACID en PostgreSQL. Una factura **DEBE** impactar sincrónicamente: (1) Registro de venta fiscal, (2) Descuento de stock en Kardex físico-valorado, (3) Asiento en Cuentas por Cobrar o Caja POS, y (4) Comprobante de diario contable oficial. Está terminantemente prohibido generar estados parciales, saldos desfasados o transacciones huérfanas.

**Rationale**: Un desfase entre inventarios, cartera de clientes y libros contables destruye la confianza directiva y genera contingencias fiscales severas ante la administración tributaria.

---

### II. Soberanía / Self-Hosted en Coolify (Docker + PostgreSQL 16+)

El sistema SAC opera 100% bajo control de infraestructura propia (self-hosted), orquestado por **Coolify PaaS** sobre contenedores Docker y red privada.

- **Persistencia en PostgreSQL 16+:** El motor principal de base de datos es PostgreSQL 16+ gestionado en Coolify. Queda proscrito el uso de gestores propietarios con limitaciones artificiales de hardware o licencias gravosas (eliminando Oracle XE).
- **Aislamiento de Red:** El contenedor de base de datos reside en la red interna aislada (`coolify-network`). El puerto 5432 **NUNCA** se expone a internet pública. Solo la API backend interactúa directamente con la base de datos.
- **Terminación SSL/TLS Centralizada:** El tráfico externo ingresa exclusivamente por el puerto seguro HTTPS (443) gestionado por **Traefik Reverse Proxy**, con certificados SSL automáticos (Let's Encrypt o dominios corporativos).
- **Almacenamiento de Objetos Compatible S3:** Fotografías de artículos, respaldos de facturas XML/PDF y comprobantes se almacenan mediante interfaz estándar compatible con S3 (MinIO gestionado en Coolify o buckets compatibles), permitiendo portabilidad absoluta sin depender de rutas locales de Windows.

**Rationale**: La independencia tecnológica y el control de costos garantizan que DIREMOR S.R.L. no sufra bloqueos de proveedor (*vendor lock-in*) ni dependa de costosos enlaces dedicados obsoletos.

---

### III. Multi-Sucursal con Centralización en Tiempo Real

El sistema está concebido para interconectar en tiempo real la Casa Matriz y las sucursales geográficamente dispersas de DIREMOR S.R.L.

- **Scope Obligatorio de Sede y Almacén:** Toda transacción operativa (venta, arqueo, compra, requisición o movimiento físico) requiere obligatoriamente `id_sucursal` e `id_almacen` en su modelo de datos y capa de persistencia.
- **Disponibilidad y Concurrencia Ubicua:** Las sucursales acceden mediante interfaz Web Progresiva (PWA) de alta velocidad sin requerir instalaciones pesadas de escritorio ni configuraciones complejas de VPN por cada terminal de trabajo.
- **Consolidación Financiera Centralizada:** Aunque cada sucursal opera de forma autónoma sus cajas y despachos, la contabilidad general y el stock consolidado se visualizan en tiempo real desde la administración central.

**Rationale**: Evitar la dispersión de datos y los procesos manuales nocturnos de consolidación que generan discrepancias operativas entre ciudades.

---

### IV. Idempotencia y Cumplimiento Normativo Fiscal SIN (RND 102100000011)

El sistema SAC se adhiere de forma incondicional al marco tributario boliviano y a los estándares del Servicio de Impuestos Nacionales (SIN).

- **Generación Algorítmica Conforme a Norma:** El motor tributario implementa de forma exacta los algoritmos oficiales de generación de Código de Control, cálculo de hash SHA-256 para el Código Único de Facturación (**CUF**), Código Único de Facturación Diaria (**CUFD**) y matrices bidimensionales **QR**.
- **Idempotencia Transaccional Fiscal:** La retransmisión de peticiones o reintentos de red por intermitencia no debe generar doble emisión de facturas fiscales ni duplicar asientos contables. Cada transacción posee un identificador de idempotencia unívoco.
- **Tipologías Fiscales Soportadas:** El sistema soporta Facturación Computarizada en Línea, Facturación Electrónica en Línea, Facturas de Exportación, Tasa Cero IVA, Alquileres y Servicios.

**Rationale**: La emisión fiscal es un proceso legal de alta responsabilidad; duplicidades o errores conllevan sanciones económicas e inhabilitaciones por parte del ente regulador.

---

### V. Calidad Verificable Antes de "Hecho" (NO NEGOCIABLE)

Ninguna tarea o feature se declara concluida sin superar las compuertas técnicas y de comportamiento.

- **Gate Técnico Obligatorio:** Toda entrega requiere tipado estricto sin errores (`typecheck`), ausencia de advertencias críticas de lint (`lint`), compilación exitosa (`build`) y pruebas automatizadas de lógica de negocio (validación de mora, cálculo de precios por volumen, generación de asientos).
- **Prohibido el Optimismo No Comprobado:** Jamás se entrega una tarea manifestando que "debería funcionar". O se cuenta con evidencia reproducible y verde, o se declara formalmente como bloqueada o pendiente de verificación humana.

**Rationale**: En un sistema contable y de facturación empresarial, un bug no detectado en cálculo de impuestos o stock paraliza la operación comercial de la empresa.

---

### VI. Specs Antes de Código (SDD Core)

El desarrollo sigue rigurosamente el paradigma **Spec-Driven Development (SDD)**.

- **Flujo Secuencial Obligatorio:** `specify` $\rightarrow$ `clarify` $\rightarrow$ `plan` $\rightarrow$ `tasks` $\rightarrow$ `implement`.
- **Enfoque en Comportamiento Observable:** Las especificaciones describen el comportamiento perceptible por el cajero, el contador o el jefe de almacén (ej. *"al sobrepasar el límite de crédito, la venta se bloquea y muestra un modal de autorización"*), no detalles de código interno.
- Cada incremento funcional se ubica en su directorio correspondiente dentro de `specs/NNN-nombre-feature/`.

**Rationale**: Diseñar y acordar los contratos y flujos antes de programar elimina el retrabajo y garantiza el cumplimiento exacto de la propuesta técnica.

---

### VII. Inalterabilidad Contable y Auditoría Transaccional

El patrimonio y los estados financieros de DIREMOR S.R.L. están blindados contra alteraciones no autorizadas o registros retroactivos.

- **Prohibición de Eliminación Física (No Hard Deletes):** Las facturas fiscales, asientos de diario mayorizados, registros de kardex y arqueos de caja cerrados **NUNCA** se eliminan físicamente de la base de datos (`DELETE`). Toda corrección se efectúa mediante transacciones de reversión (anulación fiscal formal, contra-asientos contables y notas de ajuste de inventario).
- **Pista de Auditoría Completa:** Cada modificación relevante almacena la estampa de tiempo (`timestamptz`), el identificador del usuario responsable (`id_usuario`) y la dirección IP de origen.
- **Cierre de Periodos Mensuales:** La funcionalidad de cierre mensual bloquea irrevocablemente las modificaciones a periodos finalizados, impidiendo distorsiones en balances históricos.

**Rationale**: Cumplir con los estándares de auditoría financiera, normas de control interno y requerimientos de peritaje contable.

---

### VIII. Foco Vertical: Comercialización, Importaciones (DUI) y Manufactura

El sistema SAC está concebido específicamente para el modelo de negocio integral de **DIREMOR S.R.L.**: comercialización mayorista/minorista, internación aduanera y ensamblado/producción.

- **Liquidación Integral de Importaciones:** Soporte especializado para pólizas de importación (**DUI**), absorbiendo y prorrateando fletes, seguros y gravámenes arancelarios (GA) de forma directa en el costo unitario de internación de mercaderías.
- **Trazabilidad Dual: Lotes y Números de Serie:** Control exhaustivo de garantías técnicas mediante número de serie individual y productos sensibles mediante lotes con fecha de caducidad (evitando ventas de ítems vencidos).
- **Estructura de Costeo Fabril:** Soporte de órdenes de trabajo (OT) con absorción técnica de Materia Prima (MP), Mano de Obra Directa (MOD) y Costos Indirectos de Fabricación (CIF).
- **Ergonomía de Puntos de Venta (POS) y Formato Media Carta:** Interfaz rápida con soporte de lectores ópticos de códigos de barra, atajos sin ratón y emisión estandarizada de comprobantes en papel tamaño **media carta con logotipo institucional**.

**Rationale**: Un ERP debe responder a la realidad física y operativa del almacén, aduana y planta de DIREMOR S.R.L., no comportarse como un paquete genérico desligado del negocio.

---

### IX. Verificación de Comportamiento en Vivo (NO NEGOCIABLE)

Complementa el Principio V. Toda funcionalidad con interfaz de usuario o impacto transaccional se valida en un entorno real antes de considerarse terminada.

- **Self-Test de Extremo a Extremo (E2E):** El implementador ejecuta el flujo completo tal como lo haría un usuario (por ejemplo: abrir turno de caja $\rightarrow$ buscar cliente $\rightarrow$ escanear ítem por serie $\rightarrow$ cobrar en efectivo $\rightarrow$ verificar emisión de factura con QR $\rightarrow$ comprobar el débito contable y el descuento en kardex).
- **Validación del Camino Infeliz (Negative Path):** Obligatoriedad de probar condiciones límite y excepciones (intento de venta con stock insuficiente, cliente con mora excedida, desconexión del servicio fiscal, corte de conexión en medio de un cobro) comprobando que el sistema degrada limpiamente con mensajes comprensibles y sin corrupción de datos.
- **Simulación en Local y Staging en Coolify:** Las pruebas se ejecutan inicialmente en entornos de desarrollo y se certifican en la instancia de staging desplegada en Coolify antes de promover a producción.

**Rationale**: Los errores en un ERP se manifiestan en la interacción de frontera (cajeros bajo presión, clientes esperando comprobante); solo el ejercicio de los flujos reales garantiza la estabilidad operativa.

---

## Restricciones de Plataforma y Seguridad en Coolify

1. **Gestión Segura de Secretos:** Los secretos de producción solo residen en el panel de Coolify como variables de entorno seguras. Ningún `.env` con secretos reales se versiona en Git.
2. **Cero Exposición de Base de Datos:** PostgreSQL solo atiende peticiones en el socket o puerto TCP interno dentro de `coolify-network`.
3. **Healthchecks Obligatorios:** Todo servicio desplegado expone un endpoint `/api/health` para que Coolify orqueste reinicios automáticos y monitoreo de disponibilidad.
4. **Respaldos Automatizados a S3:** Respaldo lógico diario programado desde Coolify hacia almacenamiento de objetos S3 cifrado.

---

## Gobernanza y Enmiendas

Esta constitución es la norma suprema que rige la ingeniería de software de DIREMOR SAC. Cualquier desviación detectada en un Plan Técnico o Pull Request requiere corrección inmediata o una enmienda formal motivada por escrito.

- **MAJOR (vX.0.0):** Cambio estructural en los principios fundacionales (ej. reemplazo de la arquitectura base o cambio de gestor de base de datos).
- **MINOR (vx.X.0):** Incorporación de un nuevo módulo o principio regulatorio fiscal adicional.
- **PATCH (vx.x.X):** Aclaraciones y correcciones de estilo sin alteración semántica.

**Version**: 2.0.0 | **Ratified**: 23 de septiembre de 2026 | **Aprobado para**: DIREMOR S.R.L. & Grupo SP
