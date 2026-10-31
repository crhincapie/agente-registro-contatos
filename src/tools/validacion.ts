import { CONVENCIONES_DEMO } from '@/knowledge/convenciones-demo';
import type { AlmacenamientoPort } from '@/storage/port';
import { leerAdjunto, leerComerciales, leerCorreo } from '@/tools/buzon';
import { extraerContrato } from '@/tools/extraccion';
import { similitud, slugNombre } from '@/tools/normalizar';
import { leerMaestro, leerMetadatos } from '@/tools/salida';
import type {
  CampoRevision,
  ContratoExtraido,
  Evaluacion,
  FilaMaestro,
  MetaCampo,
  MetadatoContrato,
  TipoDato,
} from '@/tools/tipos';

const CONFIANZA_MINIMA = 0.8;
const SIMILITUD_ACTUALIZACION = 0.9;
const CAMPOS_REVISABLES = ['valor', 'moneda', 'fecha_inicio', 'fecha_fin'] as const;
const CAMPOS_CONTRACTUALES_OTROSI = ['valor', 'moneda', 'fecha_fin'] as const;

export async function evaluarMensaje(
  almacen: AlmacenamientoPort,
  mensajeId: string,
  fechaRegistro: string,
): Promise<Evaluacion> {
  const correo = await leerCorreo(almacen, mensajeId);
  const contrato = await seleccionarDocumento(almacen, mensajeId, correo.adjuntos);
  const comerciales = await leerComerciales(almacen);
  const comercial = comerciales.find((c) => c.email.toLowerCase() === correo.de.toLowerCase()) ?? null;
  const filas = await leerMaestro(almacen);
  const metadatos = await leerMetadatos(almacen);

  const base: Evaluacion = {
    mensaje_id: mensajeId,
    clasificacion: 'rechazado',
    motivo: '',
    id_contrato: contrato.id_contrato ?? contrato.contrato_referenciado,
    contrato,
    fila: null,
    fila_anterior: null,
    cambios: {},
    campos_revision: [],
    requiere_confirmacion: false,
    estado_poliza: null,
    estado_poliza_motivo: null,
    archivo: null,
    comercial: comercial?.nombre ?? null,
    remitente_email: correo.de,
    remitente_no_registrado: comercial === null,
    convenciones: [],
    observaciones: [],
  };

  if (contrato.tipo_documento === 'cotizacion') {
    return { ...base, motivo: 'El adjunto es una cotización, no un contrato (RN4).' };
  }
  if (contrato.tipo_documento === 'otrosi') {
    return evaluarOtrosi(base, contrato, filas, metadatos, mensajeId);
  }
  return evaluarContrato(base, contrato, filas, fechaRegistro, mensajeId);
}

export async function seleccionarDocumento(
  almacen: AlmacenamientoPort,
  mensajeId: string,
  adjuntos: string[],
): Promise<ContratoExtraido> {
  for (const nombre of adjuntos) {
    const contrato = extraerContrato(await leerAdjunto(almacen, mensajeId, nombre), nombre);
    if (contrato.tipo_documento !== 'desconocido') return contrato;
  }
  throw new Error('El mensaje no contiene un documento contractual reconocible');
}

function evaluarOtrosi(
  base: Evaluacion,
  contrato: ContratoExtraido,
  filas: FilaMaestro[],
  metadatos: Record<string, MetadatoContrato>,
  mensajeId: string,
): Evaluacion {
  const referencia = contrato.contrato_referenciado;
  const anterior = filas.find((fila) => fila.id_contrato === referencia);
  if (!referencia || !anterior) {
    return { ...base, clasificacion: 'conflicto', motivo: `El otrosí referencia ${referencia ?? 'un contrato desconocido'}, que no existe en el maestro.` };
  }
  if (contrato.nit_cliente !== anterior.nit_cliente) {
    return { ...base, clasificacion: 'conflicto', motivo: 'El NIT del otrosí no coincide con el del contrato original (RN5).' };
  }

  const esperado: Record<string, string> = {
    valor: contrato.valor !== null ? String(contrato.valor) : anterior.valor,
    moneda: contrato.moneda ?? anterior.moneda,
    fecha_fin: contrato.fecha_fin ?? anterior.fecha_fin,
  };
  const cambios: Evaluacion['cambios'] = {};
  for (const campo of CAMPOS_CONTRACTUALES_OTROSI) {
    if (esperado[campo] !== anterior[campo]) {
      cambios[campo] = { antes: anterior[campo], despues: esperado[campo] };
    }
  }
  if (Object.keys(cambios).length === 0) {
    return { ...base, clasificacion: 'duplicado', motivo: 'El otrosí no cambia valor, moneda ni fecha de terminación (RN1).' };
  }

  const requiereGarantia = anterior.requiere_poliza === 'true';
  const estadoPoliza = requiereGarantia ? 'pendiente' : anterior.estado_poliza;
  if (estadoPoliza !== anterior.estado_poliza) {
    cambios.estado_poliza = { antes: anterior.estado_poliza, despues: estadoPoliza };
  }

  const versiones = metadatos[referencia]?.versiones_documentales ?? [];
  const numeroOtrosi = versiones.filter((v) => v.tipo === 'otrosi').length + 1;
  const anio = referencia.split('-')[1];
  const destino = `Contratos/${anio}/${slugNombre(anterior.cliente)}/${referencia}_otrosi-${String(numeroOtrosi).padStart(2, '0')}.txt`;

  return {
    ...base,
    clasificacion: 'actualizacion',
    motivo: `Otrosí al contrato ${referencia}: cambian ${Object.keys(cambios).filter((c) => c !== 'estado_poliza').join(', ')} (RN2, D6).`,
    id_contrato: referencia,
    fila: { ...anterior, valor: esperado.valor, moneda: esperado.moneda, fecha_fin: esperado.fecha_fin, estado_poliza: estadoPoliza ?? '' },
    fila_anterior: anterior,
    cambios,
    estado_poliza: estadoPoliza,
    estado_poliza_motivo: requiereGarantia
      ? 'El otrosí amplía plazo y valor; la ampliación de garantías no tiene evidencia documental y queda pendiente de verificación.'
      : null,
    archivo: { origen: `buzon/${mensajeId}/${contrato.documento}`, destino },
    observaciones: [`Otrosí ${numeroOtrosi} archivado como documento independiente; el contrato original no se modifica.`],
  };
}

