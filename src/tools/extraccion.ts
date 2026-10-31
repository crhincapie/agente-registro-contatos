import { convertirMonto, fechaDesdeTexto, formatearNombreCliente, normalizarTexto } from '@/tools/normalizar';
import type { CampoContrato, ContratoExtraido, MetaCampo, TipoDocumento } from '@/tools/tipos';

const PAIS_POR_CIUDAD: [string, string][] = [
  ['bogota', 'CO'],
  ['medellin', 'CO'],
  ['barranquilla', 'CO'],
  ['quito', 'EC'],
  ['lima', 'PE'],
  ['tegucigalpa', 'HN'],
  ['san pedro sula', 'HN'],
  ['panama', 'PA'],
];

export function extraerContrato(texto: string, documento: string): ContratoExtraido {
  const parrafos = texto
    .split(/\n\s*\n/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean);
  const tipo = clasificarTipo(texto);
  const esOtrosi = tipo === 'otrosi';
  const esContrato = tipo === 'contrato' || tipo === 'contrato_marco';
  const primeraLinea = texto.split('\n').find((linea) => linea.trim()) ?? '';
  const identificador = primeraLinea.match(/\b(?:CT|CM)-\d{4}-\d{2,4}\b/)?.[0] ?? null;

  const meta: Partial<Record<CampoContrato, MetaCampo>> = {};
  const marcar = (campo: CampoContrato, valor: unknown, confianza: number, tipoDato: MetaCampo['tipo'], fuente: string) => {
    meta[campo] = { tipo: valor === null ? 'PENDIENTE' : tipoDato, confianza: valor === null ? 0 : confianza, fuente };
  };

  const encabezado = parrafos.find((parrafo) => /\bEntre\b/.test(parrafo)) ?? '';
  const partes = encabezado.match(
    /Entre\s+(?:los suscritos,\s*)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.\s]*?)\s*,\s*(?:identificad[ao]\s+con\s+)?(NIT|RUC)\s+([\d.]+)/,
  );
  const cliente = partes ? formatearNombreCliente(partes[1].trim()) : null;
  const nitCliente = partes ? partes[3].replace(/\./g, '') : null;
  const ciudad = normalizarTexto(encabezado.match(/con domicilio en ([^,]+),/)?.[1] ?? '');
  const pais = PAIS_POR_CIUDAD.find(([nombre]) => ciudad.startsWith(nombre))?.[1] ?? null;

  const parrafoObjeto = esContrato ? buscarClausula(parrafos, 'PRIMERA') : null;
  const objeto = parrafoObjeto ? limpiarObjeto(parrafoObjeto) : null;

  const parrafoValor = buscarClausula(parrafos, 'SEGUNDA');
  const monto = parrafoValor?.match(/\b(COP|USD|PEN)\s?\$?\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)\b/) ?? null;
  const valorIndeterminado = !monto && normalizarTexto(parrafoValor ?? '').includes('no tiene un valor determinado');
  const valor = monto ? convertirMonto(monto[2]) : valorIndeterminado ? 0 : null;
  const moneda = monto ? monto[1] : null;
  const tratamiento = tratamientoTributario(normalizarTexto(parrafoValor ?? ''));

  const parrafoPlazo = buscarClausula(parrafos, esOtrosi ? 'PRIMERA' : 'TERCERA');
  const fechas = [...(parrafoPlazo ?? '').matchAll(/\((\d{1,2})\) de (\p{L}+) de (\d{4})/gu)]
    .map((m) => fechaDesdeTexto(m[1], m[2], m[3]))
    .filter((fecha): fecha is string => fecha !== null);
  const fechaInicio = esContrato && fechas.length >= 2 ? fechas[0] : null;
  const fechaFin = esOtrosi ? (fechas.at(-1) ?? null) : esContrato && fechas.length >= 2 ? fechas[1] : null;

  const parrafoPoliza = esContrato ? parrafos.find((parrafo) => normalizarTexto(parrafo).includes('poliza')) : undefined;
  const polizaNormalizada = parrafoPoliza ? normalizarTexto(parrafoPoliza) : '';
  const coincidePoliza = polizaNormalizada.match(/poliza de (\w+) por el ([a-z ]+?) por ciento (\d+)/);
  const requierePoliza = esContrato ? Boolean(parrafoPoliza) : null;
  const tipoPoliza = coincidePoliza ? coincidePoliza[1] : null;
  const condicionPoliza = parrafoPoliza ? extraerCondicionPoliza(parrafoPoliza, coincidePoliza?.[3]) : null;

  const fuenteClausula = (etiqueta: string) => `${documento}:${etiqueta}`;
  const etiquetaPoliza = parrafoPoliza ? etiquetaParrafo(parrafoPoliza) : 'sin_clausula';

  if (esContrato) {
    marcar('id_contrato', identificador, 0.98, 'EXTRAIDO', fuenteClausula('titulo'));
  }
  marcar('cliente', cliente, 0.98, 'EXTRAIDO', fuenteClausula('encabezado'));
  marcar('nit_cliente', nitCliente, 0.95, 'EXTRAIDO', fuenteClausula('encabezado'));
  marcar('pais', pais, 0.9, 'DERIVADO', fuenteClausula('encabezado'));
  if (esContrato) {
    marcar('objeto', objeto, 0.92, 'EXTRAIDO', fuenteClausula('PRIMERA'));
    marcar('fecha_inicio', fechaInicio, 0.98, 'EXTRAIDO', fuenteClausula('TERCERA'));
    marcar('requiere_poliza', requierePoliza, parrafoPoliza ? 0.95 : 0.85, parrafoPoliza ? 'EXTRAIDO' : 'DERIVADO', fuenteClausula(etiquetaPoliza));
    marcar('tipo_poliza', tipoPoliza, 0.98, 'EXTRAIDO', fuenteClausula(etiquetaPoliza));
  }
  marcar('valor', monto ? valor : null, 0.98, 'EXTRAIDO', fuenteClausula('SEGUNDA'));
  marcar('moneda', moneda, 0.98, 'EXTRAIDO', fuenteClausula('SEGUNDA'));
  marcar('fecha_fin', fechaFin, 0.98, 'EXTRAIDO', fuenteClausula(esOtrosi ? 'PRIMERA' : 'TERCERA'));

  return {
    documento,
    tipo_documento: tipo,
    id_contrato: esContrato ? identificador : null,
    contrato_referenciado: esOtrosi ? identificador : null,
    cliente,
    nit_cliente: nitCliente,
    pais,
    objeto,
    valor,
    valor_indeterminado: valorIndeterminado,
    moneda,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    tratamiento_tributario: tratamiento,
    requiere_poliza: requierePoliza,
    tipo_poliza: tipoPoliza,
    condicion_poliza: condicionPoliza,
    meta,
  };
}

