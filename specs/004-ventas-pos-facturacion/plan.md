# Architecture & Implementation Plan: 004-ventas-pos-facturacion

## 1. Resumen Técnico
La feature `004-ventas-pos-facturacion` implementa el núcleo del ciclo de ventas en DIREMOR SAC:
- Validación previa de cliente, mora y saldo crediticio si la venta es a crédito.
- Transacción atómica en PostgreSQL (`BEGIN` ... `COMMIT` / `ROLLBACK`).
- Inserción en `ventas_cabecera`.
- Iteración sobre cada ítem en `ventas_detalle`:
  - Verificación de stock disponible en `almacenes` vía `kardex_movimientos` (último saldo).
  - Verificación de obligatoriedad de número de serie si `productos.maneja_serie = true`.
  - Inserción en `ventas_detalle`.
  - Registro de movimiento en `kardex_movimientos` (`tipo_movimiento = 'VENTA'`).
- Anulación controlada de ventas (`POST /api/ventas/:id/anular`) revirtiendo el stock en Kardex.

---

## 2. Contratos de API (Endpoints)

### 2.1. `POST /api/ventas`
Crea una nueva venta y ejecuta el descargo atómico en Kardex.
- **Roles permitidos**: `ADMIN`, `VENTAS`, `SUPERVISOR`.
- **Headers**: `Authorization: Bearer <token>` o `x-access-token: <token>`.
- **Payload Request**:
```json
{
  "id_cliente": 2,
  "id_almacen_default": 1,
  "tipo_pago": "CONTADO", // "CONTADO" | "CREDITO" | "QR"
  "descuento": 0.00,
  "observaciones": "Despacho inmediato en mostrador",
  "items": [
    {
      "codigo_producto": "TALADRO-BOSCH-619",
      "id_almacen": 1, // opcional, si no viene usa id_almacen_default
      "cantidad": 2,
      "precio_unitario": 450.00,
      "numero_serie": "SN-BOSCH-998811" // obligatorio si producto.maneja_serie
    }
  ]
}
```
- **Response 201 Created**:
```json
{
  "message": "Venta registrada exitosamente.",
  "venta": {
    "id_venta": 1,
    "id_sucursal": 1,
    "id_cliente": 2,
    "total_bruto": 900.00,
    "descuento": 0.00,
    "total_neto": 900.00,
    "tipo_pago": "CONTADO",
    "estado": "EMITIDA",
    "fecha_venta": "2026-09-24T03:30:00.000Z",
    "items_count": 1
  }
}
```

### 2.2. `GET /api/ventas`
Lista ventas con filtros por fecha, cliente y estado.
- **Query Params**: `fecha_desde`, `fecha_hasta`, `id_cliente`, `tipo_pago`, `estado`, `limit`, `offset`.

### 2.3. `GET /api/ventas/:id`
Obtiene la venta cabecera completa, detalles de productos y datos del cliente y sucursal.

### 2.4. `POST /api/ventas/:id/anular`
Anula la venta y genera movimientos de Kardex para restituir el stock al almacén original.
- **Roles permitidos**: `ADMIN`, `SUPERVISOR`.

---

## 3. Principios de Arquitectura SDD aplicados
- **Principio I (ACID y Cero Stock Negativo)**: Una venta que solicita 5 unidades cuando sólo hay 4 genera un `ROLLBACK` inmediato.
- **Principio III (Multi-Sucursal Aislado)**: La sucursal se toma de la sesión JWT del usuario autenticado para evitar fugas entre agencias.
- **Principio VII (Inalterabilidad Contable)**: Una venta emitida nunca se elimina físicamente (`DELETE`). Sólo puede transitar a `ANULADA` dejando huella en auditoría y Kardex.
- **Principio IX (Verificación en Vivo en Coolify)**: Suite E2E ejecutada contra la instancia en contenedor real.
