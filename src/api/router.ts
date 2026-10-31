import { z } from 'zod';
import { chatear, confirmarRegistro, obtenerSesion, type DependenciasServicio } from '@/agent/servicio';
import { cargarInstrucciones } from '@/agent/instrucciones';
import { SesionesNube } from '@/storage/sesiones-nube';
import { AlmacenamientoNube } from '@/storage/nube';
import { crearClienteServidor } from '@/storage/cliente-servidor';
import { crearProveedorAnthropic } from '@/llm/anthropic';

const FECHA_REFERENCIA_POR_DEFECTO = '2026-09-03';
const MENSAJE_MAX = 2000;

const cuerpoChat = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  mensaje: z.string().trim().min(1).max(MENSAJE_MAX),
});

const cuerpoConfirmar = z.object({
  sessionId: z.string().uuid(),
  mensaje_id: z.string().regex(/^msg-\d{3}$/),
  nombre_declarado: z.string().trim().min(1).max(120),
  campos: z.record(z.union([z.string(), z.number(), z.null()])),
});

export async function manejarApi(peticion: Request): Promise<Response> {
  try {
    const url = new URL(peticion.url);
    const ruta = url.pathname.replace(/\/+$/, '');

    if (ruta === '/api/health' && peticion.method === 'GET') return await salud();
    if (ruta === '/api/chat' && peticion.method === 'POST') return await chat(peticion);
    if (ruta === '/api/confirmar' && peticion.method === 'POST') return await confirmar(peticion);
    const coincidencia = /^\/api\/sessions\/([0-9a-f-]{36})$/i.exec(ruta);
    if (coincidencia && peticion.method === 'GET') return await sesion(coincidencia[1]);

    return json({ error: 'Ruta no encontrada' }, 404);
  } catch (error) {
    console.error('Error en la API', error instanceof Error ? error.message : 'desconocido');
    return json({ error: 'Ocurrió un error interno. Intenta de nuevo.' }, 500);
  }
}

async function salud(): Promise<Response> {
  let baseDeDatos = true;
  try {
    const { error } = await crearClienteServidor().from('salida_archivos').select('ruta').limit(1);
    baseDeDatos = error === null;
  } catch {
    baseDeDatos = false;
  }
  return json({ ok: baseDeDatos, base_datos: baseDeDatos, llm_configurado: Boolean(process.env.ANTHROPIC_API_KEY) });
}

async function chat(peticion: Request): Promise<Response> {
  const entrada = await leerCuerpo(peticion, cuerpoChat);
  if (!entrada.ok) return entrada.respuesta;
  const resultado = await chatear(await dependencias(), entrada.datos.sessionId ?? null, entrada.datos.mensaje);
  if (!resultado) return json({ error: 'La sesión no existe.' }, 404);
  return json({ sesion: resultado.sesion, turno: resultado.turno });
}

async function confirmar(peticion: Request): Promise<Response> {
  const entrada = await leerCuerpo(peticion, cuerpoConfirmar);
  if (!entrada.ok) return entrada.respuesta;
  const resultado = await confirmarRegistro(await dependencias(), entrada.datos.sessionId, entrada.datos);
  if (!resultado) return json({ error: 'La sesión no existe.' }, 404);
  if (!resultado.ok) return json({ error: resultado.error }, 422);
  return json({ sesion: resultado.sesion });
}

async function sesion(id: string): Promise<Response> {
  const vista = await obtenerSesion(crearSesionesNube(), id);
  if (!vista) return json({ error: 'La sesión no existe.' }, 404);
  return json({ sesion: vista });
}

async function dependencias(): Promise<DependenciasServicio> {
  const cliente = crearClienteServidor();
  const raiz = process.cwd();
  return {
    sesiones: new SesionesNube(cliente),
    almacen: new AlmacenamientoNube(cliente, raiz),
    proveedor: crearProveedorAnthropic(),
    sistema: await cargarInstrucciones(raiz),
    fechaRegistro: process.env.FECHA_REFERENCIA ?? FECHA_REFERENCIA_POR_DEFECTO,
  };
}

function crearSesionesNube(): SesionesNube {
  return new SesionesNube(crearClienteServidor());
}

type Lectura<T> = { ok: true; datos: T } | { ok: false; respuesta: Response };

async function leerCuerpo<T>(peticion: Request, esquema: z.ZodType<T>): Promise<Lectura<T>> {
  let crudo: unknown;
  try {
    crudo = await peticion.json();
  } catch {
    return { ok: false, respuesta: json({ error: 'El cuerpo debe ser JSON válido.' }, 400) };
  }
  const resultado = esquema.safeParse(crudo);
  if (!resultado.success) {
    return { ok: false, respuesta: json({ error: 'Los datos enviados no son válidos.' }, 400) };
  }
  return { ok: true, datos: resultado.data };
}

function json(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
