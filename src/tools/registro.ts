import type { AlmacenamientoPort } from '@/storage/port';
import { leerAdjunto } from '@/tools/buzon';
import { escribirMaestro, leerHistorial, leerMaestro, leerMetadatos, leerProcesados, RUTAS } from '@/tools/salida';
import type { CampoRevision, Evaluacion, MetadatoContrato, RegistroProcesado } from '@/tools/tipos';
import { evaluarMensaje } from '@/tools/validacion';

export interface ConfirmacionHumana {
  nombre_declarado: string;
  campos: Record<string, string | number | null>;
}

export interface ContextoRegistro {
  fechaRegistro: string;
  sessionId: string;
}

export type EstadoRegistro =
  | 'registrado'
  | 'actualizado'
  | 'duplicado'
  | 'rechazado'
  | 'conflicto'
  | 'requiere_confirmacion'
  | 'ya_procesado';

export interface ResultadoRegistro {
  estado: EstadoRegistro;
  clasificacion: Evaluacion['clasificacion'] | null;
  id_contrato: string | null;
  ruta_archivo: string | null;
  motivo: string;
  campos_revision: CampoRevision[];
}

interface PlanRegistro {
  mensajeId: string;
  evaluacion: Evaluacion;
  fechaRegistro: string;
  ts: string;
  lineasHistorial: Record<string, unknown>[];
}

type Pendientes = Record<string, PlanRegistro>;

export async function registrarMensaje(
  almacen: AlmacenamientoPort,
  mensajeId: string,
  contexto: ContextoRegistro,
  confirmacion: ConfirmacionHumana | undefined,
): Promise<ResultadoRegistro> {
  const procesados = await leerProcesados(almacen);
  if (procesados[mensajeId]) {
    await quitarPendiente(almacen, mensajeId);
    return resultado('ya_procesado', null, procesados[mensajeId].id_contrato, null, 'El mensaje ya fue procesado; no se escribe de nuevo.', []);
  }

  const historial = await leerHistorial(almacen);
  const aplicado = historial.find((entrada) => entrada.mensaje_id === mensajeId && (entrada.accion === 'nuevo' || entrada.accion === 'actualizacion'));
  if (aplicado) {
    const estado = aplicado.accion === 'nuevo' ? 'registrado' : 'actualizado';
    const idAplicado = String(aplicado.id_contrato);
    await marcarProcesado(almacen, procesados, mensajeId, { estado, id_contrato: idAplicado, ts: String(aplicado.ts) });
    await quitarPendiente(almacen, mensajeId);
    return resultado('ya_procesado', null, idAplicado, null, 'El cambio ya estaba en el historial; se completó el control de mensajes.', []);
  }

  const pendientes = await leerPendientes(almacen);
  let plan = pendientes[mensajeId];
  if (!plan) {
    const evaluacion = await evaluarMensaje(almacen, mensajeId, contexto.fechaRegistro);

    if (evaluacion.clasificacion === 'conflicto') {
      return resultado('conflicto', evaluacion.clasificacion, evaluacion.id_contrato, null, evaluacion.motivo, []);
    }
    if (evaluacion.clasificacion === 'rechazado' || evaluacion.clasificacion === 'duplicado') {
      await marcarProcesado(almacen, procesados, mensajeId, {
        estado: evaluacion.clasificacion,
        id_contrato: evaluacion.id_contrato,
        ts: new Date().toISOString(),
      });
      return resultado(evaluacion.clasificacion, evaluacion.clasificacion, evaluacion.id_contrato, null, evaluacion.motivo, []);
    }

    if (evaluacion.requiere_confirmacion) {
      if (!confirmacion) {
        return resultado(
          'requiere_confirmacion',
          evaluacion.clasificacion,
          evaluacion.id_contrato,
          null,
          'Antes de registrar se requiere la confirmación humana de los campos indicados.',
          evaluacion.campos_revision,
        );
      }
      validarConfirmacion(evaluacion.campos_revision, confirmacion);
    }

    if (!evaluacion.archivo || !evaluacion.id_contrato) {
      throw new Error('La evaluación no contiene archivo o identificador para registrar');
    }

    plan = planificar(mensajeId, evaluacion, confirmacion, contexto);
    await escribirPendientes(almacen, { ...pendientes, [mensajeId]: plan });
  }

  return aplicarPlan(almacen, plan);
}

function planificar(
  mensajeId: string,
  evaluacion: Evaluacion,
  confirmacion: ConfirmacionHumana | undefined,
  contexto: ContextoRegistro,
): PlanRegistro {
  const ts = new Date().toISOString();
  const decisionId = evaluacion.requiere_confirmacion ? `conf-${evaluacion.id_contrato}-${mensajeId}` : null;
  const lineasHistorial: Record<string, unknown>[] = [];
  if (confirmacion && decisionId) {
    lineasHistorial.push(entradaConfirmacion(evaluacion, mensajeId, decisionId, confirmacion, contexto.sessionId, ts));
  }
  lineasHistorial.push(entradaHistorial(evaluacion, mensajeId, decisionId, ts));
  return { mensajeId, evaluacion, fechaRegistro: contexto.fechaRegistro, ts, lineasHistorial };
}

