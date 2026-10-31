import type { TurnoModelo } from '@/llm/adapter';
import type { CampoRevision } from '@/tools/tipos';

export type EstadoPaso = 'ok' | 'advertencia' | 'error';

export interface PasoHerramienta {
  id: string;
  nombre: string;
  argumentos: unknown;
  mensaje_id: string | null;
  estado: EstadoPaso;
  resumen: string;
  datos: unknown;
}

export interface EntradaUsuario {
  tipo: 'usuario';
  texto: string;
}

export interface EntradaAgente {
  tipo: 'agente';
  texto: string;
  pasos: PasoHerramienta[];
  error: string | null;
  limiteAlcanzado: boolean;
}

export interface EntradaConfirmacion {
  tipo: 'confirmacion';
  mensaje_id: string;
  id_contrato: string | null;
  nombre_declarado: string;
  estado: string;
  resumen: string;
}

export type EntradaHistorial = EntradaUsuario | EntradaAgente | EntradaConfirmacion;

export interface Pendiente {
  mensaje_id: string;
  id_contrato: string | null;
  clasificacion: string | null;
  motivo: string;
  campos_revision: CampoRevision[];
}

export interface Sesion {
  id: string;
  historial: EntradaHistorial[];
  contexto: TurnoModelo[];
  pendientes: Pendiente[];
}

export interface FilaResumen {
  mensaje_id: string;
  estado: string;
  id_contrato: string | null;
}

export interface VistaSesion {
  id: string;
  historial: EntradaHistorial[];
  pendientes: Pendiente[];
  resumen: FilaResumen[];
}

export interface SesionesPort {
  obtener(id: string): Promise<Sesion | null>;
  crear(id: string): Promise<Sesion>;
  guardar(sesion: Sesion): Promise<void>;
}
