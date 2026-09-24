# Feature Specification: 002-productos-kardex

**Feature Name**: Catálogo de Productos, Multialmacén y Kardex Valorado  
**Target Milestone**: DIREMOR SAC v1.1.0  
**Related SDD Sections**: 3.3 (Inventarios, Multialmacenes y Trazabilidad), 4.2 (ERD), 4.3 (DDL)

---

## 1. Contexto y Justificación del Negocio

DIREMOR S.R.L. requiere gestionar un catálogo unificado de artículos e insumos industriales/comerciales distribuidos en múltiples almacenes (Almacén Central Santa Cruz, Almacén Cochabamba, etc.).
Para garantizar la exactitud de los costos y la disponibilidad en los Puntos de Venta (POS), cada producto debe contar con precios base y mayoristas, alertas de stock mínimo y registro fidedigno en el Kardex físico-valorado (Principio I: Consistencia ACID e integridad transaccional).

---

## 2. Historias de Usuario

### User Story 1 (P1): Catálogo de Categorías y Productos
**Como** Administrador o Encargado de Bodega  
**Quiero** registrar y consultar categorías y productos con sus datos técnicos y comerciales (código, descripción, precios, unidad de medida, foto)  
**Para** mantener un inventario ordenado y disponible para cotizaciones y ventas.

#### Criterios de Aceptación:
- `POST /api/productos`: Crea un producto validando que el `codigo_producto` sea único y que la categoría exista (`HTTP 201`).
- `GET /api/productos`: Lista productos con soporte de búsqueda (`?q=term`), filtrado por categoría (`?categoria_id=X`) y paginación.
- `GET /api/productos/:codigo`: Retorna el detalle completo de un producto con sus categorías y umbrales de stock.
- `PUT /api/productos/:codigo`: Permite actualizar descripción, precios y umbrales de stock (`HTTP 200`).
- Validación de que `precio_costo >= 0` y `precio_venta_base >= 0`.

---

### User Story 2 (P1): Existencias Consolidadas y Multialmacén
**Como** Vendedor o Cajero POS  
**Quiero** consultar el stock disponible de un producto en un almacén específico o en todas las sucursales  
**Para** saber si tengo mercadería para despachar inmediatamente o sugerir un traspaso.

#### Criterios de Aceptación:
- `GET /api/productos/:codigo/stock`: Devuelve el stock actual desglosado por almacén (`id_almacen`, `almacen_nombre`, `sucursal_nombre`, `saldo_cantidad`, `stock_minimo`, `alerta_stock_bajo: boolean`).
- Si `saldo_cantidad <= stock_minimo`, `alerta_stock_bajo` es `true`.

---

### User Story 3 (P1): Registro y Consulta de Movimientos de Kardex
**Como** Encargado de Inventarios  
**Quiero** registrar ingresos iniciales, ajustes manuales por inventario físico y consultar el kardex cronológico  
**Para** auditar las variaciones de mercadería y su valorización contable.

#### Criterios de Aceptación:
- `POST /api/kardex/movimientos`: Registra un movimiento de entrada o salida manual (`AJUSTE_ENTRADA`, `AJUSTE_SALIDA`) calculando de forma atómica el nuevo `saldo_cantidad` y `saldo_valorado`.
- `GET /api/kardex/:codigo_producto`: Devuelve los movimientos históricos filtrables por `id_almacen`, ordenados cronológicamente.
- Las salidas no pueden dejar el saldo físico en negativo si el almacén no permite sobregiro.

---

### User Story 4 (P2): Trazabilidad de Números de Serie y Lotes
**Como** Responsable de Garantías y Calidad  
**Quiero** registrar el número de serie de productos que lo requieran y lotes con fecha de vencimiento  
**Para** atender reclamos de garantía y evitar el despacho de artículos vencidos.

#### Criterios de Aceptación:
- Si `producto.maneja_serie = true`, el movimiento de Kardex exige un `numero_serie` válido.
- Si `producto.maneja_lote = true`, el movimiento exige `numero_lote` y `fecha_vencimiento`.

---

## 3. Requerimientos No Funcionales

1. **Aislamiento Multi-Sucursal**: Toda consulta de stock y almacenes respeta el scope del usuario autenticado si su rol es restringido.
2. **Tiempo de Respuesta**: Tiempos de respuesta para listado y búsqueda de catálogo inferiores a 100ms.
3. **Integridad de Datos**: Restricciones de llave foránea `ON DELETE RESTRICT` para evitar que productos con movimientos en Kardex sean eliminados físicamente.
