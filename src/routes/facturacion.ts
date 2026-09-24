import { Router, Response } from 'express';
import { pool, query } from '../db.js';
import { authenticateToken, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { generarCUF, generarCadenaQRFiscal } from '../utils/sinFiscal.js';

export const facturacionRouter = Router();

// Todas las rutas de facturación requieren autenticación JWT
facturacionRouter.use(authenticateToken);

const NIT_EMISOR_DIREMOR = process.env.NIT_EMISOR || '1020304050';

// =====================================================================
// POST /api/facturas - Emitir Factura Fiscal para una venta
// =====================================================================
facturacionRouter.post('/', requireRole('ADMIN', 'VENTAS', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { id_venta, codigo_punto_venta = 0 } = req.body;

  if (!id_venta) {
    res.status(400).json({ error: 'Debe especificar el id_venta a facturar.' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Obtener y bloquear venta
    const vRes = await client.query(
      `SELECT 
        v.id_venta,
        v.id_sucursal,
        v.id_cliente,
        v.total_neto,
        v.total_bruto,
        v.descuento,
        v.estado,
        c.razon_social as cliente_nombre,
        c.nit_ci as cliente_nit,
        c.tipo_documento as cliente_tipo_doc,
        s.nombre as sucursal_nombre
      FROM ventas_cabecera v
      JOIN clientes c ON v.id_cliente = c.id_cliente
      JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      WHERE v.id_venta = $1
      FOR UPDATE`,
      [id_venta]
    );

    if (vRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }

    const venta = vRes.rows[0];

    if (venta.estado === 'ANULADA') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No se puede facturar una venta anulada.' });
      return;
    }

    // 2. Verificar que la venta no haya sido facturada previamente
    const prevFactura = await client.query(
      'SELECT id_factura, numero_factura, cuf, estado_sin FROM facturas_fiscales WHERE id_venta = $1',
      [id_venta]
    );

    if (prevFactura.rows.length > 0) {
      await client.query('ROLLBACK');
      const f = prevFactura.rows[0];
      res.status(409).json({
        error: `Esta venta ya cuenta con la factura fiscal Nro ${f.numero_factura} (Estado: ${f.estado_sin}).`,
        id_factura: f.id_factura,
        numero_factura: f.numero_factura,
        cuf: f.cuf
      });
      return;
    }

    // 3. Obtener o inicializar dosificación y CUFD vigente
    let dosifRes = await client.query(
      'SELECT cufd_vigente, codigo_control_vigente FROM dosificaciones_sin WHERE id_sucursal = $1 AND codigo_punto_venta = $2 AND activo = TRUE LIMIT 1',
      [venta.id_sucursal, codigo_punto_venta]
    );

    let cufd = dosifRes.rows[0]?.cufd_vigente;
    let codControl = dosifRes.rows[0]?.codigo_control_vigente || null;

    if (!cufd) {
      cufd = `CUFD_AUTO_${venta.id_sucursal}_PV${codigo_punto_venta}_${Date.now()}`;
      await client.query(
        `INSERT INTO dosificaciones_sin (id_sucursal, modalidad, codigo_punto_venta, cufd_vigente, activo)
         VALUES ($1, 'ELECTRONICA_EN_LINEA', $2, $3, TRUE)
         ON CONFLICT (id_sucursal, codigo_punto_venta) 
         DO UPDATE SET cufd_vigente = EXCLUDED.cufd_vigente, activo = TRUE`,
        [venta.id_sucursal, codigo_punto_venta, cufd]
      );
    }

    // 4. Calcular el siguiente número correlativo de factura para la sucursal
    const corrRes = await client.query(
      `SELECT COALESCE(MAX(f.numero_factura), 0) + 1 as siguiente_numero
       FROM facturas_fiscales f
       JOIN ventas_cabecera v ON f.id_venta = v.id_venta
       WHERE v.id_sucursal = $1`,
      [venta.id_sucursal]
    );
    const numeroFactura = Number(corrRes.rows[0].siguiente_numero);

    // 5. Generar CUF y QR Fiscal
    const fechaEmision = new Date();
    const cuf = generarCUF({
      nitEmisor: NIT_EMISOR_DIREMOR,
      fechaHora: fechaEmision,
      sucursal: venta.id_sucursal,
      modalidad: 1, // Electronica en Linea
      tipoEmision: 1, // Online
      tipoDocumentoFiscal: 1, // Factura estandar
      tipoDocumentoSector: 1,
      numeroFactura,
      puntoVenta: Number(codigo_punto_venta)
    });

    const qrData = generarCadenaQRFiscal({
      nitEmisor: NIT_EMISOR_DIREMOR,
      cuf,
      numeroFactura,
      totalNeto: Number(venta.total_neto)
    });

    // 6. Insertar Factura Fiscal
    const insertFacturaSql = `
      INSERT INTO facturas_fiscales (
        id_venta, numero_factura, cuf, cufd, codigo_control, qr_data, estado_sin, fecha_emision, metadata_sin
      ) VALUES ($1, $2, $3, $4, $5, $6, 'VALIDA', $7, $8)
      RETURNING id_factura, numero_factura, cuf, cufd, qr_data, estado_sin, fecha_emision
    `;

    const metadataSin = {
      emisor_nit: NIT_EMISOR_DIREMOR,
      emisor_razon_social: 'DIREMOR S.R.L.',
      cliente_nit: venta.cliente_nit,
      cliente_razon_social: venta.cliente_nombre,
      punto_venta: codigo_punto_venta,
      usuario_emisor: req.user?.username || 'sistema',
      leyenda_sin: 'Ley N° 453: El proveedor debe brindar atención sin discriminación, con respeto, calidez y cordialidad a los usuarios y consumidores.'
    };

    const facturaResult = await client.query(insertFacturaSql, [
      id_venta,
      numeroFactura,
      cuf,
      cufd,
      codControl,
      qrData,
      fechaEmision,
      JSON.stringify(metadataSin)
    ]);

    await client.query('COMMIT');

    const nuevaFactura = facturaResult.rows[0];

    res.status(201).json({
      message: 'Factura fiscal emitida exitosamente.',
      factura: {
        id_factura: nuevaFactura.id_factura,
        id_venta: Number(id_venta),
        numero_factura: Number(nuevaFactura.numero_factura),
        cuf: nuevaFactura.cuf,
        cufd: nuevaFactura.cufd,
        fecha_emision: nuevaFactura.fecha_emision,
        total_neto: Number(venta.total_neto),
        cliente: {
          razon_social: venta.cliente_nombre,
          nit_ci: venta.cliente_nit,
          tipo_documento: venta.cliente_tipo_doc
        },
        qr_data: nuevaFactura.qr_data,
        estado_sin: nuevaFactura.estado_sin,
        leyenda_tributaria: metadataSin.leyenda_sin
      }
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/facturas]:', error.message);
    res.status(500).json({ error: 'Error interno al emitir la factura fiscal.' });
  } finally {
    client.release();
  }
});

// =====================================================================
// GET /api/facturas - Listar facturas fiscales emitidas
// =====================================================================
facturacionRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { id_sucursal, estado_sin, limit = 50, offset = 0 } = req.query;

  try {
    let sql = `
      SELECT 
        f.id_factura,
        f.id_venta,
        f.numero_factura,
        f.cuf,
        f.cufd,
        f.qr_data,
        f.estado_sin,
        f.fecha_emision,
        v.total_neto,
        v.id_sucursal,
        s.nombre as sucursal_nombre,
        c.razon_social as cliente_nombre,
        c.nit_ci as cliente_nit
      FROM facturas_fiscales f
      JOIN ventas_cabecera v ON f.id_venta = v.id_venta
      JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      JOIN clientes c ON v.id_cliente = c.id_cliente
      WHERE 1=1
    `;
    const params: any[] = [];

    if (id_sucursal) {
      params.push(id_sucursal);
      sql += ` AND v.id_sucursal = $${params.length}`;
    }

    if (estado_sin) {
      params.push(estado_sin);
      sql += ` AND f.estado_sin = $${params.length}`;
    }

    params.push(Number(limit) || 50);
    sql += ` ORDER BY f.id_factura DESC LIMIT $${params.length}`;

    params.push(Number(offset) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    res.status(200).json(result.rows);
  } catch (error: any) {
    console.error('[Error en GET /api/facturas]:', error.message);
    res.status(500).json({ error: 'Error interno al listar facturas.' });
  }
});

// =====================================================================
// GET /api/facturas/:id - Obtener factura fiscal con representación completa
// =====================================================================
facturacionRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;

  try {
    const factSql = `
      SELECT 
        f.id_factura,
        f.id_venta,
        f.numero_factura,
        f.cuf,
        f.cufd,
        f.qr_data,
        f.estado_sin,
        f.fecha_emision,
        f.metadata_sin,
        v.total_bruto,
        v.descuento,
        v.total_neto,
        v.tipo_pago,
        v.fecha_venta,
        v.id_sucursal,
        s.nombre as sucursal_nombre,
        s.direccion as sucursal_direccion,
        s.ciudad as sucursal_ciudad,
        s.telefono as sucursal_telefono,
        c.id_cliente,
        c.razon_social as cliente_nombre,
        c.nit_ci as cliente_nit,
        c.direccion as cliente_direccion
      FROM facturas_fiscales f
      JOIN ventas_cabecera v ON f.id_venta = v.id_venta
      JOIN sucursales s ON v.id_sucursal = s.id_sucursal
      JOIN clientes c ON v.id_cliente = c.id_cliente
      WHERE f.id_factura = $1
    `;
    const factRes = await query(factSql, [id]);

    if (factRes.rows.length === 0) {
      res.status(404).json({ error: 'Factura fiscal no encontrada.' });
      return;
    }

    const factura = factRes.rows[0];

    // Obtener detalles de la venta asociada
    const itemsRes = await query(
      `SELECT 
        d.id_detalle,
        d.codigo_producto,
        p.descripcion as producto_descripcion,
        p.unidad_medida,
        d.cantidad,
        d.precio_unitario,
        d.subtotal,
        d.numero_serie
      FROM ventas_detalle d
      JOIN productos p ON d.codigo_producto = p.codigo_producto
      WHERE d.id_venta = $1
      ORDER BY d.id_detalle ASC`,
      [factura.id_venta]
    );

    res.status(200).json({
      ...factura,
      items: itemsRes.rows
    });
  } catch (error: any) {
    console.error('[Error en GET /api/facturas/:id]:', error.message);
    res.status(500).json({ error: 'Error interno al consultar la factura.' });
  }
});

