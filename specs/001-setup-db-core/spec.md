# Feature Specification: 001-setup-db-core

**Feature Branch**: `001-setup-db-core`  
**Created**: 2026-09-23  
**Status**: Draft  
**Target Platform**: Coolify PaaS (Docker + Traefik + PostgreSQL 16+)  
**Input**: Especificación del núcleo del sistema SAC para DIREMOR S.R.L., según la Constitución ratificada (v2.0.0) y el Documento de Diseño de Software (SDD v2.0).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Autenticación Segura y Acceso Operativo por Sucursal (Priority: P1)

Como usuario operativo de DIREMOR S.R.L. (cajero, vendedor, almacenista, contador o administrador), quiero autenticarme mediante credenciales seguras y acceder al sistema con el contexto específico de mi sucursal y rol asignado, para registrar transacciones respetando los límites de seguridad corporativa.

**Why this priority**: Es la puerta de entrada indispensable para cualquier operación del sistema SAC. Sin identidad verificada, contexto de sucursal y control de roles (RBAC), ninguna transacción puede ejecutarse de forma auditable.

**Independent Test**: Puede probarse de forma independiente registrando usuarios de prueba con roles diferenciados (`ADMIN`, `VENTAS_POS`, `ALMACEN`, `CONTABILIDAD`) asignados a la Sucursal Central (Santa Cruz) y verificando la emisión de tokens JWT seguros con permisos y restricciones correspondientes.

**Acceptance Scenarios**:
1. **Given** un usuario registrado con rol `VENTAS_POS` asignado a la sucursal "Santa Cruz", **When** ingresa credenciales válidas, **Then** el sistema retorna un token JWT válido con claim de sucursal y rol, permitiéndole operar las interfaces de ventas de esa sede.
2. **Given** un usuario con rol `VENTAS_POS`, **When** intenta acceder a un endpoint restringido de configuración contable o auditoría global, **Then** el sistema rechaza la petición con código HTTP 403 Forbidden.
3. **Given** un usuario con credenciales incorrectas o usuario inactivo, **When** intenta iniciar sesión, **Then** el sistema deniega el acceso sin revelar si el error fue de usuario o contraseña, registrando el intento fallido.

---

### User Story 2 - Administración de Sucursales, Almacenes y Dosificación Fiscal SIN (Priority: P1)

Como Administrador del Sistema, quiero dar de alta y parametrizar las sucursales de DIREMOR S.R.L. (Casa Matriz y agencias departamentales), asociándoles sus respectivos almacenes físicos y sus credenciales de dosificación del Servicio de Impuestos Nacionales (SIN), para permitir la emisión fiscal y el control logístico descentralizado.

**Why this priority**: DIREMOR opera con múltiples sucursales geográficamente dispersas. El modelo debe vincular cada venta y movimiento de inventario a una sucursal y almacén físico unívocos, garantizando el cumplimiento de la RND 102100000011 del SIN.

**Independent Test**: Creación de dos sucursales ("Casa Matriz - Santa Cruz" y "Sucursal Cochabamba") con sus respectivos almacenes y puntos de venta SIN; verificación de que las consultas segreguen adecuadamente el stock y la facturación por sede.

**Acceptance Scenarios**:
1. **Given** la necesidad de abrir una nueva sucursal, **When** el administrador registra los datos generales, dirección, almacén principal y parámetros fiscales SIN, **Then** la sucursal queda habilitada para que los operadores asignados emitan facturas y gestionen existencias.
2. **Given** una sucursal activa, **When** se consulta el maestro de almacenes, **Then** el sistema presenta únicamente los almacenes y bodegas legalmente vinculados a esa sede física.

---

### User Story 3 - Esquema Relacional PostgreSQL 16+ con Integridad Transaccional ACID (Priority: P1)

Como Arquitecto de Software y Administrador de Datos, quiero disponer del esquema de base de datos relacional inicial en PostgreSQL 16+ con llaves foráneas estrictas, índices optimizados y funciones PL/pgSQL transaccionales, para asegurar la atomicidad y consistencia en la persistencia de las operaciones.

**Why this priority**: La Constitución (Principio I) exige atomicidad transaccional indivisible (Venta $\rightarrow$ Factura SIN $\rightarrow$ Kardex $\rightarrow$ Cartera $\rightarrow$ Contabilidad). El motor PostgreSQL debe estructurarse desde el día uno con los tipos de datos exactos, restricciones y aislamiento MVCC.

**Independent Test**: Ejecución del script de migración DDL en el servicio de PostgreSQL de Coolify, verificando la creación limpia de tablas, índices y funciones triggers sin dependencias circulares.

