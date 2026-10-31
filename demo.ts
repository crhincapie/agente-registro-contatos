import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlmacenamientoLocal } from '@/storage/local';
import { ejecutarHerramienta, type ContextoHerramientas } from '@/tools/contratos';
import type { ResultadoRegistro } from '@/tools/registro';
import { asegurarSalida } from '@/tools/salida';

const RAIZ = fileURLToPath(new URL('.', import.meta.url));
const FECHA_DEMO = '2026-09-03';
const CONFIRMADOR = 'Revisor de demostración';

type Respuesta<T> = { ok: true; data: T } | { ok: false; error: string };

interface ResultadoBuzon {
  mensajes: { mensaje_id: string }[];
}

async function invocar<T>(nombre: string, entrada: unknown, ctx: ContextoHerramientas): Promise<T> {
  const respuesta = JSON.parse(await ejecutarHerramienta(nombre, entrada, ctx)) as Respuesta<T>;
  if (!respuesta.ok) throw new Error(`${nombre}: ${respuesta.error}`);
  return respuesta.data;
}

function linea(resultado: ResultadoRegistro): string {
  const contrato = resultado.id_contrato ?? 'sin contrato';
  return `  ${contrato.padEnd(16)} ${resultado.estado.padEnd(22)} ${resultado.motivo}`;
}

async function main(): Promise<void> {
  await rm(resolve(RAIZ, 'out'), { recursive: true, force: true });
  const almacen = new AlmacenamientoLocal(RAIZ);
  await asegurarSalida(almacen);
  const ctx: ContextoHerramientas = { almacen, fechaRegistro: FECHA_DEMO, sessionId: 'demo-local' };

  const buzon = await invocar<ResultadoBuzon>('contratos_leer_buzon', {}, ctx);
  console.log(`Mensajes pendientes: ${buzon.mensajes.length}`);

  console.log('\nPrimera pasada');
  const pendientesConfirmacion: { mensaje_id: string; resultado: ResultadoRegistro }[] = [];
  for (const { mensaje_id } of buzon.mensajes) {
    const resultado = await invocar<ResultadoRegistro>('contratos_registrar', { mensaje_id }, ctx);
    console.log(`${mensaje_id}${linea(resultado)}`);
    if (resultado.estado === 'requiere_confirmacion') {
      pendientesConfirmacion.push({ mensaje_id, resultado });
    }
  }

  console.log('\nConfirmación de campos revisados');
  for (const { mensaje_id, resultado } of pendientesConfirmacion) {
    const confirmacion = {
      nombre_declarado: CONFIRMADOR,
      campos: Object.fromEntries(resultado.campos_revision.map((campo) => [campo.campo, campo.valor_presentado])),
    };
    const final = await invocar<ResultadoRegistro>('contratos_registrar', { mensaje_id, confirmacion }, ctx);
    console.log(`${mensaje_id}${linea(final)}`);
  }

  const alertas = await invocar<{ ruta: string; vencen: unknown[]; polizas: unknown[]; registrados_recientes: unknown[] }>(
    'contratos_alertas',
    { hoy: FECHA_DEMO },
    ctx,
  );
  console.log(`\nAlertas (${FECHA_DEMO}): ${alertas.vencen.length} por vencer, ${alertas.polizas.length} pólizas pendientes, ${alertas.registrados_recientes.length} registros recientes`);
  console.log(`Reporte: ${alertas.ruta}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
