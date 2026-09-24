/**
 * Utilidades de Facturación Fiscal Electrónica del SIN (Bolivia)
 * Cumple con RND 102100000011 (Sistema de Facturación)
 */

export interface CUFParams {
  nitEmisor: string | number;
  fechaHora: Date;
  sucursal: number;
  modalidad?: number; // 1 = Electronica en Linea, 2 = Computarizada en Linea
  tipoEmision?: number; // 1 = Online, 2 = Offline
  tipoDocumentoFiscal?: number; // 1 = Factura Compra Venta
  tipoDocumentoSector?: number; // 1 = Factura estandar
  numeroFactura: number;
  puntoVenta?: number;
}

export interface QRParams {
  nitEmisor: string | number;
  cuf: string;
  numeroFactura: number;
  totalNeto: number;
}

/**
 * Calcula el Dígito Verificador Módulo 11 según el estándar del SIN
 */
export function calcularDigitoModulo11(cadena: string, maxPonderador: number = 9): number {
  let suma = 0;
  let ponderador = 2;

  // Recorrer de derecha a izquierda
  for (let i = cadena.length - 1; i >= 0; i--) {
    const char = cadena[i];
    if (!char) {
      continue;
    }
    const digito = parseInt(char, 10);
    if (isNaN(digito)) {
      continue;
    }
    suma += digito * ponderador;
    ponderador = ponderador < maxPonderador ? ponderador + 1 : 2;
  }

  const residuo = suma % 11;
  const digitoVerificador = 11 - residuo;

  if (digitoVerificador === 11) return 0;
  if (digitoVerificador === 10) return 1;
  return digitoVerificador;
}

/**
 * Formatea una fecha al estándar SIN: YYYYMMDDHHmmssSSS (17 dígitos)
 */
export function formatearFechaSIN(fecha: Date): string {
  const yyyy = String(fecha.getUTCFullYear());
  const mm = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getUTCDate()).padStart(2, '0');
  const hh = String(fecha.getUTCHours()).padStart(2, '0');
  const min = String(fecha.getUTCMinutes()).padStart(2, '0');
  const ss = String(fecha.getUTCSeconds()).padStart(2, '0');
  const sss = String(fecha.getUTCMilliseconds()).padStart(3, '0');

  return `${yyyy}${mm}${dd}${hh}${min}${ss}${sss}`;
}

/**
 * Genera el Código Único de Facturación (CUF) en formato Hexadecimal (Base 16)
 */
export function generarCUF(params: CUFParams): string {
  const nitStr = String(params.nitEmisor).padStart(13, '0');
  const fechaStr = formatearFechaSIN(params.fechaHora);
  const sucStr = String(params.sucursal).padStart(4, '0');
  const modStr = String(params.modalidad ?? 1).padStart(1, '0');
  const emiStr = String(params.tipoEmision ?? 1).padStart(1, '0');
  const tdfStr = String(params.tipoDocumentoFiscal ?? 1).padStart(1, '0');
  const tdsStr = String(params.tipoDocumentoSector ?? 1).padStart(2, '0');
  const nroStr = String(params.numeroFactura).padStart(10, '0');
  const ptoStr = String(params.puntoVenta ?? 0).padStart(4, '0');

  // Concatenación de 53 dígitos numéricos
  const cadenaBase = `${nitStr}${fechaStr}${sucStr}${modStr}${emiStr}${tdfStr}${tdsStr}${nroStr}${ptoStr}`;

  // Cálculo del dígito verificador Modulo 11
  const dv = calcularDigitoModulo11(cadenaBase);
  const cadenaConDv = `${cadenaBase}${dv}`;

  // Conversión a Base 16 (Hexadecimal) en mayúsculas
  const bigIntVal = BigInt(cadenaConDv);
  return bigIntVal.toString(16).toUpperCase();
}

/**
 * Genera la URL oficial para el Código QR Fiscal
 */
export function generarCadenaQRFiscal(params: QRParams): string {
  const monto = Number(params.totalNeto).toFixed(2);
  return `https://siat.impuestos.gob.bo/consulta/QR?nit=${params.nitEmisor}&cuf=${params.cuf}&numero=${params.numeroFactura}&t=${monto}`;
}
