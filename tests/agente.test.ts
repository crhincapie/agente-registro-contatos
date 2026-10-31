import assert from 'node:assert/strict';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chatear, confirmarRegistro, type DependenciasServicio } from '@/agent/servicio';
import { MAX_ITERACIONES } from '@/agent/ciclo';
import type { Sesion, SesionesPort } from '@/agent/tipos';
import type { EntradaModelo, ProveedorLLM, RespuestaModelo } from '@/llm/adapter';
import { AlmacenamientoLocal } from '@/storage/local';
import { asegurarSalida } from '@/tools/salida';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const FECHA = '2026-09-03';
const directorios: string[] = [];

after(async () => {
  await Promise.all(directorios.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function nuevoAlmacen(): Promise<AlmacenamientoLocal> {
  const dir = await mkdtemp(join(tmpdir(), 'agente-'));
  directorios.push(dir);
  await cp(resolve(RAIZ, 'fixtures/reto-02'), join(dir, 'fixtures/reto-02'), { recursive: true });
  const almacen = new AlmacenamientoLocal(dir);
  await asegurarSalida(almacen);
  return almacen;
}

function sesionesEnMemoria(): SesionesPort & { guardada(): Sesion | undefined } {
  const mapa = new Map<string, Sesion>();
  return {
    async obtener(id) {
      const s = mapa.get(id);
      return s ? structuredClone(s) : null;
    },
    async crear(id) {
      const s: Sesion = { id, historial: [], contexto: [], pendientes: [] };
      mapa.set(id, s);
      return structuredClone(s);
    },
    async guardar(sesion) {
      mapa.set(sesion.id, structuredClone(sesion));
    },
    guardada() {
      return [...mapa.values()][0];
    },
  };
}

function proveedorGuion(respuestas: RespuestaModelo[]): ProveedorLLM & { entradas: EntradaModelo[] } {
  const entradas: EntradaModelo[] = [];
  let indice = 0;
  return {
    entradas,
    async turno(entrada) {
      entradas.push(structuredClone(entrada));
      const respuesta = respuestas[indice] ?? { texto: 'Listo.', llamadas: [] };
      indice += 1;
      return respuesta;
    },
  };
}

function proveedorQueFalla(): ProveedorLLM {
  return {
    async turno() {
      throw new Error('red caída');
    },
  };
}

async function dependencias(proveedor: ProveedorLLM, sesiones: SesionesPort): Promise<DependenciasServicio> {
  return {
    sesiones,
    almacen: await nuevoAlmacen(),
    proveedor,
    sistema: 'prueba',
    fechaRegistro: FECHA,
  };
}

describe('ciclo conversacional del agente', () => {
  it('ejecuta una herramienta y devuelve la respuesta final', async () => {
    const sesiones = sesionesEnMemoria();
    const proveedor = proveedorGuion([
      { texto: '', llamadas: [{ id: 'c1', nombre: 'contratos_leer_buzon', argumentos: {} }] },
      { texto: 'Hay seis mensajes pendientes.', llamadas: [] },
    ]);
    const respuesta = await chatear(await dependencias(proveedor, sesiones), null, 'Procesa el buzón');
    assert.ok(respuesta);
    assert.equal(respuesta.turno.texto, 'Hay seis mensajes pendientes.');
    assert.equal(respuesta.turno.pasos.length, 1);
    assert.equal(respuesta.turno.pasos[0].estado, 'ok');
    assert.equal(respuesta.turno.limiteAlcanzado, false);
    assert.equal(respuesta.sesion.historial.length, 2);
  });

  it('bloquea que el modelo envíe una confirmación', async () => {
    const sesiones = sesionesEnMemoria();
    const proveedor = proveedorGuion([
      {
        texto: '',
        llamadas: [{ id: 'c1', nombre: 'contratos_registrar', argumentos: { mensaje_id: 'msg-006', confirmacion: { nombre_declarado: 'X', campos: {} } } }],
      },
      { texto: 'No pude registrar.', llamadas: [] },
    ]);
    const respuesta = await chatear(await dependencias(proveedor, sesiones), null, 'Confirma msg-006');
    assert.ok(respuesta);
    assert.equal(respuesta.turno.pasos[0].estado, 'error');
    assert.equal(respuesta.sesion.pendientes.length, 0);
  });

  it('devuelve un mensaje claro y revierte el contexto si el modelo falla', async () => {
    const sesiones = sesionesEnMemoria();
    const respuesta = await chatear(await dependencias(proveedorQueFalla(), sesiones), null, 'Hola');
    assert.ok(respuesta);
    assert.match(respuesta.turno.error ?? '', /modelo de lenguaje no está disponible/);
    assert.equal(sesiones.guardada()?.contexto.length, 0);
  });

  it('corta el ciclo al llegar al límite de iteraciones', async () => {
    const sesiones = sesionesEnMemoria();
    const bucle: ProveedorLLM = {
      async turno() {
        return { texto: '', llamadas: [{ id: 'c', nombre: 'contratos_leer_buzon', argumentos: {} }] };
      },
    };
    const respuesta = await chatear(await dependencias(bucle, sesiones), null, 'Bucle');
    assert.ok(respuesta);
    assert.equal(respuesta.turno.limiteAlcanzado, true);
    assert.equal(respuesta.turno.pasos.length, MAX_ITERACIONES);
  });
});

describe('confirmación humana de msg-006', () => {
  it('exige los campos exactos y registra solo tras confirmar', async () => {
    const sesiones = sesionesEnMemoria();
    const proveedor = proveedorGuion([
      { texto: '', llamadas: [{ id: 'c1', nombre: 'contratos_registrar', argumentos: { mensaje_id: 'msg-006' } }] },
      { texto: 'Requiere confirmación.', llamadas: [] },
    ]);
    const deps = await dependencias(proveedor, sesiones);
    const respuesta = await chatear(deps, null, 'Registra msg-006');
    assert.ok(respuesta);
    const sessionId = respuesta.sesion.id;
    const pendiente = respuesta.sesion.pendientes.find((p) => p.mensaje_id === 'msg-006');
    assert.ok(pendiente, 'msg-006 debe quedar pendiente de confirmación');

    const incompleta = await confirmarRegistro(deps, sessionId, {
      mensaje_id: 'msg-006',
      nombre_declarado: 'Persona de prueba',
      campos: { valor: null },
    });
    assert.equal(incompleta?.ok, false);

    const campos = Object.fromEntries(pendiente.campos_revision.map((c) => [c.campo, c.valor_presentado]));
    const confirmada = await confirmarRegistro(deps, sessionId, {
      mensaje_id: 'msg-006',
      nombre_declarado: 'Persona de prueba',
      campos,
    });
    assert.equal(confirmada?.ok, true);
    if (confirmada?.ok) {
      assert.equal(confirmada.sesion.pendientes.length, 0);
      assert.ok(confirmada.sesion.resumen.some((f) => f.mensaje_id === 'msg-006' && f.estado === 'registrado'));
    }
  });
});
