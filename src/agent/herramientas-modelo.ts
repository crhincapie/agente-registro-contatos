import type { DefinicionHerramienta } from '@/llm/adapter';
import { herramientas, type NombreHerramienta } from '@/tools/contratos';

const IDENTIFICADOR_MENSAJE = { type: 'string', pattern: '^msg-\\d{3}$', description: 'Identificador del mensaje, por ejemplo msg-001' };

const ESQUEMAS: Record<NombreHerramienta, Record<string, unknown>> = {
  contratos_leer_buzon: { type: 'object', properties: {}, additionalProperties: false },
  contratos_extraer: {
    type: 'object',
    properties: { mensaje_id: IDENTIFICADOR_MENSAJE },
    required: ['mensaje_id'],
    additionalProperties: false,
  },
  contratos_validar: {
    type: 'object',
    properties: { mensaje_id: IDENTIFICADOR_MENSAJE },
    required: ['mensaje_id'],
    additionalProperties: false,
  },
  contratos_registrar: {
    type: 'object',
    properties: { mensaje_id: IDENTIFICADOR_MENSAJE },
    required: ['mensaje_id'],
    additionalProperties: false,
  },
  contratos_alertas: {
    type: 'object',
    properties: {
      hoy: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Fecha de referencia en formato YYYY-MM-DD' },
    },
    required: ['hoy'],
    additionalProperties: false,
  },
};

export const DEFINICIONES_HERRAMIENTAS: DefinicionHerramienta[] = (
  Object.keys(ESQUEMAS) as NombreHerramienta[]
).map((nombre) => ({
  nombre,
  descripcion: herramientas[nombre].description,
  esquema: ESQUEMAS[nombre],
}));
