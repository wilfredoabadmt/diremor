import { Router, Request, Response } from 'express';
import { query } from '../db.js';

export const impresionRouter = Router();

/**
 * Función auxiliar para convertir importes numéricos a su representación literal en Bolivianos
 */
export function numeroALiteral(monto: number): string {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertirGrupo(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    let res = '';
    const c = Math.floor(n / 100);
    const d = Math.floor((n % 100) / 10);
    const u = n % 10;

    if (c > 0) res += centenas[c] + ' ';

    const resto = n % 100;
    if (resto >= 10 && resto < 20) {
      res += especiales[resto - 10] + ' ';
    } else if (resto === 20) {
      res += 'VEINTE ';
    } else if (resto > 20 && resto < 30) {
      res += 'VEINTI' + unidades[u] + ' ';
    } else {
      if (d > 0) {
        res += decenas[d] + (u > 0 ? ' Y ' : ' ');
      }
      if (u > 0) res += unidades[u] + ' ';
    }
    return res.trim();
  }

  const partes = monto.toFixed(2).split('.');
  const enteros = parseInt(partes[0] || '0', 10);
  const centavos = partes[1] || '00';

  if (enteros === 0) return `CERO ${centavos}/100 BOLIVIANOS`;

  let resultado = '';
  const miles = Math.floor(enteros / 1000);
  const unidadesResto = enteros % 1000;

  if (miles > 0) {
    if (miles === 1) {
      resultado += 'UN MIL ';
    } else {
      resultado += convertirGrupo(miles) + ' MIL ';
    }
  }

  if (unidadesResto > 0) {
    resultado += convertirGrupo(unidadesResto) + ' ';
  }

  return `${resultado.trim()} ${centavos}/100 BOLIVIANOS`;
}

const ESTILOS_MEDIA_CARTA = `
  <style>
    @page {
      size: 140mm 216mm;
      margin: 8mm;
    }
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print {
        display: none !important;
      }
      .page-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
      }
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10.5px;
      line-height: 1.3;
      color: #111;
      background: #f4f6f8;
      margin: 0;
      padding: 20px;
    }
    .page-container {
      width: 140mm;
      min-height: 200mm;
      margin: 0 auto;
      background: #fff;
      padding: 12mm 10mm;
      box-sizing: border-box;
      border: 1px solid #d1d5db;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      position: relative;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .company-title {
      font-size: 14px;
      font-weight: bold;
      color: #1e3a8a;
      letter-spacing: 0.5px;
    }
    .company-sub {
      font-size: 9px;
      color: #4b5563;
    }
    .doc-box {
      border: 1.5px solid #1e3a8a;
      border-radius: 4px;
      text-align: center;
      padding: 6px;
      background: #f8fafc;
    }
    .doc-type {
      font-size: 11px;
      font-weight: bold;
      color: #1e3a8a;
      text-transform: uppercase;
    }
    .doc-number {
      font-size: 13px;
      font-weight: bold;
      color: #dc2626;
      margin-top: 2px;
    }
    .meta-box {
      width: 100%;
      border-collapse: collapse;
      margin: 8px 0;
      font-size: 10px;
    }
    .meta-box td {
      padding: 2.5px 4px;
      border-bottom: 1px dotted #e5e7eb;
    }
    .meta-label {
      font-weight: bold;
      color: #374151;
      width: 25%;
    }
    .meta-val {
      color: #111;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
      margin-bottom: 10px;
      font-size: 9.5px;
    }
    .items-table th {
      background: #1e3a8a;
      color: #fff;
      padding: 5px 4px;
      font-weight: 600;
      text-align: left;
      border: 1px solid #1e3a8a;
    }
    .items-table td {
      padding: 4px 4px;
      border: 1px solid #e5e7eb;
    }
    .items-table tr:nth-child(even) {
      background: #f9fafb;
    }
    .text-right { text-align: right !important; }
    .text-center { text-align: center !important; }
    .bold { font-weight: bold; }
    .total-box {
      width: 100%;
      margin-top: 6px;
      border-top: 1.5px solid #1e3a8a;
      padding-top: 6px;
    }
    .literal-text {
      font-style: italic;
      font-size: 9.5px;
      color: #1f2937;
      background: #f3f4f6;
      padding: 4px 6px;
      border-radius: 3px;
      margin-top: 4px;
    }
    .signatures-table {
      width: 100%;
      margin-top: 26px;
      border-collapse: collapse;
    }
    .signatures-table td {
      width: 33.33%;
      text-align: center;
      vertical-align: bottom;
      padding: 0 8px;
    }
    .sign-line {
      border-top: 1px solid #374151;
      margin-top: 35px;
      padding-top: 4px;
      font-size: 9px;
      color: #4b5563;
      font-weight: 600;
    }
    .footer-fiscal {
      text-align: center;
      font-size: 8px;
      color: #6b7280;
      margin-top: 14px;
      border-top: 1px dashed #d1d5db;
      padding-top: 6px;
    }
    .btn-print {
      position: fixed;
      top: 16px;
      right: 16px;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3);
    }
    .btn-print:hover { background: #1d4ed8; }
  </style>
`;