async function aplicarPlan(almacen: AlmacenamientoPort, plan: PlanRegistro): Promise<ResultadoRegistro> {
  const { mensajeId, evaluacion } = plan;
  const { archivo, id_contrato: idContrato, fila } = evaluacion;
  if (!archivo || !idContrato) {
    throw new Error('El plan pendiente no contiene archivo o identificador');
  }

  const contenido = await leerAdjunto(almacen, mensajeId, evaluacion.contrato.documento);
  await almacen.escribirSalida(`${RUTAS.documentos}${archivo.destino}`, contenido);

  const filas = await leerMaestro(almacen);
  if (evaluacion.clasificacion === 'nuevo' && fila && !filas.some((existente) => existente.id_contrato === idContrato)) {
    await escribirMaestro(almacen, [...filas, fila]);
  }
  if (evaluacion.clasificacion === 'actualizacion' && fila) {
    await escribirMaestro(almacen, filas.map((existente) => (existente.id_contrato === idContrato ? fila : existente)));
  }

  await actualizarMetadatos(almacen, evaluacion, mensajeId, plan.fechaRegistro);

  const historial = await leerHistorial(almacen);
  const lineasPendientes = plan.lineasHistorial.filter(
    (linea) => !historial.some((entrada) => entrada.accion === linea.accion && entrada.mensaje_id === linea.mensaje_id && entrada.decision_id === linea.decision_id),
  );
  if (lineasPendientes.length > 0) {
    await almacen.anexarSalida(RUTAS.historial, lineasPendientes.map((linea) => JSON.stringify(linea)).join('\n'));
  }

  const estado = evaluacion.clasificacion === 'nuevo' ? 'registrado' : 'actualizado';
  await marcarProcesado(almacen, await leerProcesados(almacen), mensajeId, { estado, id_contrato: idContrato, ts: plan.ts });
  await quitarPendiente(almacen, mensajeId);
  return resultado(estado, evaluacion.clasificacion, idContrato, archivo.destino, evaluacion.motivo, []);
}

function validarConfirmacion(revision: CampoRevision[], confirmacion: ConfirmacionHumana): void {
  if (confirmacion.nombre_declarado.trim() === '') {
    throw new Error('La confirmación requiere el nombre de quien confirma');
  }
  for (const campo of revision) {
    if (!(campo.campo in confirmacion.campos)) {
      throw new Error(`Falta confirmar el campo ${campo.campo}`);
    }
    if (JSON.stringify(confirmacion.campos[campo.campo]) !== JSON.stringify(campo.valor_presentado)) {
      throw new Error(`El valor confirmado de ${campo.campo} no coincide con el valor propuesto`);
    }
  }
}

function entradaConfirmacion(
  evaluacion: Evaluacion,
  mensajeId: string,
  decisionId: string,
  confirmacion: ConfirmacionHumana,
  sessionId: string,
  ts: string,
): Record<string, unknown> {
  return {
    accion: 'confirmacion',
    decision_id: decisionId,
    mensaje_id: mensajeId,
    id_contrato: evaluacion.id_contrato,
    campos_revisados: evaluacion.campos_revision.map((c) => c.campo),
    valores_presentados: Object.fromEntries(evaluacion.campos_revision.map((c) => [c.campo, c.valor_presentado])),
    valores_confirmados: Object.fromEntries(evaluacion.campos_revision.map((c) => [c.campo, confirmacion.campos[c.campo]])),
    confirmado_por: confirmacion.nombre_declarado.trim(),
    autenticacion: 'no_autenticado',
    session_id: sessionId,
    ts,
  };
}

