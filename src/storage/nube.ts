import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AlmacenamientoPort } from '@/storage/port';
import { AlmacenamientoLocal } from '@/storage/local';
import type { SupabaseClient } from '@supabase/supabase-js';

const DURACION_BLOQUEO_MS = 30_000;
const ESPERA_BLOQUEO_MAX_MS = 10_000;
const PAUSA_BLOQUEO_MS = 50;

export class AlmacenamientoNube implements AlmacenamientoPort {
  private readonly fixtures: AlmacenamientoLocal;

  constructor(
    private readonly cliente: SupabaseClient,
    raiz: string,
  ) {
    this.fixtures = new AlmacenamientoLocal(raiz);
  }

  leerFixture(ruta: string): Promise<string> {
    return this.fixtures.leerFixture(ruta);
  }

  listarFixture(ruta: string): Promise<string[]> {
    return this.fixtures.listarFixture(ruta);
  }

  async leerSalida(ruta: string): Promise<string | null> {
    const { data, error } = await this.cliente
      .from('salida_archivos')
      .select('contenido')
      .eq('ruta', ruta)
      .maybeSingle();
    if (error) throw new Error(`No se pudo leer ${ruta}`);
    return data?.contenido ?? null;
  }

  async escribirSalida(ruta: string, contenido: string): Promise<void> {
    const { error } = await this.cliente
      .from('salida_archivos')
      .upsert({ ruta, contenido, actualizado_en: new Date().toISOString() });
    if (error) throw new Error(`No se pudo escribir ${ruta}`);
  }

  async anexarSalida(ruta: string, linea: string): Promise<void> {
    const { error } = await this.cliente.rpc('anexar_salida', { p_ruta: ruta, p_linea: linea });
    if (error) throw new Error(`No se pudo anexar a ${ruta}`);
  }

  async copiarFixtureASalida(origen: string, destino: string): Promise<void> {
    await this.escribirSalida(destino, await this.leerFixture(origen));
  }

  async exclusivo<T>(operacion: () => Promise<T>): Promise<T> {
    const propietario = randomUUID();
    const limite = Date.now() + ESPERA_BLOQUEO_MAX_MS;
    while (!(await this.intentarBloqueo(propietario))) {
      if (Date.now() > limite) throw new Error('No se pudo obtener el bloqueo del maestro');
      await new Promise((resolver) => setTimeout(resolver, PAUSA_BLOQUEO_MS));
    }
    try {
      return await operacion();
    } finally {
      const { error } = await this.cliente.rpc('liberar_bloqueo', { p_nombre: 'maestro', p_propietario: propietario });
      if (error) throw new Error('No se pudo liberar el bloqueo del maestro');
    }
  }

  private async intentarBloqueo(propietario: string): Promise<boolean> {
    const { data, error } = await this.cliente.rpc('adquirir_bloqueo', {
      p_nombre: 'maestro',
      p_propietario: propietario,
      p_duracion_ms: DURACION_BLOQUEO_MS,
    });
    if (error) throw new Error('No se pudo consultar el bloqueo del maestro');
    return data === true;
  }
}