// =====================================================================
// GET /api/impresion/comprobante/:id - Comprobante Contable Media Carta
// =====================================================================
impresionRouter.get('/comprobante/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cabRes = await query(
      `SELECT a.*, s.nombre AS sucursal_nombre, s.ciudad AS municipio, s.direccion, u.nombre_completo AS usuario_nombre
       FROM asientos_cabecera a
       JOIN sucursales s ON a.id_sucursal = s.id_sucursal
       JOIN usuarios u ON a.id_usuario = u.id_usuario
       WHERE a.id_asiento = $1`,
      [id]
    );

    if (cabRes.rows.length === 0) {
      return res.status(404).send('<h2>Comprobante contable no encontrado.</h2>');
    }

    const c = cabRes.rows[0];

    const detRes = await query(
      `SELECT d.*, pc.codigo_cuenta, pc.nombre_cuenta
       FROM asientos_detalle d
       JOIN plan_cuentas pc ON d.id_cuenta = pc.id_cuenta
       WHERE d.id_asiento = $1
       ORDER BY d.id_detalle ASC`,
      [id]
    );

    const literal = numeroALiteral(parseFloat(c.total_debe));

    let rowsHtml = '';
    for (const d of detRes.rows) {
      const debeStr = parseFloat(d.debe) > 0 ? parseFloat(d.debe).toFixed(2) : '-';
      const haberStr = parseFloat(d.haber) > 0 ? parseFloat(d.haber).toFixed(2) : '-';
      rowsHtml += `
        <tr>
          <td class="bold">${d.codigo_cuenta}</td>
          <td>${d.nombre_cuenta}<br/><span style="color:#6b7280; font-size: 8.5px;">${d.glosa_detalle || ''}</span></td>
          <td class="text-right">${debeStr}</td>
          <td class="text-right">${haberStr}</td>
        </tr>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Comprobante ${c.numero_asiento} - DIREMOR</title>
  ${ESTILOS_MEDIA_CARTA}
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Media Carta</button>
  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 65%;">
          <div class="company-title">DIREMOR S.R.L.</div>
          <div class="company-sub">SISTEMA INTEGRADO SAC | DIREMOR S.R.L.</div>
          <div class="company-sub">${c.sucursal_nombre} - ${c.direccion || 'Casa Matriz'}</div>
          <div class="company-sub">${c.municipio || 'Santa Cruz'} - Bolivia</div>
        </td>
        <td style="width: 35%;">
          <div class="doc-box">
            <div class="doc-type">COMPROBANTE DE ${c.tipo_asiento}</div>
            <div class="doc-number">${c.numero_asiento}</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="meta-box">
      <tr>
        <td class="meta-label">Fecha Emisión:</td>
        <td class="meta-val">${new Date(c.fecha_asiento).toLocaleDateString('es-BO')}</td>
        <td class="meta-label">Módulo Origen:</td>
        <td class="meta-val">${c.modulo_origen}</td>
      </tr>
      <tr>
        <td class="meta-label">Glosa General:</td>
        <td class="meta-val" colspan="3">${c.glosa_general}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 25%;">Código</th>
          <th style="width: 45%;">Descripción de Cuenta / Partida</th>
          <th style="width: 15%;" class="text-right">Debe (Bs)</th>
          <th style="width: 15%;" class="text-right">Haber (Bs)</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="bold" style="background: #f1f5f9; border-top: 1.5px solid #1e3a8a;">
          <td colspan="2" class="text-right">TOTALES:</td>
          <td class="text-right">${parseFloat(c.total_debe).toFixed(2)}</td>
          <td class="text-right">${parseFloat(c.total_haber).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="literal-text">
      <span class="bold">Son:</span> ${literal}
    </div>

    <table class="signatures-table">
      <tr>
        <td><div class="sign-line">Elaborado Por<br/>${c.usuario_nombre}</div></td>
        <td><div class="sign-line">Revisado Por<br/>Contador General</div></td>
        <td><div class="sign-line">Autorizado Por<br/>Gerencia General</div></td>
      </tr>
    </table>

    <div class="footer-fiscal">
      DIREMOR S.R.L. | Comprobante Contable de Partida Doble emitido bajo NIIF y normativa boliviana.
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('[Error en GET /api/impresion/comprobante/:id]:', error);
    return res.status(500).send('Error interno al renderizar comprobante.');
  }
});

// =====================================================================
// GET /api/impresion/factura/:id - Factura Fiscal SIN Media Carta
// =====================================================================
impresionRouter.get('/factura/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const facRes = await query(
      `SELECT f.*, v.total_bruto, v.descuento, v.total_neto, v.fecha_venta,
              c.razon_social AS cliente_razon, c.nit_ci AS cliente_nit,
              s.nombre AS sucursal_nombre, s.direccion, s.ciudad AS municipio, s.leyenda_fiscal, s.telefono
       FROM facturas_fiscales f
       JOIN ventas_cabecera v ON f.id_venta = v.id_venta
       JOIN clientes c ON v.id_cliente = c.id_cliente
       JOIN sucursales s ON v.id_sucursal = s.id_sucursal
       WHERE f.id_factura = $1`,
      [id]
    );

    if (facRes.rows.length === 0) {
      return res.status(404).send('<h2>Factura fiscal no encontrada.</h2>');
    }

    const f = facRes.rows[0];

    const detRes = await query(
      `SELECT vd.*, p.descripcion AS producto_nombre
       FROM ventas_detalle vd
       JOIN productos p ON vd.codigo_producto = p.codigo_producto
       WHERE vd.id_venta = $1`,
      [f.id_venta]
    );

    const literal = numeroALiteral(parseFloat(f.total_neto));

    let rowsHtml = '';
    for (const d of detRes.rows) {
      rowsHtml += `
        <tr>
          <td>${d.codigo_producto}</td>
          <td>${d.producto_nombre}</td>
          <td class="text-center">${parseFloat(d.cantidad).toFixed(2)}</td>
          <td class="text-right">${parseFloat(d.precio_unitario).toFixed(2)}</td>
          <td class="text-right">${parseFloat(d.subtotal).toFixed(2)}</td>
        </tr>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Factura Fiscal Nro ${f.numero_factura} - DIREMOR</title>
  ${ESTILOS_MEDIA_CARTA}
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Factura Media Carta</button>
  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 58%;">
          <div class="company-title">DIREMOR S.R.L.</div>
          <div class="company-sub">IMPORTACIONES & DISTRIBUCIÓN INDUSTRIAL</div>
          <div class="company-sub">${f.sucursal_nombre} | Tel: ${f.telefono || '3-3456789'}</div>
          <div class="company-sub">${f.direccion || 'Av. Cristo Redentor esq. 4to Anillo'}</div>
          <div class="company-sub">${f.municipio || 'Santa Cruz'} - Bolivia</div>
        </td>
        <td style="width: 42%;">
          <div class="doc-box">
            <div style="font-size: 9px; font-weight: bold; color: #4b5563;">NIT: 1020304050</div>
            <div class="doc-type">FACTURA FISCAL</div>
            <div class="doc-number">N° ${f.numero_factura}</div>
            <div style="font-size: 8px; color: #6b7280; margin-top: 2px;">CÓD. AUTORIZACIÓN: ${f.cuf.slice(0, 16)}...</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="meta-box">
      <tr>
        <td class="meta-label">Fecha y Hora:</td>
        <td class="meta-val">${new Date(f.fecha_emision).toLocaleString('es-BO')}</td>
        <td class="meta-label">NIT / CI:</td>
        <td class="meta-val bold">${f.cliente_nit}</td>
      </tr>
      <tr>
        <td class="meta-label">Señor(es):</td>
        <td class="meta-val bold" colspan="3">${f.cliente_razon}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 20%;">Código</th>
          <th style="width: 45%;">Descripción</th>
          <th style="width: 10%;" class="text-center">Cant.</th>
          <th style="width: 12%;" class="text-right">P. Unit</th>
          <th style="width: 13%;" class="text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="bold" style="background: #f8fafc; border-top: 1.5px solid #1e3a8a;">
          <td colspan="4" class="text-right">TOTAL NETO (Bs):</td>
          <td class="text-right">${parseFloat(f.total_neto).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="literal-text">
      <span class="bold">Son:</span> ${literal}
    </div>

    <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center; border-top: 1px dotted #9ca3af; padding-top: 8px;">
      <div style="width: 75px; height: 75px; border: 1px solid #111; display: flex; align-items: center; justify-content: center; font-size: 8px; text-align: center; background: #fff;">
        [QR FISCAL SIN]
      </div>
      <div style="flex: 1; font-size: 8px; color: #374151; line-height: 1.3;">
        <div><b>CUF:</b> <span style="word-break: break-all;">${f.cuf}</span></div>
        <div style="margin-top: 2px;"><b>CUFD:</b> ${f.cufd}</div>
        <div style="margin-top: 4px; font-weight: bold; color: #111;">ESTE DOCUMENTO ES LA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO FISCAL DIGITAL EMITIDO EN UNA MODALIDAD DE FACTURACIÓN EN LÍNEA</div>
      </div>
    </div>

    <div class="footer-fiscal">
      "${f.leyenda_fiscal || 'Ley N° 453: El proveedor debe exhibir el precio total del bien o servicio en moneda nacional.'}"
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('[Error en GET /api/impresion/factura/:id]:', error);
    return res.status(500).send('Error interno al renderizar factura fiscal.');
  }
});

