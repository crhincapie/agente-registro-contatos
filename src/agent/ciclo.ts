import type { ProveedorLLM, ResultadoModelo, LlamadaModelo, RespuestaModelo, TurnoModelo } from '@/llm/adapter';
import { DEFINICIONES_HERRAMIENTAS } from '@/agent/herramientas-modelo';
import type { EstadoPaso, PasoHerramienta } from '@/agent/tipos';
import type { AlmacenamientoPort } from '@/storage/port';
import { ejecutarHerramienta } from '@/tools/contratos';

export const MAX_ITERACIONES = 25;
const MENSAJE_LIMITE = `Se alcanzó el límite de ${MAX_ITERACIONES} pasos en este turno. El proceso quedó parcial; puedes pedir que continúe.`;
const MENSAJE_MODELO_NO_DISPONIBLE =
  'No pude completar la respuesta porque el modelo de lenguaje no está disponible. Intenta de nuevo en unos minutos.';
const ESTADOS_DE_REVISION = ['requiere_confirmacion', 'conflicto', 'rechazado', 'duplicado', 'ya_procesado'];

export interface DependenciasCiclo {
  proveedor: ProveedorLLM;
  almacen: AlmacenamientoPort;
  sistema: string;
  fechaRegistro: string;
  sessionId: string;
}

export interface ResultadoTurno {
  texto: string;
  pasos: PasoHerramienta[];
  error: string | null;
  limiteAlcanzado: boolean;
}

export async function ejecutarTurno(
  dependencias: DependenciasCiclo,
  contexto: TurnoModelo[],
  mensajeUsuario: string,
): Promise<ResultadoTurno> {
  const inicio = contexto.length;
  contexto.push({ rol: 'usuario', texto: mensajeUsuario });
  const pasos: PasoHerramienta[] = [];

  for (let iteracion = 0; iteracion < MAX_ITERACIONES; iteracion++) {
    let respuesta: RespuestaModelo;
    try {
      respuesta = await dependencias.proveedor.turno({
        sistema: dependencias.sistema,
        herramientas: DEFINICIONES_HERRAMIENTAS,
        turnos: contexto,
      });
    } catch (error) {
      console.error('Fallo del proveedor de modelo', error instanceof Error ? error.message : 'desconocido');
      contexto.length = inicio;
      return { texto: '', pasos, error: MENSAJE_MODELO_NO_DISPONIBLE, limiteAlcanzado: false };
    }

    contexto.push({ rol: 'asistente', texto: respuesta.texto, llamadas: respuesta.llamadas });
    if (respuesta.llamadas.length === 0) {
      return { texto: respuesta.texto, pasos, error: null, limiteAlcanzado: false };
    }

    const resultados: ResultadoModelo[] = [];
    for (const llamada of respuesta.llamadas) {
      const paso = await ejecutarLlamada(llamada, dependencias);
      pasos.push(paso);
      const contenido = paso.estado === 'error' ? paso.resumen : JSON.stringify(paso.datos);
      resultados.push({ id: llamada.id, nombre: llamada.nombre, contenido, error: paso.estado === 'error' });
    }
    contexto.push({ rol: 'herramientas', resultados });
  }

  contexto.push({ rol: 'asistente', texto: MENSAJE_LIMITE, llamadas: [] });
  return { texto: MENSAJE_LIMITE, pasos, error: null, limiteAlcanzado: true };
}

async function ejecutarLlamada(llamada: LlamadaModelo, dependencias: DependenciasCiclo): Promise<PasoHerramienta> {
  const mensajeId = mensajeDeArgumentos(llamada.argumentos);
  const base = { id: llamada.id, nombre: llamada.nombre, argumentos: llamada.argumentos, mensaje_id: mensajeId };

  if (llamada.nombre === 'contratos_registrar' && esObjeto(llamada.argumentos) && 'confirmacion' in llamada.argumentos) {
    return { ...base, estado: 'error', resumen: 'La confirmación la aporta solo la persona desde el panel de confirmación.', datos: null };
  }

  const crudo = await ejecutarHerramienta(llamada.nombre, llamada.argumentos, {
    almacen: dependencias.almacen,
    fechaRegistro: dependencias.fechaRegistro,
    sessionId: dependencias.sessionId,
  });
  const respuesta = JSON.parse(crudo) as { ok: true; data: unknown } | { ok: false; error: string };
  if (!respuesta.ok) {
    return { ...base, estado: 'error', resumen: `No se pudo ejecutar: ${respuesta.error}`, datos: null };
  }
  const { estado, resumen } = describirResultado(llamada.nombre, respuesta.data);
  return { ...base, estado, resumen, datos: respuesta.data };
}

function describirResultado(nombre: string, datos: unknown): { estado: EstadoPaso; resumen: string } {
  const d = datos as Record<string, any>;
  switch (nombre) {
    case 'contratos_leer_buzon':
      return { estado: 'ok', resumen: `${d.mensajes.length} mensajes pendientes en el buzón.` };
    case 'contratos_extraer':
      return { estado: 'ok', resumen: `Datos extraídos del contrato del mensaje ${d.mensaje_id}.` };
    case 'contratos_validar':
      return { estado: 'ok', resumen: `Clasificación del mensaje: ${d.clasificacion}. ${d.motivo}`.trim() };
    case 'contratos_registrar': {
      const estado: EstadoPaso = ESTADOS_DE_REVISION.includes(d.estado) ? 'advertencia' : 'ok';
      return { estado, resumen: `Estado: ${d.estado}. ${d.motivo}`.trim() };
    }
    case 'contratos_alertas':
      return {
        estado: 'ok',
        resumen: `Vencen en 60 días: ${d.vencen.length}. Pólizas pendientes: ${d.polizas.length}. Registrados desde 2026-05-30: ${d.registrados_recientes.length}.`,
      };
    default:
      return { estado: 'ok', resumen: 'Herramienta ejecutada.' };
  }
}

function mensajeDeArgumentos(argumentos: unknown): string | null {
  if (esObjeto(argumentos) && typeof argumentos.mensaje_id === 'string') return argumentos.mensaje_id;
  return null;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}
