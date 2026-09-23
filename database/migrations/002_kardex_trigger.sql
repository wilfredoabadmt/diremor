-- =====================================================================
-- DIREMOR SAC - Trigger Transaccional de Kardex (PostgreSQL 16+)
-- Versión: 002_kardex_trigger.sql
-- Cumple con: Principio I (Consistencia Transaccional ACID)
-- =====================================================================

CREATE OR REPLACE FUNCTION fn_descontar_kardex_por_venta()
RETURNS TRIGGER AS $$
DECLARE
    v_ultimo_saldo_cant NUMERIC(12,2);
    v_ultimo_costo NUMERIC(14,4);
    v_nuevo_saldo_cant NUMERIC(12,2);
    v_nuevo_saldo_val NUMERIC(16,4);
BEGIN
    -- Bloquear y consultar el último movimiento para el producto en el almacén
    SELECT saldo_cantidad, costo_unitario
    INTO v_ultimo_saldo_cant, v_ultimo_costo
    FROM kardex_movimientos
    WHERE codigo_producto = NEW.codigo_producto AND id_almacen = NEW.id_almacen
    ORDER BY id_kardex DESC
    LIMIT 1
    FOR UPDATE;

    -- Validar existencia previa y disponibilidad de inventario
    IF v_ultimo_saldo_cant IS NULL THEN
        RAISE EXCEPTION 'No existen registros de inventario inicial para el producto % en almacén %',
            NEW.codigo_producto, NEW.id_almacen;
    END IF;

    IF v_ultimo_saldo_cant < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para producto %. Solicitado: %, Disponible: %',
            NEW.codigo_producto, NEW.cantidad, v_ultimo_saldo_cant;
    END IF;

    -- Calcular nuevos saldos
    v_nuevo_saldo_cant := v_ultimo_saldo_cant - NEW.cantidad;
    v_nuevo_saldo_val := v_nuevo_saldo_cant * v_ultimo_costo;

    -- Insertar movimiento atómico de salida por venta
    INSERT INTO kardex_movimientos (
        id_almacen,
        codigo_producto,
        tipo_movimiento,
        id_documento_ref,
        cantidad_entrada,
        cantidad_salida,
        saldo_cantidad,
        costo_unitario,
        saldo_valorado,
        numero_serie,
        numero_lote
    ) VALUES (
        NEW.id_almacen,
        NEW.codigo_producto,
        'VENTA',
        NEW.id_venta,
        0.00,
        NEW.cantidad,
        v_nuevo_saldo_cant,
        v_ultimo_costo,
        v_nuevo_saldo_val,
        NEW.numero_serie,
        NEW.numero_lote
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Asignar el disparador después de insertar cada ítem en ventas_detalle
DROP TRIGGER IF EXISTS trg_descontar_kardex_venta ON ventas_detalle;
CREATE TRIGGER trg_descontar_kardex_venta
AFTER INSERT ON ventas_detalle
FOR EACH ROW
EXECUTE FUNCTION fn_descontar_kardex_por_venta();
