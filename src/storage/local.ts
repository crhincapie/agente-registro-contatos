import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { AlmacenamientoPort } from '@/storage/port';

const CERROJO = '.lock';
const VENCIMIENTO_CERROJO_MS = 30_000;
const ESPERA_CERROJO_MAX_MS = 10_000;

export class AlmacenamientoLocal implements AlmacenamientoPort {
  private readonly fixtures: string;
  private readonly salida: string;

  constructor(raiz: string) {
    this.fixtures = resolve(raiz, 'fixtures/reto-02');
    this.salida = resolve(raiz, 'out');
  }

  leerFixture(ruta: string): Promise<string> {
    return readFile(dentro(this.fixtures, ruta), 'utf8');
  }

  listarFixture(ruta: string): Promise<string[]> {
    return readdir(dentro(this.fixtures, ruta));
  }

  async leerSalida(ruta: string): Promise<string | null> {
    try {
      return await readFile(dentro(this.salida, ruta), 'utf8');
    } catch (error) {
      if (esNoExiste(error)) return null;
      throw error;
    }
  }

  async escribirSalida(ruta: string, contenido: string): Promise<void> {
    const destino = dentro(this.salida, ruta);
    await mkdir(dirname(destino), { recursive: true });
    const temporal = `${destino}.${randomUUID()}.tmp`;
    await writeFile(temporal, contenido, 'utf8');
    await rename(temporal, destino);
  }

  async anexarSalida(ruta: string, linea: string): Promise<void> {
    const destino = dentro(this.salida, ruta);
    await mkdir(dirname(destino), { recursive: true });
    await appendFile(destino, `${linea}\n`, 'utf8');
  }

  async copiarFixtureASalida(origen: string, destino: string): Promise<void> {
    await this.escribirSalida(destino, await this.leerFixture(origen));
  }

  async exclusivo<T>(operacion: () => Promise<T>): Promise<T> {
    const cerrojo = dentro(this.salida, CERROJO);
    await mkdir(this.salida, { recursive: true });
    const propietario = randomUUID();
    const limite = Date.now() + ESPERA_CERROJO_MAX_MS;
    while (!(await intentarAdquirir(cerrojo, propietario))) {
      if (Date.now() > limite) throw new Error('No se pudo obtener el bloqueo del maestro');
      await new Promise((resolver) => setTimeout(resolver, 50));
    }
    try {
      return await operacion();
    } finally {
      await liberar(cerrojo, propietario);
    }
  }
}

function dentro(base: string, ruta: string): string {
  const destino = resolve(base, ruta);
  if (!destino.startsWith(base + sep)) {
    throw new Error('Ruta fuera del área permitida');
  }
  return destino;
}

function esNoExiste(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function intentarAdquirir(ruta: string, propietario: string): Promise<boolean> {
  const contenido = JSON.stringify({ propietario, expira: Date.now() + VENCIMIENTO_CERROJO_MS });
  try {
    await writeFile(ruta, contenido, { flag: 'wx' });
    return true;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
  }
  try {
    const previo = JSON.parse(await readFile(ruta, 'utf8')) as { expira: number };
    if (previo.expira < Date.now()) await unlink(ruta);
  } catch (error) {
    if (!esNoExiste(error) && !(error instanceof SyntaxError)) throw error;
  }
  return false;
}

async function liberar(ruta: string, propietario: string): Promise<void> {
  try {
    const previo = JSON.parse(await readFile(ruta, 'utf8')) as { propietario: string };
    if (previo.propietario === propietario) await unlink(ruta);
  } catch (error) {
    if (!esNoExiste(error)) throw error;
  }
}
