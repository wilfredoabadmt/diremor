# Data Model: 002-productos-kardex

## Entidades y Relaciones

```mermaid
erDiagram
    CATEGORIA_PRODUCTO ||--o{ PRODUCTO : clasifica
    ALMACEN ||--o{ KARDEX_MOVIMIENTOS : almacena
    PRODUCTO ||--o{ KARDEX_MOVIMIENTOS : registra
    SUCURSAL ||--o{ ALMACEN : pertenece

    CATEGORIA_PRODUCTO {
        int id_categoria PK
        varchar codigo UK
        varchar nombre
        text descripcion
    }

    PRODUCTO {
        varchar codigo_producto PK
        int id_categoria FK
        varchar codigo_fabrica
        varchar descripcion
        varchar unidad_medida
        numeric peso_kg
        numeric precio_costo
        numeric precio_venta_base
        numeric precio_venta_mayorista
        numeric stock_minimo
        numeric stock_maximo
        boolean maneja_serie
        boolean maneja_lote
        text url_imagen
        boolean activo
    }

    KARDEX_MOVIMIENTOS {
        bigint id_kardex PK
        int id_almacen FK
        varchar codigo_producto FK
        timestamptz fecha_movimiento
        varchar tipo_movimiento
        bigint id_documento_ref
        numeric cantidad_entrada
        numeric cantidad_salida
        numeric saldo_cantidad
        numeric costo_unitario
        numeric saldo_valorado
        varchar numero_serie
        varchar numero_lote
        date fecha_vencimiento
    }
```

## Reglas de Integridad y Validación
1. `precio_costo >= 0`, `precio_venta_base >= 0`.
2. `saldo_cantidad`: Calculado acumulativamente; para movimientos de salida, si `saldo_cantidad - cantidad_salida < 0`, la transacción aborta con error `Stock insuficiente en almacén`.
3. `costo_unitario`: En compras o entradas manuales se suministra el costo del movimiento; en salidas se toma el costo promedio ponderado vigente (`saldo_valorado / saldo_cantidad`).
