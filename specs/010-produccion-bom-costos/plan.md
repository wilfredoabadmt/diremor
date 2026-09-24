# Technical Plan: 010-produccion-bom-costos

## Architecture & Design Decisions

### 1. Modelo de Datos DDL (PostgreSQL 16+)
- **Migración**: `database/migrations/007_produccion_bom_schema.sql`
- **Tablas**:
  - `produccion_recetas_cabecera`:
    - `id_receta BIGINT PRIMARY KEY`
    - `codigo_producto_pt VARCHAR(30) REFERENCES productos`
    - `nombre_receta VARCHAR(150)`
    - `descripcion TEXT`
    - `rendimiento_base NUMERIC(12,2) DEFAULT 1.00`
    - `activa BOOLEAN DEFAULT TRUE`
  - `produccion_recetas_detalle`:
    - `id_receta_detalle BIGINT PRIMARY KEY`
    - `id_receta BIGINT REFERENCES produccion_recetas_cabecera`
    - `codigo_insumo VARCHAR(30) REFERENCES productos`
    - `cantidad_requerida NUMERIC(12,4)`
    - `merma_permitida_pct NUMERIC(5,2) DEFAULT 0.00`
  - `produccion_ordenes`:
    - `id_orden BIGINT PRIMARY KEY`
    - `numero_orden VARCHAR(50) UNIQUE`
    - `id_receta BIGINT REFERENCES produccion_recetas_cabecera`
    - `codigo_producto_pt VARCHAR(30) REFERENCES productos`
    - `id_sucursal INT REFERENCES sucursales`
    - `id_almacen_insumos INT REFERENCES almacenes`
    - `id_almacen_pt INT REFERENCES almacenes`
    - `cantidad_planificada NUMERIC(12,2)`
    - `cantidad_producida NUMERIC(12,2) DEFAULT 0.00`
    - `estado VARCHAR(20) DEFAULT 'PLANIFICADA'` ('PLANIFICADA', 'EN_PROCESO', 'FINALIZADA', 'CANCELADA')
    - `costo_total_mp NUMERIC(14,4) DEFAULT 0.0000`
    - `costo_total_mod NUMERIC(14,4) DEFAULT 0.0000`
    - `costo_total_cif NUMERIC(14,4) DEFAULT 0.0000`
    - `costo_total_fabricacion NUMERIC(14,4) DEFAULT 0.0000`
    - `costo_unitario_pt NUMERIC(14,4) DEFAULT 0.0000`
    - `fecha_inicio TIMESTAMPTZ`, `fecha_fin TIMESTAMPTZ`
    - `observaciones TEXT`
  - `produccion_consumos_mp`:
    - `id_consumo BIGINT PRIMARY KEY`
    - `id_orden BIGINT REFERENCES produccion_ordenes`
    - `codigo_insumo VARCHAR(30) REFERENCES productos`
    - `cantidad_consumida NUMERIC(12,4)`
    - `costo_unitario NUMERIC(14,4)`
    - `subtotal_valorado NUMERIC(14,4)`
  - `produccion_costos_adicionales`:
    - `id_costo_adicional BIGINT PRIMARY KEY`
    - `id_orden BIGINT REFERENCES produccion_ordenes`
    - `tipo_costo VARCHAR(10)` ('MOD', 'CIF')
    - `descripcion VARCHAR(150)`
    - `horas_hombre NUMERIC(8,2) DEFAULT 0.00`
    - `tarifa_hora NUMERIC(10,2) DEFAULT 0.00`
    - `monto_total NUMERIC(14,2)`

---

### 2. Algoritmo de Absorción y Hoja de Costos
1. **Consumo de Materia Prima (MP)**:
   - Para cada insumo a consumir:
     - Bloquea último movimiento de Kardex en almacén de insumos `FOR UPDATE`.
     - Verifica disponibilidad de stock (`saldo_cantidad >= cantidad_consumida`).
     - Descuenta del Kardex (`PRODUCCION_SALIDA`) al costo promedio vigente.
     - Inserta en `produccion_consumos_mp`.
     - Suma a `produccion_ordenes.costo_total_mp`.
2. **Mano de Obra Directa (MOD) y CIF**:
   - `monto = horas_hombre * tarifa_hora` (para MOD) o monto fijo para CIF.
   - Inserta en `produccion_costos_adicionales`.
   - Acumula en `produccion_ordenes.costo_total_mod` y `costo_total_cif`.
3. **Liquidación y Cierre de Orden**:
   - $\text{Costo Total} = \text{costo\_total\_mp} + \text{costo\_total\_mod} + \text{costo\_total\_cif}$.
   - $\text{Costo Unitario PT} = \text{Costo Total} / \text{cantidad\_producida}$.
   - Ingresa en Kardex de producto terminado (`PRODUCCION_ENTRADA`) con cantidad producida y costo unitario liquidado.
   - Recalcula costo ponderado en `productos.precio_costo`.
   - Marca orden como `FINALIZADA`.

---

### 3. Endpoints Diseñados
- `POST /api/produccion/recetas`: Crear receta BOM con insumos y mermas
- `GET /api/produccion/recetas`: Listar recetas activas
- `GET /api/produccion/recetas/:id`: Detalle de receta con insumos
- `POST /api/produccion/ordenes`: Emitir orden de producción
- `GET /api/produccion/ordenes`: Listar órdenes con filtros de estado
- `GET /api/produccion/ordenes/:id`: Hoja de costos y detalle de orden
- `POST /api/produccion/ordenes/:id/consumir-mp`: Consumir insumos y asentar salida en Kardex
- `POST /api/produccion/ordenes/:id/imputar-costos`: Registrar MOD o CIF
- `POST /api/produccion/ordenes/:id/finalizar`: Liquidar orden e ingresar PT a Kardex

---

### 4. Plan de Verificación E2E en Vivo (`scratch/test_live_010.js`)
1. **Setup de Insumos y PT**:
   - Insumo 1: `ACERO-PLANCHA-${ts}` (Stock: 20 pzas a 50 Bs c/u).
   - Insumo 2: `SOLDADURA-KG-${ts}` (Stock: 10 kg a 25 Bs c/u).
   - Producto Terminado: `ESTRUCTURA-SOPORTE-${ts}` (Stock inicial: 0).
2. **Creación de Receta BOM**:
   - 2 planchas de acero + 1 kg soldadura por estructura.
3. **Emisión de Orden de Producción**:
   - Orden para fabricar 5 estructuras en Almacén 1.
4. **Consumo de Materia Prima (MP)**:
   - Consumir 10 planchas (10 * 50 = 500 Bs) y 5 kg soldadura (5 * 25 = 125 Bs) = Total MP: 625 Bs.
   - Verificar descargo en Kardex de ambos insumos.
5. **Imputación de Mano de Obra (MOD) y CIF**:
   - Imputar MOD: 10 horas hombre a 30 Bs/h = 300 Bs.
   - Imputar CIF: Electricidad y desgaste = 75 Bs.
   - Total Fabricación = 625 (MP) + 300 (MOD) + 75 (CIF) = 1,000 Bs.
6. **Liquidación y Cierre de Orden**:
   - Finalizar con 5 estructuras producidas.
   - Costo Unitario PT liquidado = 1,000 / 5 = 200 Bs por estructura.
   - Verificar stock de PT en Kardex (+5 unidades a 200 Bs c/u).
   - Verificar `productos.precio_costo = 200.00`.
7. **Caminos Infelices**:
   - Consumo de insumo con stock insuficiente (400).
   - Re-finalización de orden cerrada (409).
   - Finalización con cantidad producida <= 0 (400).
