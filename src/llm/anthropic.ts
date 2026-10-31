import type { EntradaModelo, LlamadaModelo, ProveedorLLM, RespuestaModelo, TurnoModelo } from '@/llm/adapter';

const URL_API = 'https://api.anthropic.com/v1/messages';
const VERSION_API = '2023-06-01';
const MODELO_POR_DEFECTO = 'claude-sonnet-4-5';
const TOKENS_MAXIMOS = 2048;
const TIEMPO_MAXIMO_MS = 60_000;

type BloqueSalida =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown };

interface RespuestaApi {
  content: BloqueSalida[];
  stop_reason: string;
}

export function crearProveedorAnthropic(entorno: NodeJS.ProcessEnv = process.env): ProveedorLLM {
  return {
    async turno(entrada: EntradaModelo): Promise<RespuestaModelo> {
      const clave = entorno.ANTHROPIC_API_KEY;
      if (!clave) {
        throw new Error('El modelo de lenguaje no está configurado en el servidor');
      }
      const respuesta = await fetch(URL_API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': clave,
          'anthropic-version': VERSION_API,
        },
        body: JSON.stringify({
          model: entorno.LLM_MODEL ?? MODELO_POR_DEFECTO,
          max_tokens: TOKENS_MAXIMOS,
          system: entrada.sistema,
          tools: entrada.herramientas.map((h) => ({ name: h.nombre, description: h.descripcion, input_schema: h.esquema })),
          messages: entrada.turnos.map(aMensajeApi),
        }),
        signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
      });
      if (!respuesta.ok) {
        throw new Error(`El proveedor respondió con estado ${respuesta.status}`);
      }
      return desdeRespuestaApi((await respuesta.json()) as RespuestaApi);
    },
  };
}

function aMensajeApi(turno: TurnoModelo): { role: 'user' | 'assistant'; content: unknown } {
  if (turno.rol === 'usuario') {
    return { role: 'user', content: turno.texto };
  }
  if (turno.rol === 'asistente') {
    const bloques = [
      ...(turno.texto ? [{ type: 'text', text: turno.texto }] : []),
      ...turno.llamadas.map((l) => ({ type: 'tool_use', id: l.id, name: l.nombre, input: l.argumentos })),
    ];
    return { role: 'assistant', content: bloques };
  }
  return {
    role: 'user',
    content: turno.resultados.map((r) => ({
      type: 'tool_result',
      tool_use_id: r.id,
      content: r.contenido,
      is_error: r.error,
    })),
  };
}

function desdeRespuestaApi(respuesta: RespuestaApi): RespuestaModelo {
  const texto = respuesta.content
    .filter((b): b is Extract<BloqueSalida, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  const llamadas: LlamadaModelo[] = respuesta.content
    .filter((b): b is Extract<BloqueSalida, { type: 'tool_use' }> => b.type === 'tool_use')
    .map((b) => ({ id: b.id, nombre: b.name, argumentos: b.input }));
  return { texto, llamadas };
}
