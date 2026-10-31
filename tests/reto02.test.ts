import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { AlmacenamientoLocal } from '@/storage/local';
import { extraerContrato } from '@/tools/extraccion';
import { registrarMensaje, type ConfirmacionHumana, type ResultadoRegistro } from '@/tools/registro';
import type { AlmacenamientoPort } from '@/storage/port';
import { asegurarSalida, leerHistorial, leerMaestro, RUTAS } from '@/tools/salida';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const FECHA = '2026-09-03';
const contexto = { fechaRegistro: FECHA, sessionId: 'prueba' };

const directorios: string[] = [];

async function nuevoEntorno(): Promise<AlmacenamientoLocal> {
  const dir = await mkdtemp(join(tmpdir(), 'reto02-'));
  directorios.push(dir);
  await cp(resolve(RAIZ, 'fixtures/reto-02'), join(dir, 'fixtures/reto-02'), { recursive: true });
  const almacen = new AlmacenamientoLocal(dir);
  await asegurarSalida(almacen);
  return almacen;
}

function confirmarCampos(resultado: ResultadoRegistro): ConfirmacionHumana {
  return {
    nombre_declarado: 'Persona de prueba',
    campos: Object.fromEntries(resultado.campos_revision.map((campo) => [campo.campo, campo.valor_presentado])),
  };
}

after(async () => {
  await Promise.all(directorios.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('extracción del identificador', () => {
  it('reconoce CM-2026-03 exactamente como aparece en msg-006', async () => {
    const texto = await readFile(resolve(RAIZ, 'fixtures/reto-02/buzon/msg-006/contrato.txt'), 'utf8');
    const contrato = extraerContrato(texto, 'contrato.txt');
    assert.equal(contrato.id_contrato, 'CM-2026-03');
  });
});

describe('seis mensajes del buzón', () => {
  it('produce los estados esperados según la matriz de auditoría', async () => {
    const entorno = await nuevoEntorno();
    const estados: Record<string, string> = {};
    for (const id of ['msg-001', 'msg-002', 'msg-003', 'msg-004', 'msg-005', 'msg-006']) {
      estados[id] = (await registrarMensaje(entorno, id, contexto, undefined)).estado;
    }
    assert.deepEqual(estados, {
      'msg-001': 'registrado',
      'msg-002': 'registrado',
      'msg-003': 'actualizado',
      'msg-004': 'duplicado',
      'msg-005': 'rechazado',
      'msg-006': 'requiere_confirmacion',
    });
    const primeraConfirmacion = await registrarMensaje(entorno, 'msg-006', contexto, undefined);
    const final = await registrarMensaje(entorno, 'msg-006', contexto, confirmarCampos(primeraConfirmacion));
    assert.equal(final.estado, 'registrado');
    assert.equal(final.id_contrato, 'CM-2026-03');
  });
});

describe('idempotencia', () => {
  it('no vuelve a registrar un mensaje ya procesado', async () => {
    const entorno = await nuevoEntorno();
    const filasAntes = (await leerMaestro(entorno)).length;
    await registrarMensaje(entorno, 'msg-001', contexto, undefined);
    const segunda = await registrarMensaje(entorno, 'msg-001', contexto, undefined);
    assert.equal(segunda.estado, 'ya_procesado');
    assert.equal((await leerMaestro(entorno)).length, filasAntes + 1);
    const entradas = (await leerHistorial(entorno)).filter((e) => e.mensaje_id === 'msg-001');
    assert.equal(entradas.length, 1);
  });

  it('no duplica la confirmación de msg-006', async () => {
    const entorno = await nuevoEntorno();
    const primera = await registrarMensaje(entorno, 'msg-006', contexto, undefined);
    const confirmacion = confirmarCampos(primera);
    await registrarMensaje(entorno, 'msg-006', contexto, confirmacion);
    const repetida = await registrarMensaje(entorno, 'msg-006', contexto, confirmacion);
    assert.equal(repetida.estado, 'ya_procesado');
    const confirmaciones = (await leerHistorial(entorno)).filter((e) => e.accion === 'confirmacion');
    assert.equal(confirmaciones.length, 1);
  });
});

describe('escrituras concurrentes', () => {
  it('registra dos mensajes simultáneos sin perder ninguna fila', async () => {
    const entorno = await nuevoEntorno();
    const filasAntes = (await leerMaestro(entorno)).length;
    const [a, b] = await Promise.all([
      entorno.exclusivo(() => registrarMensaje(entorno, 'msg-001', contexto, undefined)),
      entorno.exclusivo(() => registrarMensaje(entorno, 'msg-002', contexto, undefined)),
    ]);
    assert.equal(a.estado, 'registrado');
    assert.equal(b.estado, 'registrado');
    assert.equal((await leerMaestro(entorno)).length, filasAntes + 2);
  });

  it('libera el bloqueo aunque la operación falle', async () => {
    const entorno = await nuevoEntorno();
    await assert.rejects(entorno.exclusivo(async () => { throw new Error('fallo controlado'); }), /fallo controlado/);
    const siguiente = await entorno.exclusivo(async () => 'ok');
    assert.equal(siguiente, 'ok');
  });
});

function conFalloEnHistorial(base: AlmacenamientoLocal): AlmacenamientoPort {
  let fallado = false;
  return {
    leerFixture: (ruta) => base.leerFixture(ruta),
    listarFixture: (ruta) => base.listarFixture(ruta),
    leerSalida: (ruta) => base.leerSalida(ruta),
    escribirSalida: (ruta, contenido) => base.escribirSalida(ruta, contenido),
    anexarSalida: async (ruta, linea) => {
      if (!fallado && ruta === RUTAS.historial) {
        fallado = true;
        throw new Error('fallo simulado antes de escribir el historial');
      }
      return base.anexarSalida(ruta, linea);
    },
    copiarFixtureASalida: (origen, destino) => base.copiarFixtureASalida(origen, destino),
    exclusivo: (operacion) => base.exclusivo(operacion),
  };
}

describe('recuperación ante fallos parciales', () => {
  it('completa un alta interrumpida sin duplicar la fila del maestro', async () => {
    const base = await nuevoEntorno();
    const filasAntes = (await leerMaestro(base)).length;
    await assert.rejects(registrarMensaje(conFalloEnHistorial(base), 'msg-001', contexto, undefined), /fallo simulado/);
    const reintento = await registrarMensaje(base, 'msg-001', contexto, undefined);
    assert.equal(reintento.estado, 'registrado');
    assert.equal((await leerMaestro(base)).length, filasAntes + 1);
    assert.equal((await leerHistorial(base)).filter((e) => e.mensaje_id === 'msg-001').length, 1);
  });

  it('completa un otrosí interrumpido sin añadir una segunda versión', async () => {
    const base = await nuevoEntorno();
    await assert.rejects(registrarMensaje(conFalloEnHistorial(base), 'msg-003', contexto, undefined), /fallo simulado/);
    const reintento = await registrarMensaje(base, 'msg-003', contexto, undefined);
    assert.equal(reintento.estado, 'actualizado');
    const metadatos = JSON.parse((await base.leerSalida(RUTAS.metadata)) ?? '{}') as Record<string, { versiones_documentales: unknown[] }>;
    assert.equal(metadatos['CT-2026-011'].versiones_documentales.length, 2);
    assert.equal((await leerHistorial(base)).filter((e) => e.mensaje_id === 'msg-003').length, 1);
  });
});