**Acceptance Scenarios**:
1. **Given** una instancia limpia de PostgreSQL 16+ en la red interna de Coolify, **When** se ejecutan las migraciones iniciales, **Then** todas las tablas del núcleo (`sucursales`, `usuarios`, `roles`, `almacenes`, `clientes`, `productos`, `kardex_movimientos`, `ventas_cabecera`, `facturas_fiscales`) se crean con sus índices y llaves foráneas activas.
2. **Given** un intento de inserción de una transacción de venta con una sucursal o cliente inexistente, **When** se procesa la consulta, **Then** la base de datos aborta la transacción vía constraint referencial (`FOREIGN KEY VIOLATION`), garantizando cero registros huérfanos.

---

### User Story 4 - Endpoint de Salud y Monitoreo para Coolify (Priority: P2)

Como Ingeniero de Operaciones (DevOps), quiero disponer de un endpoint `/api/health` que audite el estado del servicio y la conectividad activa con PostgreSQL 16+, para que el orquestador de Coolify y Traefik puedan supervisar la salud del contenedor y reiniciar automáticamente ante anomalías.

**Why this priority**: Requerimiento constitucional no negociable para garantizar alta disponibilidad (99.8%) y resiliencia en la plataforma self-hosted.

**Independent Test**: Realización de peticiones HTTP GET a `/api/health` con la base de datos encendida (retorno 200 OK con métricas) y simulación de desconexión de base de datos (retorno 503 Service Unavailable).

**Acceptance Scenarios**:
1. **Given** el backend y PostgreSQL operando con normalidad, **When** Traefik consulta `GET /api/health`, **Then** recibe código HTTP 200 con payload JSON `{"status": "healthy", "database": "connected", "timestamp": "..."}`.
2. **Given** una interrupción transitoria en la base de datos, **When** se consulta `GET /api/health`, **Then** recibe código HTTP 503 con diagnóstico de falla, alertando al orquestador para ejecutar la política de recuperación.

---

### Edge Cases

- **Interrupción de red durante el handshake de autenticación**: El cliente debe recibir un error de timeout limpio sin dejar sesiones colgadas ni consumir pools de conexión en PostgreSQL.
- **Concurrencia de inicio de sesión con múltiples sucursales**: Usuarios de diferentes ciudades autenticándose simultáneamente no deben colisionar en tokens ni mezclar scopes de sucursal.
- **Inyección SQL o caracteres especiales en credenciales o identificadores**: Los inputs deben ser sanitizados y validados estrictamente mediante consultas parametrizadas en la capa de persistencia.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE autenticar a los usuarios mediante credenciales encriptadas con algoritmo hash resistente (Argon2id o bcrypt) y emitir tokens JWT firmados con expiración máxima configurable.
- **FR-002**: Toda petición a la API backend DEBE validar la validez del token JWT y el rol del usuario antes de otorgar acceso a los recursos.
- **FR-003**: Cada usuario DEBE tener asignada al menos una sucursal operativa por defecto, la cual condicionará el alcance de sus operaciones en puntos de venta y almacenes.
- **FR-004**: El sistema DEBE mantener el catálogo de sucursales con soporte para múltiples almacenes (Almacén Central, Ventas, Cuarentena, Merma).
- **FR-005**: El esquema de base de datos DEBE implementarse en PostgreSQL 16+ utilizando tipos de datos precisos (`BIGINT GENERATED ALWAYS AS IDENTITY`, `NUMERIC(14,2)`, `TIMESTAMPTZ`, `JSONB` y `BOOLEAN`).
- **FR-006**: La base de datos DEBE residir exclusivamente en la red interna de Docker (`coolify-network`), sin exponer el puerto 5432 al exterior.
- **FR-007**: El sistema DEBE exponer el endpoint `/api/health` para verificaciones de disponibilidad en Coolify y Traefik.
- **FR-008**: Se DEBE proveer un mecanismo automatizado de migraciones DDL ejecutable en la fase de Pre-Deployment de Coolify.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Las migraciones completas del esquema core en PostgreSQL 16+ se ejecutan en menos de 5 segundos sin errores de sintaxis ni bloqueos.
- **SC-002**: El tiempo de respuesta del endpoint de autenticación `/api/auth/login` es inferior a 200 milisegundos bajo carga concurrente de 50 peticiones simultáneas.
- **SC-003**: El endpoint `/api/health` responde en menos de 50 milisegundos con verificación real de consulta a PostgreSQL (`SELECT 1`).
- **SC-004**: Cero puertos de base de datos (5432) detectables o expuestos en escaneos hacia la IP pública del servidor Coolify.
- **SC-005**: 100% de cumplimiento con las restricciones de la Constitución de DIREMOR SAC (v2.0.0).

---

## Assumptions

- El servidor host con Coolify PaaS y Docker Engine 24+ ya se encuentra operativo con acceso a la red interna `coolify-network`.
- Se dispone de las variables de entorno mínimas configuradas en Coolify: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`.
- El cliente frontend se comunicará exclusivamente a través del proxy inverso Traefik con TLS 1.3 activo.
