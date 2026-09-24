# Architecture & Implementation Plan: 007-cotizaciones-pedidos-reserva

## 1. Diseño del Modelo de Datos DDL
Se define la migración `database/migrations/004_cotizaciones_schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS cotizaciones_cabecera (
    id_cotizacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal INT NOT NULL REFERENCES sucursales(id_sucursal) ON DELETE RESTRICT,
    id_cliente BIGINT NOT NULL REFERENCES clientes(id_cliente) ON DELETE RESTRICT,
    id_usuario BIGINT NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,
    fecha_emision TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    total_bruto NUMERIC(14,2) NOT NULL,
    descuento NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_neto NUMERIC(14,2) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE', -- 'PENDIENTE', 'CONVERTIDA', 'VENCIDA', 'RECHAZADA'
    id_venta_generada BIGINT REFERENCES ventas_cabecera(id_venta) ON DELETE SET NULL,
    observaciones TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON cotizaciones_cabecera(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON cotizaciones_cabecera(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_vencimiento ON cotizaciones_cabecera(fecha_vencimiento);

CREATE TABLE IF NOT EXISTS cotizaciones_detalle (
    id_detalle BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones_cabecera(id_cotizacion) ON DELETE CASCADE,
    codigo_producto VARCHAR(30) NOT NULL REFERENCES productos(codigo_producto) ON DELETE RESTRICT,
    cantidad NUMERIC(12,2) NOT NULL,
    precio_unitario NUMERIC(14,4) NOT NULL,
    subtotal NUMERIC(14,2) NOT NULL,
    CONSTRAINT chk_cotizacion_cantidad CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_det_cotiz ON cotizaciones_detalle(id_cotizacion);
```

---

## 2. Contratos de API (Endpoints)

### 2.1. `POST /api/cotizaciones`
- **Request**:
```json
{
  "id_cliente": 2,
  "dias_validez": 15,
  "descuento": 50.00,
  "observaciones": "Cotización para obra Equipetrol",
  "items": [
    {
      "codigo_producto": "TALADRO-BOSCH-619",
      "cantidad": 5,
      "precio_unitario": 420.00
    }
  ]
}
```

### 2.2. `GET /api/cotizaciones` y `GET /api/cotizaciones/:id`
- Consulta lista o detalle completo con cliente, sucursal, productos y estado de vigencia calculado (`esta_vencida: boolean`).

### 2.3. `POST /api/cotizaciones/:id/convertir-a-venta`
- Convierte la cotización en Venta POS de forma atómica:
  - Invoca la creación en `ventas_cabecera` y `ventas_detalle`.
  - El trigger de PostgreSQL `trg_descontar_kardex_venta` descuenta inventario en Kardex.
  - Actualiza la cotización a `estado = 'CONVERTIDA'` y enlaza `id_venta_generada`.
- **Request**:
```json
{
  "id_almacen": 1,
  "tipo_pago": "CONTADO" // o "CREDITO" o "QR"
}
```

### 2.4. `POST /api/cotizaciones/:id/rechazar`
- Marca la cotización como `RECHAZADA`.

---

## 3. Principios SDD Aplicados
- **Consistencia Transaccional (Principio I)**: La conversión de cotización a venta se realiza bajo una transacción ACID. Si no hay stock suficiente para algún producto al momento de convertir, se aborta con `ROLLBACK` y la cotización permanece `PENDIENTE`.
- **Gobernanza de Precios (Principio II)**: Si la cotización caducó, se exige renovación de presupuesto.
- **Verificación en Vivo en Coolify (Principio IX)**: Suite E2E completa en `scratch/test_live_007.js`.
