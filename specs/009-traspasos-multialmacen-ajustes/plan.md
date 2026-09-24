# Technical Plan: 009-traspasos-multialmacen-ajustes

## Architecture & Design Decisions

### 1. Modelo de Datos DDL (PostgreSQL 16+)
- **Migración**: `database/migrations/006_traspasos_ajustes_schema.sql`
- **Tablas**:
  - `traspasos_cabecera`:
    - `id_traspaso BIGINT PRIMARY KEY`
    - `id_sucursal_origen INT`, `id_almacen_origen INT`
    - `id_sucursal_destino INT`, `id_almacen_destino INT`
    - `id_usuario_envio BIGINT`, `id_usuario_recepcion BIGINT`
    - `estado VARCHAR(20) DEFAULT 'EN_TRANSITO'`
    - `fecha_envio TIMESTAMPTZ`, `fecha_recepcion TIMESTAMPTZ`
    - `motivo TEXT`, `observaciones TEXT`
  - `traspasos_detalle`:
    - `id_traspaso_detalle BIGINT PRIMARY KEY`
    - `id_traspaso BIGINT REFERENCES traspasos_cabecera`
    - `codigo_producto VARCHAR(30) REFERENCES productos`
    - `cantidad NUMERIC(12,2)`
    - `costo_unitario NUMERIC(14,4)`
    - `numero_serie VARCHAR(50)`, `numero_lote VARCHAR(50)`
  - `ajustes_cabecera`:
    - `id_ajuste BIGINT PRIMARY KEY`
    - `id_sucursal INT`, `id_almacen INT`, `id_usuario BIGINT`
    - `tipo_ajuste VARCHAR(25)`
    - `motivo TEXT NOT NULL`
    - `fecha_ajuste TIMESTAMPTZ`
  - `ajustes_detalle`:
    - `id_ajuste_detalle BIGINT PRIMARY KEY`
    - `id_ajuste BIGINT REFERENCES ajustes_cabecera`
    - `codigo_producto VARCHAR(30) REFERENCES productos`
    - `tipo_movimiento VARCHAR(10)` ('ENTRADA', 'SALIDA')
    - `cantidad NUMERIC(12,2)`
    - `costo_unitario NUMERIC(14,4)`
    - `subtotal NUMERIC(14,2)`
    - `numero_serie VARCHAR(50)`, `numero_lote VARCHAR(50)`

---

### 2. Lógica Transaccional de Traspasos y Kardex
1. **Envío (`POST /api/traspasos`)**:
   - Para cada producto en origen:
     ```sql
     SELECT saldo_cantidad, saldo_valorado, costo_unitario 
     FROM kardex_movimientos 
     WHERE codigo_producto = $1 AND id_almacen = $2 
     ORDER BY id_kardex DESC LIMIT 1 FOR UPDATE;
     ```
   - Si `saldo_cantidad < cantidad_traslado`: Aborta con `ROLLBACK` y error HTTP 400.
   - Inserta salida en Kardex:
     - `saldo_cantidad = saldo_anterior - cantidad`
     - `saldo_valorado = saldo_valorado_anterior - (cantidad * costo_unitario)`
     - `tipo_movimiento = 'TRASPASO_SALIDA'`
2. **Recepción (`POST /api/traspasos/:id/recibir`)**:
   - Bloquea traspaso `WHERE id_traspaso = $1 FOR UPDATE`.
   - Si estado != 'EN_TRANSITO', aborta con HTTP 409.
   - Para cada ítem del detalle:
     - Consulta último saldo en destino `FOR UPDATE`.
     - Inserta entrada en Kardex destino:
       - `saldo_cantidad = saldo_anterior + cantidad`
       - `saldo_valorado = saldo_valorado_anterior + (cantidad * costo_unitario)`
       - `costo_unitario = saldo_valorado / saldo_cantidad`
       - `tipo_movimiento = 'TRASPASO_ENTRADA'`
   - Actualiza estado a `'RECIBIDO'` y marca `fecha_recepcion = CURRENT_TIMESTAMP`.

---

### 3. Lógica Transaccional de Ajustes de Inventario
- Para cada ítem en el ajuste:
  - Si `ENTRADA` (sobrante / toma física positiva):
    - Incrementa stock físico y valorado en Kardex (`AJUSTE_ENTRADA`).
  - Si `SALIDA` (merma / rotura / faltante):
    - Valida existencia previa de saldo suficiente `FOR UPDATE`.
    - Disminuye stock físico y valorado en Kardex (`AJUSTE_SALIDA`).

---

### 4. Endpoints Diseñados
- `POST /api/traspasos`: Despachar nuevo traspaso
- `GET /api/traspasos`: Listar traspasos con filtros de estado y almacén
- `GET /api/traspasos/:id`: Detalle completo con ítems y trazabilidad
- `POST /api/traspasos/:id/recibir`: Confirmar recepción física en destino
- `POST /api/traspasos/:id/rechazar`: Rechazar traspaso y devolver a origen
- `POST /api/ajustes`: Registrar ajuste de inventario (mermas/sobrantes/faltantes)
- `GET /api/ajustes`: Listar ajustes de inventario
- `GET /api/ajustes/:id`: Detalle completo de ajuste

---

### 5. Plan de Verificación E2E en Vivo (`scratch/test_live_009.js`)
1. **Despacho de Traspaso**: Crear producto con stock en Almacén Central (10 unidades) y transferir 4 unidades a Almacén Secundario.
2. **Verificación de Tránsito**: Origen tiene 6 unidades, Destino tiene 0 unidades, Traspaso está `EN_TRANSITO`.
3. **Recepción en Destino**: Confirmar recepción física. Destino pasa a tener 4 unidades, Traspaso pasa a `RECIBIDO`.
4. **Camino Infeliz Traspaso**: Intento de re-recibir traspaso cerrado (409 Conflict), traspaso con almacén origen y destino iguales (400), traspaso con stock insuficiente (400).
5. **Ajuste de Inventario por Sobrante**: Registrar ajuste positivo de 3 unidades, verificar aumento en Kardex.
6. **Ajuste de Inventario por Merma/Rotura**: Registrar ajuste negativo de 2 unidades, verificar descargo en Kardex.
7. **Camino Infeliz Ajuste**: Ajuste de salida superior al stock existente (400 Bad Request).