// =====================================================================
// GET /api/facturas/venta/:id_venta - Obtener factura por ID de Venta
// =====================================================================
facturacionRouter.get('/venta/:id_venta', async (req: AuthenticatedRequest, res: Response) => {
  const { id_venta } = req.params;

  try {
    const fRes = await query(
      'SELECT id_factura FROM facturas_fiscales WHERE id_venta = $1 LIMIT 1',
      [id_venta]
    );

    if (fRes.rows.length === 0) {
      res.status(404).json({ error: `La venta Nro ${id_venta} no tiene una factura fiscal emitida.` });
      return;
    }

    res.redirect(`/api/facturas/${fRes.rows[0].id_factura}`);
  } catch (error: any) {
    console.error('[Error en GET /api/facturas/venta/:id_venta]:', error.message);
    res.status(500).json({ error: 'Error al buscar factura de la venta.' });
  }
});

// =====================================================================
// POST /api/facturas/:id/anular - Anular Factura Fiscal
// =====================================================================
facturacionRouter.post('/:id/anular', requireRole('ADMIN', 'SUPERVISOR'), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { codigo_motivo = 1, motivo = 'FACTURA MAL EMITIDA' } = req.body;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const fRes = await client.query(
      'SELECT id_factura, id_venta, numero_factura, cuf, estado_sin, metadata_sin FROM facturas_fiscales WHERE id_factura = $1 FOR UPDATE',
      [id]
    );

    if (fRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Factura fiscal no encontrada.' });
      return;
    }

    const factura = fRes.rows[0];

    if (factura.estado_sin === 'ANULADA') {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'La factura fiscal ya se encuentra anulada.' });
      return;
    }

    // Actualizar metadata de anulación
    const metaActual = factura.metadata_sin || {};
    const nuevoMeta = {
      ...metaActual,
      anulacion: {
        fecha_anulacion: new Date(),
        usuario_anulador: req.user?.username || 'sistema',
        codigo_motivo,
        motivo
      }
    };

    await client.query(
      "UPDATE facturas_fiscales SET estado_sin = 'ANULADA', metadata_sin = $1 WHERE id_factura = $2",
      [JSON.stringify(nuevoMeta), id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Factura fiscal anulada exitosamente en el sistema.',
      id_factura: Number(id),
      numero_factura: Number(factura.numero_factura),
      estado_sin: 'ANULADA',
      motivo_anulacion: motivo
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Error en POST /api/facturas/:id/anular]:', error.message);
    res.status(500).json({ error: 'Error interno al anular la factura fiscal.' });
  } finally {
    client.release();
  }
});
