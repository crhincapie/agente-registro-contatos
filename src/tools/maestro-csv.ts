import { COLUMNAS_MAESTRO, type FilaMaestro } from '@/tools/tipos';

export function parsearMaestro(texto: string): FilaMaestro[] {
  const [, ...lineas] = parsearCsv(texto);
  return lineas.map((valores) => {
    const fila = {} as FilaMaestro;
    COLUMNAS_MAESTRO.forEach((columna, indice) => {
      fila[columna] = valores[indice] ?? '';
    });
    return fila;
  });
}

export function serializarMaestro(filas: FilaMaestro[]): string {
  const lineas = [COLUMNAS_MAESTRO.join(','), ...filas.map((fila) => COLUMNAS_MAESTRO.map((c) => escaparCampo(fila[c])).join(','))];
  return `${lineas.join('\n')}\n`;
}

function escaparCampo(valor: string): string {
  return /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let entrecomillado = false;
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (entrecomillado) {
      if (caracter === '"' && texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (caracter === '"') {
        entrecomillado = false;
      } else {
        campo += caracter;
      }
    } else if (caracter === '"') {
      entrecomillado = true;
    } else if (caracter === ',') {
      fila.push(campo);
      campo = '';
    } else if (caracter === '\n' || caracter === '\r') {
      if (caracter === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      if (fila.some((celda) => celda !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += caracter;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    if (fila.some((celda) => celda !== '')) filas.push(fila);
  }
  return filas;
}
