import type { SupabaseClient } from '@supabase/supabase-js';
import type { Sesion, SesionesPort } from '@/agent/tipos';

export class SesionesNube implements SesionesPort {
  constructor(private readonly cliente: SupabaseClient) {}

  async obtener(id: string): Promise<Sesion | null> {
    const { data, error } = await this.cliente
      .from('agente_sesiones')
      .select('id, historial_ui, contexto_modelo, pendientes')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('No se pudo leer la sesión');
    if (!data) return null;
    return {
      id: data.id,
      historial: data.historial_ui,
      contexto: data.contexto_modelo,
      pendientes: data.pendientes,
    };
  }

  async crear(id: string): Promise<Sesion> {
    const sesion: Sesion = { id, historial: [], contexto: [], pendientes: [] };
    await this.guardar(sesion);
    return sesion;
  }

  async guardar(sesion: Sesion): Promise<void> {
    const { error } = await this.cliente.from('agente_sesiones').upsert({
      id: sesion.id,
      historial_ui: sesion.historial,
      contexto_modelo: sesion.contexto,
      pendientes: sesion.pendientes,
      actualizada_en: new Date().toISOString(),
    });
    if (error) throw new Error('No se pudo guardar la sesión');
  }
}