// =====================================================================
// GET /api/impresion/recibo-cobro/:id - Recibo Oficial de Cobranza CxC
// =====================================================================
impresionRouter.get('/recibo-cobro/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cobRes = await query(
      `SELECT cb.*, c.numero_documento_ref, cli.razon_social AS cliente_razon, cli.nit_ci AS cliente_nit,
              s.nombre AS sucursal_nombre, s.ciudad AS municipio, u.nombre_completo AS cajero_nombre
       FROM cxc_cobros cb
       JOIN cxc_cuentas c ON cb.id_cxc = c.id_cxc
       JOIN clientes cli ON c.id_cliente = cli.id_cliente
       JOIN sucursales s ON c.id_sucursal = s.id_sucursal
       JOIN usuarios u ON cb.id_usuario = u.id_usuario
       WHERE cb.id_cobro = $1`,
      [id]
    );

    if (cobRes.rows.length === 0) {
      return res.status(404).send('<h2>Recibo de cobranza no encontrado.</h2>');
    }

    const r = cobRes.rows[0];
    const literal = numeroALiteral(parseFloat(r.monto_cobrado));

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Recibo de Cobranza ${r.numero_recibo} - DIREMOR</title>
  ${ESTILOS_MEDIA_CARTA}
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Recibo Media Carta</button>
  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 60%;">
          <div class="company-title">DIREMOR S.R.L.</div>
          <div class="company-sub">DEPARTAMENTO DE TESORERÍA & CARTERA</div>
          <div class="company-sub">${r.sucursal_nombre} - ${r.municipio || 'Santa Cruz'}</div>
        </td>
        <td style="width: 40%;">
          <div class="doc-box">
            <div class="doc-type">RECIBO DE COBRANZA</div>
            <div class="doc-number">${r.numero_recibo}</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="meta-box">
      <tr>
        <td class="meta-label">Fecha de Cobro:</td>
        <td class="meta-val">${new Date(r.fecha_cobro).toLocaleString('es-BO')}</td>
        <td class="meta-label">Forma de Pago:</td>
        <td class="meta-val bold">${r.forma_pago}</td>
      </tr>
      <tr>
        <td class="meta-label">Recibimos de:</td>
        <td class="meta-val bold" colspan="3">${r.cliente_razon} (NIT/CI: ${r.cliente_nit})</td>
      </tr>
      <tr>
        <td class="meta-label">Doc. Referencia:</td>
        <td class="meta-val">${r.numero_documento_ref || 'Venta a Crédito'}</td>
        <td class="meta-label">Nro Transf / Ref:</td>
        <td class="meta-val">${r.numero_referencia || 'N/A'}</td>
      </tr>
      <tr>
        <td class="meta-label">Concepto / Glosa:</td>
        <td class="meta-val" colspan="3">${r.observaciones || 'Amortización de cuenta por cobrar'}</td>
      </tr>
    </table>

    <div class="total-box" style="margin-top: 14px; text-align: right;">
      <span style="font-size: 11px; font-weight: bold; color: #374151;">IMPORTE COBRADO: </span>
      <span style="font-size: 16px; font-weight: bold; color: #1e3a8a;">${parseFloat(r.monto_cobrado).toFixed(2)} Bs</span>
    </div>

    <div class="literal-text" style="margin-top: 8px;">
      <span class="bold">La suma de:</span> ${literal}
    </div>

    <table class="signatures-table" style="margin-top: 45px;">
      <tr>
        <td style="width: 50%;">
          <div class="sign-line">Entregué Conforme<br/>Cliente / Pagador</div>
        </td>
        <td style="width: 50%;">
          <div class="sign-line">Recibí Conforme (Cajero)<br/>${r.cajero_nombre}</div>
        </td>
      </tr>
    </table>

    <div class="footer-fiscal">
      DIREMOR S.R.L. | Documento no válido para crédito fiscal. Emitido como constancia de amortización de cartera.
    </div>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('[Error en GET /api/impresion/recibo-cobro/:id]:', error);
    return res.status(500).send('Error interno al renderizar recibo de cobranza.');
  }
});

