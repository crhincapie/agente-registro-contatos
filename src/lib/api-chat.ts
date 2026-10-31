import type { VistaSesion } from '@/agent/tipos';
import type { ResultadoTurno } from '@/agent/ciclo';

export interface RespuestaChat {
  sesion: VistaSesion;
  turno: ResultadoTurno;
}

export interface DatosConfirmacionEnviados {
  sessionId: string;
  mensaje_id: string;
  nombre_declarado: string;
  campos: Record<string, string | number | null>;
}

const MENSAJE_SIN_CONEXION = 'No hay conexión con el servidor. Revisa tu conexión e intenta de nuevo.';
const MENSAJE_FORMATO = 'La respuesta del servidor no tiene el formato esperado.';

export async function enviarMensaje(sessionId: string | null, mensaje: string): Promise<RespuestaChat> {
  const respuesta = await pedir<RespuestaChat>('/api/chat', { sessionId, mensaje });
  if (!respuesta.sesion || !respuesta.turno) throw new Error(MENSAJE_FORMATO);
  return respuesta;
}

export async function confirmarRegistro(datos: DatosConfirmacionEnviados): Promise<VistaSesion> {
  const respuesta = await pedir<{ sesion: VistaSesion }>('/api/confirmar', datos);
  if (!respuesta.sesion) throw new Error(MENSAJE_FORMATO);
  return respuesta.sesion;
}

export async function obtenerSesion(id: string): Promise<VistaSesion> {
  const respuesta = await pedir<{ sesion: VistaSesion }>(`/api/sessions/${id}`);
  if (!respuesta.sesion) throw new Error(MENSAJE_FORMATO);
  return respuesta.sesion;
}

async function pedir<T>(ruta: string, cuerpo?: unknown): Promise<T & { error?: string }> {
  let respuesta: Response;
  try {
    respuesta = await fetch(ruta, {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error(MENSAJE_SIN_CONEXION);
  }
  const datos = (await respuesta.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!respuesta.ok) {
    throw new Error(datos?.error ?? `La solicitud falló (${respuesta.status}).`);
  }
  if (!datos) throw new Error(MENSAJE_FORMATO);
  return datos;
}
