import { randomUUID } from 'node:crypto';
import { ejecutarTurno, type ResultadoTurno } from '@/agent/ciclo';
import type { EntradaHistorial, FilaResumen, Pendiente, SesionesPort, Sesion, VistaSesion } from '@/agent/tipos';
import type { ProveedorLLM } from '@/llm/adapter';
import type { AlmacenamientoPort } from '@/storage/port';
import { ejecutarHerramienta } from '@/tools/contratos';
import type { ResultadoRegistro } from '@/tools/registro';

export interface DependenciasServicio {
  sesiones: SesionesPort;
  almacen: AlmacenamientoPort;
  proveedor: ProveedorLLM;
  sistema: string;
  fechaRegistro: string;
}

export interface RespuestaChat {
  sesion: VistaSesion;
  turno: ResultadoTurno;
}

export interface DatosConfirmacion {
  mensaje_id: string;
  nombre_declarado: string;
  campos: Record<string, string | number | null>;
}

export async function chatear(
  dependencias: DependenciasServicio,
  sessionId: string | null,
  mensaje: string,
): Promise<RespuestaChat | null> {
  const sesion = sessionId === null
    ? await dependencias.sesiones.crear(randomUUID())
    : await dependencias.sesiones.obtener(sessionId);
  if (!sesion) return null;

  const turno = await ejecutarTurno(
    {
      proveedor: dependencias.proveedor,
      almacen: dependencias.almacen,
      sistema: dependencias.sistema,
      fechaRegistro: dependencias.fechaRegistro,
      sessionId: sesion.id,
    },
    sesion.contexto,
    mensaje,
  );

  sesion.historial.push({ tipo: 'usuario', texto: mensaje });
  sesion.historial.push({ tipo: 'agente', texto: turno.texto, pasos: turno.pasos, error: turno.error, limiteAlcanzado: turno.limiteAlcanzado });
  for (const paso of turno.pasos) {
    if (paso.nombre === 'contratos_registrar' && paso.mensaje_id && paso.estado !== 'error') {
      actualizarPendientes(sesion, paso.mensaje_id, paso.datos as ResultadoRegistro);
    }
  }
  await dependencias.sesiones.guardar(sesion);
  return { sesion: vista(sesion), turno };
}

export async function confirmarRegistro(
  dependencias: DependenciasServicio,
  sessionId: string,
  datos: DatosConfirmacion,
): Promise<{ ok: true; sesion: VistaSesion } | { ok: false; error: string } | null> {
  const sesion = await dependencias.sesiones.obtener(sessionId);
  if (!sesion) return null;

  const pendiente = sesion.pendientes.find((p) => p.mensaje_id === datos.mensaje_id);
  if (!pendiente) return { ok: false, error: 'No hay una confirmación pendiente para ese mensaje.' };
  if (!mismosCampos(pendiente, datos.campos)) {
    return { ok: false, error: 'La confirmación debe incluir exactamente los campos que se mostraron.' };
  }

  const crudo = await ejecutarHerramienta(
    'contratos_registrar',
    { mensaje_id: datos.mensaje_id, confirmacion: { nombre_declarado: datos.nombre_declarado, campos: datos.campos } },
    { almacen: dependencias.almacen, fechaRegistro: dependencias.fechaRegistro, sessionId: sesion.id },
  );
  const respuesta = JSON.parse(crudo) as { ok: true; data: ResultadoRegistro } | { ok: false; error: string };
  if (!respuesta.ok) return { ok: false, error: respuesta.error };
  if (respuesta.data.estado !== 'registrado' && respuesta.data.estado !== 'actualizado') {
    return { ok: false, error: respuesta.data.motivo };
  }

  sesion.pendientes = sesion.pendientes.filter((p) => p.mensaje_id !== datos.mensaje_id);
  const entrada: EntradaHistorial = {
    tipo: 'confirmacion',
    mensaje_id: datos.mensaje_id,
    id_contrato: respuesta.data.id_contrato,
    nombre_declarado: datos.nombre_declarado.trim(),
    estado: respuesta.data.estado,
    resumen: respuesta.data.motivo,
  };
  sesion.historial.push(entrada);
  await dependencias.sesiones.guardar(sesion);
  return { ok: true, sesion: vista(sesion) };
}

export async function obtenerSesion(sesiones: SesionesPort, id: string): Promise<VistaSesion | null> {
  const sesion = await sesiones.obtener(id);
  return sesion ? vista(sesion) : null;
}

function actualizarPendientes(sesion: Sesion, mensajeId: string, datos: ResultadoRegistro): void {
  const sinEste = sesion.pendientes.filter((p) => p.mensaje_id !== mensajeId);
  if (datos.estado !== 'requiere_confirmacion') {
    sesion.pendientes = sinEste;
    return;
  }
  const pendiente: Pendiente = {
    mensaje_id: mensajeId,
    id_contrato: datos.id_contrato,
    clasificacion: datos.clasificacion,
    motivo: datos.motivo,
    campos_revision: datos.campos_revision,
  };
  sesion.pendientes = [...sinEste, pendiente];
}

function mismosCampos(pendiente: Pendiente, campos: Record<string, unknown>): boolean {
  const esperados = pendiente.campos_revision.map((c) => c.campo).sort();
  const recibidos = Object.keys(campos).sort();
  return esperados.length === recibidos.length && esperados.every((campo, i) => campo === recibidos[i]);
}

function vista(sesion: Sesion): VistaSesion {
  return {
    id: sesion.id,
    historial: sesion.historial,
    pendientes: sesion.pendientes,
    resumen: resumenDe(sesion.historial),
  };
}

function resumenDe(historial: EntradaHistorial[]): FilaResumen[] {
  const porMensaje = new Map<string, FilaResumen>();
  for (const entrada of historial) {
    if (entrada.tipo === 'confirmacion') {
      porMensaje.set(entrada.mensaje_id, { mensaje_id: entrada.mensaje_id, estado: entrada.estado, id_contrato: entrada.id_contrato });
    }
    if (entrada.tipo === 'agente') {
      for (const paso of entrada.pasos) {
        if (paso.nombre !== 'contratos_registrar' || !paso.mensaje_id || paso.estado === 'error') continue;
        const datos = paso.datos as ResultadoRegistro;
        porMensaje.set(paso.mensaje_id, { mensaje_id: paso.mensaje_id, estado: datos.estado, id_contrato: datos.id_contrato });
      }
    }
  }
  return [...porMensaje.values()].sort((a, b) => a.mensaje_id.localeCompare(b.mensaje_id));
}
