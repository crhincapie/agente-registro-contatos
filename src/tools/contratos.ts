import { z } from 'zod';
import type { AlmacenamientoPort } from '@/storage/port';
import { generarAlertas } from '@/tools/alertas';
import { leerComerciales, leerCorreo, listarMensajes } from '@/tools/buzon';
import { asegurarSalida, leerProcesados, RUTAS } from '@/tools/salida';
import { registrarMensaje, type ConfirmacionHumana } from '@/tools/registro';
import { evaluarMensaje, seleccionarDocumento } from '@/tools/validacion';

export interface ContextoHerramientas {
  almacen: AlmacenamientoPort;
  fechaRegistro: string;
  sessionId: string;
}

interface Herramienta {
  description: string;
  args: z.ZodRawShape;
  execute: (entrada: unknown, ctx: ContextoHerramientas) => Promise<unknown>;
}

function definirHerramienta<T extends z.ZodRawShape>(
  description: string,
  args: T,
  ejecutar: (entrada: z.infer<z.ZodObject<T>>, ctx: ContextoHerramientas) => Promise<unknown>,
): Herramienta {
  const esquema = z.object(args);
  return {
    description,
    args,
    execute: (entrada, ctx) => ejecutar(esquema.parse(entrada), ctx),
  };
}

const mensajeId = z.string().regex(/^msg-\d{3}$/).describe('Identificador del mensaje, por ejemplo msg-001');

const confirmacionSchema = z
  .object({
    nombre_declarado: z.string().min(1).max(120).describe('Nombre de quien confirma; se registra como identidad declarada, no verificada'),
    campos: z
      .record(z.union([z.string(), z.number(), z.null()]))
      .describe('Valor confirmado por cada campo que requiere revisión'),
  })
  .describe('Confirmación humana de los campos que requieren revisión');

export const herramientas = {
  contratos_leer_buzon: definirHerramienta(
    'Lista los mensajes del buzón que aún no han sido finalizados.',
    {},
    async (_entrada, ctx) => {
      const procesados = await leerProcesados(ctx.almacen);
      const comerciales = await leerComerciales(ctx.almacen);
      const pendientes = [];
      for (const id of await listarMensajes(ctx.almacen)) {
        if (procesados[id]) continue;
        const correo = await leerCorreo(ctx.almacen, id);
        const comercial = comerciales.find((c) => c.email.toLowerCase() === correo.de.toLowerCase());
        pendientes.push({
          mensaje_id: id,
          de: correo.de,
          asunto: correo.asunto,
          fecha: correo.fecha,
          adjuntos: correo.adjuntos,
          remitente_registrado: comercial !== undefined,
        });
      }
      return { mensajes: pendientes, finalizados: Object.keys(procesados) };
    },
  ),

  contratos_extraer: definirHerramienta(
    'Extrae los datos estructurados del contrato adjunto a un mensaje, con confianza y tipo de dato por campo.',
    { mensaje_id: mensajeId },
    async (entrada, ctx) => {
      const correo = await leerCorreo(ctx.almacen, entrada.mensaje_id);
      const documento = await seleccionarDocumento(ctx.almacen, entrada.mensaje_id, correo.adjuntos);
      return { mensaje_id: entrada.mensaje_id, contrato: documento };
    },
  ),

  contratos_validar: definirHerramienta(
    'Clasifica un mensaje (nuevo, actualización, duplicado, rechazado o conflicto) y lista los campos que requieren confirmación.',
    { mensaje_id: mensajeId },
    async (entrada, ctx) => evaluarMensaje(ctx.almacen, entrada.mensaje_id, ctx.fechaRegistro),
  ),

  contratos_registrar: definirHerramienta(
    'Registra un mensaje en el maestro. Si requiere revisión, devuelve los campos a confirmar; con confirmación los registra.',
    { mensaje_id: mensajeId, confirmacion: confirmacionSchema.optional() },
    (entrada, ctx) =>
      ctx.almacen.exclusivo(() =>
        registrarMensaje(
          ctx.almacen,
          entrada.mensaje_id,
          { fechaRegistro: ctx.fechaRegistro, sessionId: ctx.sessionId },
          entrada.confirmacion as ConfirmacionHumana | undefined,
        ),
      ),
  ),

  contratos_alertas: definirHerramienta(
    'Genera el reporte de alertas de vencimientos, pólizas pendientes y registros recientes.',
    { hoy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Fecha de referencia en formato YYYY-MM-DD') },
    (entrada, ctx) => generarAlertas(ctx.almacen, entrada.hoy),
  ),
};

export type NombreHerramienta = keyof typeof herramientas;

export async function ejecutarHerramienta(nombre: string, entrada: unknown, ctx: ContextoHerramientas): Promise<string> {
  const herramienta = Object.hasOwn(herramientas, nombre) ? herramientas[nombre as NombreHerramienta] : undefined;
  let respuesta: { ok: true; data: unknown } | { ok: false; error: string };
  try {
    if (!herramienta) throw new Error(`Herramienta desconocida: ${nombre}`);
    await asegurarSalida(ctx.almacen);
    respuesta = { ok: true, data: await herramienta.execute(entrada, ctx) };
  } catch (error) {
    respuesta = { ok: false, error: mensajeDeError(error) };
  }
  await ctx.almacen.anexarSalida(
    RUTAS.log,
    JSON.stringify({
      ts: new Date().toISOString(),
      herramienta: nombre,
      mensaje_id: mensajeDe(entrada),
      ok: respuesta.ok,
      error: respuesta.ok ? null : respuesta.error,
    }),
  );
  return JSON.stringify(respuesta);
}

function mensajeDeError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return `Argumentos no válidos: ${error.issues.map((issue) => issue.path.join('.') || 'entrada').join(', ')}`;
  }
  return error instanceof Error ? error.message : 'Error desconocido';
}

function mensajeDe(entrada: unknown): string | null {
  if (typeof entrada === 'object' && entrada !== null && 'mensaje_id' in entrada) {
    return String(entrada.mensaje_id);
  }
  return null;
}
