import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function crearClienteServidor(entorno: NodeJS.ProcessEnv = process.env): SupabaseClient {
  const url = entorno.SUPABASE_URL;
  const clave = entorno.SUPABASE_SECRET_KEY || entorno.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    throw new Error('La base de datos no está configurada en el servidor');
  }
  return createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