async function actualizarMetadatos(
  almacen: AlmacenamientoPort,
  evaluacion: Evaluacion,
  mensajeId: string,
  fechaRegistro: string,
): Promise<void> {
  const metadatos = await leerMetadatos(almacen);
  const id = evaluacion.id_contrato!;
  const contrato = evaluacion.contrato;
  const tipoDato = Object.fromEntries(Object.entries(contrato.meta).map(([k, m]) => [k, m?.tipo]));
  const confianza = Object.fromEntries(Object.entries(contrato.meta).map(([k, m]) => [k, m?.confianza]));
  const fuentes = Object.fromEntries(Object.entries(contrato.meta).map(([k, m]) => [k, m?.fuente ?? null]));
  const convenciones = evaluacion.convenciones.map((c) => `${c.campo}=${c.valor} (CONVENCION)`);

  if (evaluacion.clasificacion === 'nuevo' && evaluacion.fila) {
    metadatos[id] = {
      id_contrato: id,
      valor_indeterminado: contrato.valor_indeterminado,
      condicion_poliza: contrato.condicion_poliza,
      tratamiento_tributario: contrato.tratamiento_tributario,
      tipo_dato_por_campo: tipoDato,
      confianza_por_campo: confianza,
      fuentes_por_campo: fuentes,
      convenciones,
      observaciones: evaluacion.observaciones,
      remitente_email: evaluacion.remitente_email,
      remitente_no_registrado: evaluacion.remitente_no_registrado,
      estado_poliza_motivo: evaluacion.estado_poliza_motivo,
      versiones_documentales: [
        { version: 1, tipo: 'contrato', ruta: evaluacion.fila.ruta_sharepoint, mensaje_id: mensajeId, fecha: fechaRegistro },
      ],
    };
  } else if (evaluacion.clasificacion === 'actualizacion' && evaluacion.fila_anterior) {
    const previo: MetadatoContrato = metadatos[id] ?? {
      id_contrato: id,
      valor_indeterminado: false,
      condicion_poliza: null,
      tratamiento_tributario: 'no_especificado',
      tipo_dato_por_campo: {},
      confianza_por_campo: {},
      fuentes_por_campo: {},
      convenciones: [],
      observaciones: [],
      remitente_email: null,
      remitente_no_registrado: false,
      estado_poliza_motivo: null,
      versiones_documentales: [
        {
          version: 1,
          tipo: 'contrato_original',
          ruta: evaluacion.fila_anterior.ruta_sharepoint,
          mensaje_id: null,
          fecha: evaluacion.fila_anterior.fecha_registro,
        },
      ],
    };
    if (!previo.versiones_documentales.some((version) => version.mensaje_id === mensajeId)) {
      metadatos[id] = {
        ...previo,
        estado_poliza_motivo: evaluacion.estado_poliza_motivo ?? previo.estado_poliza_motivo,
        observaciones: [...previo.observaciones, ...evaluacion.observaciones],
        versiones_documentales: [
          ...previo.versiones_documentales,
          {
            version: previo.versiones_documentales.length + 1,
            tipo: 'otrosi',
            ruta: evaluacion.archivo!.destino,
            mensaje_id: mensajeId,
            fecha: fechaRegistro,
          },
        ],
      };
    }
  }

  await almacen.escribirSalida(RUTAS.metadata, `${JSON.stringify(metadatos, null, 2)}\n`);
}

function entradaHistorial(
  evaluacion: Evaluacion,
  mensajeId: string,
  decisionId: string | null,
  ts: string,
): Record<string, unknown> {
  const base = {
    accion: evaluacion.clasificacion,
    mensaje_id: mensajeId,
    id_contrato: evaluacion.id_contrato,
    ruta: evaluacion.archivo?.destino ?? null,
    decision_id: decisionId,
    ts,
  };
  if (evaluacion.clasificacion === 'actualizacion') {
    return { ...base, cambios: evaluacion.cambios, estado_poliza_motivo: evaluacion.estado_poliza_motivo };
  }
  return { ...base, datos: evaluacion.fila, estado_poliza_motivo: evaluacion.estado_poliza_motivo };
}

async function marcarProcesado(
  almacen: AlmacenamientoPort,
  procesados: Record<string, RegistroProcesado>,
  mensajeId: string,
  registro: RegistroProcesado,
): Promise<void> {
  await almacen.escribirSalida(RUTAS.procesados, `${JSON.stringify({ ...procesados, [mensajeId]: registro }, null, 2)}\n`);
}

async function leerPendientes(almacen: AlmacenamientoPort): Promise<Pendientes> {
  const texto = await almacen.leerSalida(RUTAS.pendientes);
  return texto === null ? {} : (JSON.parse(texto) as Pendientes);
}

async function escribirPendientes(almacen: AlmacenamientoPort, pendientes: Pendientes): Promise<void> {
  await almacen.escribirSalida(RUTAS.pendientes, `${JSON.stringify(pendientes, null, 2)}\n`);
}

async function quitarPendiente(almacen: AlmacenamientoPort, mensajeId: string): Promise<void> {
  const pendientes = await leerPendientes(almacen);
  if (!(mensajeId in pendientes)) return;
  delete pendientes[mensajeId];
  await escribirPendientes(almacen, pendientes);
}

function resultado(
  estado: EstadoRegistro,
  clasificacion: Evaluacion['clasificacion'] | null,
  idContrato: string | null,
  rutaArchivo: string | null,
  motivo: string,
  camposRevision: CampoRevision[],
): ResultadoRegistro {
  return { estado, clasificacion, id_contrato: idContrato, ruta_archivo: rutaArchivo, motivo, campos_revision: camposRevision };
}
