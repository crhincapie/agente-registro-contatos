import type { AlmacenamientoPort } from '@/storage/port';
import { diasEntre } from '@/tools/normalizar';
import { leerMaestro, leerMetadatos, RUTAS } from '@/tools/salida';

const VENTANA_VENCIMIENTO_DIAS = 60;
const FECHA_CORTE_REGISTROS = '2026-05-30';

interface AlertaVencimiento {
  id_contrato: string;
  cliente: string;
  fecha_fin: string;
  dias: number;
}

interface AlertaPoliza {
  id_contrato: string;
  cliente: string;
  estado_poliza: string;
  motivo: string;
}

interface AlertaRegistro {
  id_contrato: string;
  cliente: string;
  fecha_registro: string;
}

export interface ResultadoAlertas {
  ruta: string;
  vencen: AlertaVencimiento[];
  polizas: AlertaPoliza[];
  registrados_recientes: AlertaRegistro[];
}

export async function generarAlertas(almacen: AlmacenamientoPort, hoy: string): Promise<ResultadoAlertas> {
  const filas = await leerMaestro(almacen);
  const metadatos = await leerMetadatos(almacen);

  const vencen = filas
    .filter((fila) => fila.fecha_fin !== '')
    .map((fila) => ({ id_contrato: fila.id_contrato, cliente: fila.cliente, fecha_fin: fila.fecha_fin, dias: diasEntre(hoy, fila.fecha_fin) }))
    .filter((alerta) => alerta.dias >= 0 && alerta.dias <= VENTANA_VENCIMIENTO_DIAS)
    .sort((a, b) => a.dias - b.dias);

  const polizas = filas
    .filter((fila) => fila.requiere_poliza === 'true' && fila.estado_poliza !== 'vigente')
    .map((fila) => ({
      id_contrato: fila.id_contrato,
      cliente: fila.cliente,
      estado_poliza: fila.estado_poliza,
      motivo: metadatos[fila.id_contrato]?.estado_poliza_motivo ?? 'Sin motivo registrado',
    }));

  const registradosRecientes = filas
    .filter((fila) => fila.fecha_registro >= FECHA_CORTE_REGISTROS)
    .map((fila) => ({ id_contrato: fila.id_contrato, cliente: fila.cliente, fecha_registro: fila.fecha_registro }));

  await almacen.escribirSalida(
    RUTAS.alertas,
    renderizarAlertas(hoy, vencen, polizas, registradosRecientes),
  );

  return { ruta: `out/${RUTAS.alertas}`, vencen, polizas, registrados_recientes: registradosRecientes };
}

function renderizarAlertas(
  hoy: string,
  vencen: AlertaVencimiento[],
  polizas: AlertaPoliza[],
  recientes: AlertaRegistro[],
): string {
  const seccion = (titulo: string, cabecera: string[], filas: string[][]) => {
    const cuerpo = filas.length === 0
      ? 'Sin registros en esta sección.'
      : [`| ${cabecera.join(' | ')} |`, `| ${cabecera.map(() => '---').join(' | ')} |`, ...filas.map((f) => `| ${f.join(' | ')} |`)].join('\n');
    return `## ${titulo}\n\n${cuerpo}\n`;
  };

  return [
    `# Alertas de contratos`,
    '',
    `Fecha de referencia: ${hoy}`,
    '',
    seccion(
      `Contratos que vencen en ${VENTANA_VENCIMIENTO_DIAS} días o menos`,
      ['Contrato', 'Cliente', 'Fecha de terminación', 'Días restantes'],
      vencen.map((a) => [a.id_contrato, a.cliente, a.fecha_fin, String(a.dias)]),
    ),
    seccion(
      'Pólizas pendientes',
      ['Contrato', 'Cliente', 'Estado', 'Motivo'],
      polizas.map((a) => [a.id_contrato, a.cliente, a.estado_poliza, a.motivo]),
    ),
    seccion(
      `Contratos registrados desde ${FECHA_CORTE_REGISTROS}`,
      ['Contrato', 'Cliente', 'Fecha de registro'],
      recientes.map((a) => [a.id_contrato, a.cliente, a.fecha_registro]),
    ),
  ].join('\n');
}
