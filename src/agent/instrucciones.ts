import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ARCHIVOS_INSTRUCCIONES = ['agent/prompt.md', 'src/knowledge/registro-contratos.md'];

export async function cargarInstrucciones(raiz: string): Promise<string> {
  const partes = await Promise.all(ARCHIVOS_INSTRUCCIONES.map((ruta) => readFile(resolve(raiz, ruta), 'utf8')));
  return partes.join('\n\n---\n\n');
}
