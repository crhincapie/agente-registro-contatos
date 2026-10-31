export interface LlamadaModelo {
  id: string;
  nombre: string;
  argumentos: unknown;
}

export interface ResultadoModelo {
  id: string;
  nombre: string;
  contenido: string;
  error: boolean;
}

export type TurnoModelo =
  | { rol: 'usuario'; texto: string }
  | { rol: 'asistente'; texto: string; llamadas: LlamadaModelo[] }
  | { rol: 'herramientas'; resultados: ResultadoModelo[] };

export interface DefinicionHerramienta {
  nombre: string;
  descripcion: string;
  esquema: Record<string, unknown>;
}

export interface RespuestaModelo {
  texto: string;
  llamadas: LlamadaModelo[];
}

export interface EntradaModelo {
  sistema: string;
  herramientas: DefinicionHerramienta[];
  turnos: TurnoModelo[];
}

export interface ProveedorLLM {
  turno(entrada: EntradaModelo): Promise<RespuestaModelo>;
}