export function clasificarTipo(texto: string): TipoDocumento {
  const primera = normalizarTexto(texto.split('\n').find((linea) => linea.trim()) ?? '');
  if (primera.startsWith('otrosi')) return 'otrosi';
  if (primera.startsWith('contrato marco')) return 'contrato_marco';
  if (primera.startsWith('contrato de prestacion')) return 'contrato';
  if (primera.startsWith('cotizacion')) return 'cotizacion';
  return 'desconocido';
}

function buscarClausula(parrafos: string[], etiqueta: string): string | null {
  return parrafos.find((parrafo) => parrafo.startsWith(`${etiqueta}.`)) ?? null;
}

function etiquetaParrafo(parrafo: string): string {
  return parrafo.match(/^([A-ZÁÉÍÓÚÑ]+)\./)?.[1] ?? 'clausula';
}

function limpiarObjeto(parrafo: string): string {
  const texto = parrafo
    .replace(/^PRIMERA\.\s*OBJETO\.\s*/, '')
    .replace(/^EL CONTRATISTA\s+(se obliga a\s+|prestar[aá]\s+(el servicio de\s+|servicios de\s+)?)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const recortado = texto.length > 200 ? texto.slice(0, 200).replace(/\s+\S*$/, '') : texto;
  return recortado.charAt(0).toUpperCase() + recortado.slice(1);
}

function tratamientoTributario(valorNormalizado: string): ContratoExtraido['tratamiento_tributario'] {
  if (/iva incluido|incluidos? los impuestos/.test(valorNormalizado)) return 'incluido';
  if (/\bmas (los |el )?(impuestos|iva)/.test(valorNormalizado)) return 'mas_impuestos';
  return 'no_especificado';
}

function extraerCondicionPoliza(parrafo: string, porcentaje: string | undefined): ContratoExtraido['condicion_poliza'] {
  const umbral = parrafo.match(/cuyo valor supere ([^()]+?)\s*\((COP|USD|PEN)\s?\$?\s?([\d.,]+)\)/);
  if (!umbral || porcentaje === undefined) return null;
  const base = parrafo.match(/Para cada ([^,]+?) cuyo valor/)?.[1] ?? 'desconocida';
  return {
    texto_umbral: umbral[1].trim(),
    umbral: convertirMonto(umbral[3]),
    moneda_umbral: umbral[2],
    porcentaje: Number(porcentaje),
    base,
  };
}