function evaluarContrato(
  base: Evaluacion,
  contrato: ContratoExtraido,
  filas: FilaMaestro[],
  fechaRegistro: string,
  mensajeId: string,
): Evaluacion {
  const id = contrato.id_contrato;
  if (!id) {
    return { ...base, motivo: 'No se identificó el número del contrato en el documento.' };
  }

  const anterior = filas.find((fila) => fila.id_contrato === id);
  if (anterior) {
    if (anterior.nit_cliente !== contrato.nit_cliente) {
      return { ...base, clasificacion: 'conflicto', motivo: `${id} ya existe con otro cliente (RN5).` };
    }
    const mismoDato =
      Number(anterior.valor) === contrato.valor &&
      anterior.fecha_inicio === (contrato.fecha_inicio ?? '') &&
      anterior.fecha_fin === (contrato.fecha_fin ?? '');
    if (mismoDato) {
      return { ...base, clasificacion: 'duplicado', motivo: `${id} ya está registrado con el mismo valor, inicio y fin (RN1).` };
    }
    return {
      ...base,
      clasificacion: 'conflicto',
      motivo: `${id} ya existe con datos distintos; solo un otrosí puede modificarlo (RN2, RN5).`,
    };
  }

  const similar = filas.find(
    (fila) =>
      fila.nit_cliente === contrato.nit_cliente &&
      similitud(fila.objeto, contrato.objeto ?? '') >= SIMILITUD_ACTUALIZACION,
  );
  if (similar) {
    return {
      ...base,
      clasificacion: 'conflicto',
      motivo: `Mismo cliente y objeto similar a ${similar.id_contrato}; revisar si es una actualización (RN2).`,
    };
  }

  if (contrato.fecha_inicio && contrato.fecha_fin && contrato.fecha_inicio > contrato.fecha_fin) {
    return { ...base, clasificacion: 'conflicto', motivo: 'La fecha de inicio es posterior a la de terminación.' };
  }

  const { contrato: conConvenciones, convenciones } = aplicarConvenciones(contrato);
  const camposRevision = revisarCampos(conConvenciones);
  const comercialNombre = base.comercial ?? '';
  const anio = id.split('-')[1];
  const estadoPoliza = conConvenciones.requiere_poliza ? 'pendiente' : 'no_aplica';
  const fila: FilaMaestro = {
    id_contrato: id,
    cliente: conConvenciones.cliente ?? '',
    nit_cliente: conConvenciones.nit_cliente ?? '',
    pais: conConvenciones.pais ?? '',
    objeto: conConvenciones.objeto ?? '',
    valor: String(conConvenciones.valor ?? ''),
    moneda: conConvenciones.moneda ?? '',
    fecha_inicio: conConvenciones.fecha_inicio ?? '',
    fecha_fin: conConvenciones.fecha_fin ?? '',
    requiere_poliza: String(conConvenciones.requiere_poliza ?? false),
    tipo_poliza: conConvenciones.requiere_poliza ? (conConvenciones.tipo_poliza ?? '') : '',
    estado_poliza: estadoPoliza,
    comercial: comercialNombre,
    ruta_sharepoint: `Contratos/${anio}/${slugNombre(conConvenciones.cliente ?? '')}/${id}.txt`,
    fecha_registro: fechaRegistro,
    fuente: 'buzon',
  };

  return {
    ...base,
    clasificacion: 'nuevo',
    motivo: camposRevision.length > 0
      ? `Contrato nuevo que requiere confirmación humana de ${camposRevision.map((c) => c.campo).join(', ')}.`
      : 'Contrato nuevo sin datos pendientes.',
    id_contrato: id,
    contrato: conConvenciones,
    fila,
    campos_revision: camposRevision,
    requiere_confirmacion: camposRevision.length > 0,
    estado_poliza: estadoPoliza,
    estado_poliza_motivo: conConvenciones.requiere_poliza ? motivoPoliza(conConvenciones) : null,
    archivo: { origen: `buzon/${mensajeId}/${contrato.documento}`, destino: fila.ruta_sharepoint },
    convenciones,
    observaciones: observacionesContrato(conConvenciones, convenciones, base.remitente_email, base.remitente_no_registrado),
  };
}

