# Technical Plan: 002-productos-kardex

**Feature**: Catálogo de Productos, Multialmacén y Kardex Valorado  
**Branch**: `main`  
**Deploy Platform**: Coolify PaaS (PostgreSQL 16 en red interna Docker)

---

## 1. Arquitectura Técnica y Estrategia

### Capa de Controladores y Rutas:
- `src/routes/productos.ts`:
  - `GET /api/productos/categorias` — Listado de categorías registradas.
  - `POST /api/productos/categorias` — Creación de nuevas categorías.
  - `GET /api/productos` — Listado paginado con búsqueda por término (`codigo_producto`, `codigo_fabrica`, `descripcion`).
  - `POST /api/productos` — Creación de nuevo producto con validación de tipos y esquema.
  - `GET /api/productos/:codigo` — Obtener ficha técnica completa.
  - `PUT /api/productos/:codigo` — Actualización de producto.
  - `GET /api/productos/:codigo/stock` — Consulta de stock consolidado y por almacén.
- `src/routes/kardex.ts`:
  - `POST /api/kardex/movimientos` — Registro de entrada/salida/ajuste en Kardex con transacción ACID.
  - `GET /api/kardex/:codigo_producto` — Histórico de movimientos en Kardex físico-valorado.

### Capa de Persistencia y Transacciones:
- Uso directo de transacciones en PostgreSQL (`BEGIN` ... `COMMIT` / `ROLLBACK`) para garantizar que al registrar un movimiento en Kardex:
  1. Se bloquea la fila del último movimiento del producto en el almacén (`SELECT ... FOR UPDATE` o cálculo con `MAX(id_kardex)`).
  2. Se calcula:
     - `nuevo_saldo_cantidad = saldo_anterior + entrada - salida`
     - `nuevo_saldo_valorado = saldo_valorado_anterior + (entrada * costo_unitario) - (salida * costo_unitario)`
  3. Se inserta la fila inmutable en `kardex_movimientos`.

---

## 2. Constitution Check

- **Principio I (Consistencia Transaccional ACID)**: ✅ El cálculo de saldos en Kardex se realiza dentro de una transacción atómica; si el stock es insuficiente para una salida, se ejecuta `ROLLBACK` y se retorna HTTP 400.
- **Principio II (Soberanía y Aislamiento)**: ✅ No se exponen credenciales de BD. Toda la lógica opera dentro del contenedor de la API conectada a PostgreSQL mediante `DATABASE_URL`.
- **Principio III (Multi-Sucursal)**: ✅ Cada almacén pertenece a una `id_sucursal`. Los usuarios con roles limitados consultan stock de su propia sede.
- **Definición de Hecho REFORZADA**: ✅ Verificación E2E en el contenedor desplegado en Coolify.
