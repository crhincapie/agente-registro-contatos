import type { AlmacenamientoPort } from '@/storage/port';
import { parsearMaestro, serializarMaestro } from '@/tools/maestro-csv';
import type { FilaMaestro, MetadatoContrato, RegistroProcesado } from '@/tools/tipos';

export const RUTAS = {
  maestroFixture: 'maestro-contratos.csv',
  maestro: 'sharepoint/maestro-contratos.csv',
  metadata: 'sharepoint/contratos-metadata.json',
  historial: 'sharepoint/historial.jsonl',
  documentos: 'sharepoint/',
  procesados: 'procesados.json',
  pendientes: 'pendientes.json',
  log: 'log.jsonl',
  alertas: 'alertas.md',
} as const;

export async function asegurarSalida(almacen: AlmacenamientoPort): Promise<void> {
  if ((await almacen.leerSalida(RUTAS.maestro)) === null) {
    await almacen.copiarFixtureASalida(RUTAS.maestroFixture, RUTAS.maestro);
  }
}

export async function leerMaestro(almacen: AlmacenamientoPort): Promise<FilaMaestro[]> {
  const texto = await almacen.leerSalida(RUTAS.maestro);
  if (texto === null) {
    throw new Error('El maestro de contratos no está inicializado');
  }
  return parsearMaestro(texto);
}

export async function escribirMaestro(almacen: AlmacenamientoPort, filas: FilaMaestro[]): Promise<void> {
  await almacen.escribirSalida(RUTAS.maestro, serializarMaestro(filas));
}

export async function leerMetadatos(almacen: AlmacenamientoPort): Promise<Record<string, MetadatoContrato>> {
  const texto = await almacen.leerSalida(RUTAS.metadata);
  return texto === null ? {} : (JSON.parse(texto) as Record<string, MetadatoContrato>);
}

export async function leerHistorial(almacen: AlmacenamientoPort): Promise<Record<string, unknown>[]> {
  const texto = await almacen.leerSalida(RUTAS.historial);
  if (texto === null) return [];
  return texto
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea) as Record<string, unknown>);
}

export async function leerProcesados(almacen: AlmacenamientoPort): Promise<Record<string, RegistroProcesado>> {
  const texto = await almacen.leerSalida(RUTAS.procesados);
  return texto === null ? {} : (JSON.parse(texto) as Record<string, RegistroProcesado>);
}