function aplicarConvenciones(contrato: ContratoExtraido): {
  contrato: ContratoExtraido;
  convenciones: Evaluacion['convenciones'];
} {
  const convencion = contrato.id_contrato ? CONVENCIONES_DEMO[contrato.id_contrato] : undefined;
  if (!convencion || contrato.fecha_fin !== null) {
    return { contrato, convenciones: [] };
  }
  const meta: ContratoExtraido['meta'] = {
    ...contrato.meta,
    fecha_fin: { tipo: 'CONVENCION', confianza: 0, fuente: 'convencion-demo' },
  };
  return {
    contrato: { ...contrato, fecha_fin: convencion.fecha_fin, meta },
    convenciones: [{ campo: 'fecha_fin', valor: convencion.fecha_fin, motivo: convencion.motivo }],
  };
}

function revisarCampos(contrato: ContratoExtraido): CampoRevision[] {
  const presentados: Record<(typeof CAMPOS_REVISABLES)[number], string | number | null> = {
    valor: contrato.valor,
    moneda: contrato.moneda,
    fecha_inicio: contrato.fecha_inicio,
    fecha_fin: contrato.fecha_fin,
  };
  return CAMPOS_REVISABLES.flatMap((campo) => {
    const meta = contrato.meta[campo];
    const revisar = !meta || meta.tipo === 'PENDIENTE' || meta.tipo === 'CONVENCION' || meta.confianza < CONFIANZA_MINIMA;
    if (!revisar) return [];
    const tipo: TipoDato = meta?.tipo ?? 'PENDIENTE';
    return [
      {
        campo,
        valor_presentado: presentados[campo],
        tipo,
        confianza: meta?.confianza ?? 0,
        motivo: motivoRevision(campo, tipo, contrato),
      },
    ];
  });
}

function motivoRevision(campo: string, tipo: TipoDato, contrato: ContratoExtraido): string {
  if (campo === 'valor' && contrato.valor_indeterminado) {
    return 'Valor indeterminado: el contrato marco no fija valor. El 0 es un marcador, no un valor contractual.';
  }
  if (tipo === 'CONVENCION') return 'Fecha convencional de la demostración, no extraída del contrato.';
  return 'Dato no informado en el documento.';
}

function motivoPoliza(contrato: ContratoExtraido): string {
  const condicion = contrato.condicion_poliza;
  if (condicion) {
    return `Obligación condicional: póliza de cumplimiento del ${condicion.porcentaje}% para cada ${condicion.base} cuyo valor supere ${condicion.texto_umbral} (${condicion.moneda_umbral} ${condicion.umbral}). Verificar si alguna orden activa la obligación.`;
  }
  return 'El contrato exige póliza; no hay evidencia de su constitución.';
}

function observacionesContrato(
  contrato: ContratoExtraido,
  convenciones: Evaluacion['convenciones'],
  remitenteEmail: string,
  remitenteNoRegistrado: boolean,
): string[] {
  const tratamiento = {
    incluido: 'El valor incluye impuestos, según el contrato.',
    mas_impuestos: 'Los impuestos de ley se suman al valor, según el contrato.',
    no_especificado: 'El tratamiento tributario no está especificado en el documento.',
  }[contrato.tratamiento_tributario];
  const observaciones = [tratamiento];
  if (contrato.valor_indeterminado) {
    observaciones.push('Contrato marco sin valor determinado; el valor de cada orden se fijará en la orden de servicio.');
  }
  for (const convencion of convenciones) {
    observaciones.push(`La fecha de terminación ${convencion.valor} es una convención de demostración. En producción debe verificarse la fecha exacta de firma.`);
  }
  if (remitenteNoRegistrado) {
    observaciones.push(`El remitente ${remitenteEmail} no está en el directorio de comerciales; se registra sin asignación comercial.`);
  }
  return observaciones;
}
