import { z } from 'zod';
import type { AlmacenamientoPort } from '@/storage/port';
import type { Comercial } from '@/tools/tipos';

const ID_MENSAJE = /^msg-\d{3}$/;
const NOMBRE_ADJUNTO = /^[\w.-]+$/;

const correoSchema = z.object({
  id: z.string(),
  de: z.string(),
  asunto: z.string(),
  fecha: z.string(),
  cuerpo: z.string(),
  adjuntos: z.array(z.string().regex(NOMBRE_ADJUNTO)),
});

const comercialesSchema = z.array(
  z.object({ email: z.string(), nombre: z.string(), region: z.string() }),
);

export type Correo = z.infer<typeof correoSchema>;

export function validarIdMensaje(id: string): string {
  if (!ID_MENSAJE.test(id)) {
    throw new Error('Identificador de mensaje no válido');
  }
  return id;
}

export async function listarMensajes(almacen: AlmacenamientoPort): Promise<string[]> {
  const entradas = await almacen.listarFixture('buzon');
  return entradas.filter((nombre) => ID_MENSAJE.test(nombre)).sort();
}

export async function leerCorreo(almacen: AlmacenamientoPort, mensajeId: string): Promise<Correo> {
  const id = validarIdMensaje(mensajeId);
  const texto = await almacen.leerFixture(`buzon/${id}/correo.json`);
  return correoSchema.parse(JSON.parse(texto));
}

export async function leerAdjunto(almacen: AlmacenamientoPort, mensajeId: string, nombre: string): Promise<string> {
  const id = validarIdMensaje(mensajeId);
  if (!NOMBRE_ADJUNTO.test(nombre)) {
    throw new Error('Nombre de adjunto no válido');
  }
  return almacen.leerFixture(`buzon/${id}/${nombre}`);
}

export async function leerComerciales(almacen: AlmacenamientoPort): Promise<Comercial[]> {
  const texto = await almacen.leerFixture('comerciales.json');
  return comercialesSchema.parse(JSON.parse(texto));
}