// =====================================================================
// GET /api/impresion/proforma/:id - Proforma / Cotización Media Carta
// =====================================================================
impresionRouter.get('/proforma/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cotRes = await query(
      `SELECT c.*, cli.razon_social AS cliente_razon, cli.nit_ci AS cliente_nit, cli.telefono AS cliente_tel,
              s.nombre AS sucursal_nombre, s.ciudad AS municipio, u.nombre_completo AS vendedor_nombre
       FROM cotizaciones_cabecera c
       JOIN clientes cli ON c.id_cliente = cli.id_cliente
       JOIN sucursales s ON c.id_sucursal = s.id_sucursal
       JOIN usuarios u ON c.id_usuario = u.id_usuario
       WHERE c.id_cotizacion = $1`,
      [id]
    );

    if (cotRes.rows.length === 0) {
      return res.status(404).send('<h2>Cotización no encontrada.</h2>');
    }

    const c = cotRes.rows[0];

    const detRes = await query(
      `SELECT cd.*, p.descripcion AS producto_nombre
       FROM cotizaciones_detalle cd
       JOIN productos p ON cd.codigo_producto = p.codigo_producto
       WHERE cd.id_cotizacion = $1`,
      [id]
    );

    const literal = numeroALiteral(parseFloat(c.total_neto));

    let rowsHtml = '';
    for (const d of detRes.rows) {
      rowsHtml += `
        <tr>
          <td>${d.codigo_producto}</td>
          <td>${d.producto_nombre}</td>
          <td class="text-center">${parseFloat(d.cantidad).toFixed(2)}</td>
          <td class="text-right">${parseFloat(d.precio_unitario).toFixed(2)}</td>
          <td class="text-right">${parseFloat(d.subtotal).toFixed(2)}</td>
        </tr>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <title>Proforma Comercial Nro ${c.id_cotizacion} - DIREMOR</title>
  ${ESTILOS_MEDIA_CARTA}
</head>
<body>
  <button class="btn-print no-print" onclick="window.print()">🖨️ Imprimir Proforma Media Carta</button>
  <div class="page-container">
    <table class="header-table">
      <tr>
        <td style="width: 60%;">
          <div class="company-title">DIREMOR S.R.L.</div>
          <div class="company-sub">COTIZACIÓN / PRESUPUESTO COMERCIAL</div>
          <div class="company-sub">${c.sucursal_nombre} - ${c.municipio || 'Santa Cruz'}</div>
        </td>
        <td style="width: 40%;">
          <div class="doc-box">
            <div class="doc-type">PROFORMA COMERCIAL</div>
            <div class="doc-number">PROF-${String(c.id_cotizacion).padStart(5, '0')}</div>
          </div>
        </td>
      </tr>
    </table>

    <table class="meta-box">
      <tr>
        <td class="meta-label">Fecha Emisión:</td>
        <td class="meta-val">${new Date(c.fecha_emision).toLocaleDateString('es-BO')}</td>
        <td class="meta-label">Válida Hasta:</td>
        <td class="meta-val bold" style="color: #dc2626;">${new Date(c.fecha_validez).toLocaleDateString('es-BO')}</td>
      </tr>
      <tr>
        <td class="meta-label">Cliente / Razón:</td>
        <td class="meta-val bold" colspan="3">${c.cliente_razon} (NIT: ${c.cliente_nit})</td>
      </tr>
      <tr>
        <td class="meta-label">Asesor Comercial:</td>
        <td class="meta-val">${c.vendedor_nombre}</td>
        <td class="meta-label">Estado:</td>
        <td class="meta-val bold">${c.estado}</td>
      </tr>
    </table>

    <table class="items-table">
      <thead>
        <tr>
          <th style="width: 20%;">Código</th>
          <th style="width: 45%;">Descripción</th>
          <th style="width: 10%;" class="text-center">Cant.</th>
          <th style="width: 12%;" class="text-right">P. Unit</th>
          <th style="width: 13%;" class="text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="bold" style="background: #f8fafc; border-top: 1.5px solid #1e3a8a;">
          <td colspan="4" class="text-right">TOTAL PRESUPUESTO (Bs):</td>
          <td class="text-right">${parseFloat(c.total_neto).toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div class="literal-text">
      <span class="bold">Son:</span> ${literal}
    </div>

    <div style="font-size: 8.5px; color: #4b5563; margin-top: 12px; line-height: 1.4; background: #fffbeb; border: 1px solid #fef3c7; padding: 6px; border-radius: 4px;">
      <b>Condiciones de Venta:</b> Precios expresados en Bolivianos (BOB) con impuestos de ley incluidos. Validez de la oferta sujeta a disponibilidad de stock al momento de la confirmación formal del pedido.
    </div>

    <table class="signatures-table" style="margin-top: 30px;">
      <tr>
        <td style="width: 50%;">
          <div class="sign-line">Asesor Comercial<br/>${c.vendedor_nombre}</div>
        </td>
        <td style="width: 50%;">
          <div class="sign-line">Aceptación de Oferta<br/>Firma y Sello Cliente</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (error: any) {
    console.error('[Error en GET /api/impresion/proforma/:id]:', error);
    return res.status(500).send('Error interno al renderizar proforma comercial.');
  }
});
