const MESES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

export function sinAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizarTexto(texto: string): string {
  return sinAcentos(texto)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugNombre(nombre: string): string {
  return sinAcentos(nombre.replace(/\s+(S\.A\.S\.|S\.A\.C\.|S\.A\.|S\. de R\.L\.)$/i, ''))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatearNombreCliente(nombre: string): string {
  return nombre
    .toLowerCase()
    .split(/\s+/)
    .map((palabra, indice) => {
      if (palabra.includes('.')) return palabra.toUpperCase();
      if (indice > 0 && (palabra === 'de' || palabra === 'del')) return palabra;
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(' ');
}

export function convertirMonto(texto: string): number {
  const sinDecimales = /[.,]\d{2}$/.test(texto) ? texto.slice(0, -3) : texto;
  return Number(sinDecimales.replace(/[.,]/g, ''));
}

export function fechaDesdeTexto(dia: string, mes: string, anio: string): string | null {
  const numeroMes = MESES[normalizarTexto(mes)];
  if (!numeroMes) return null;
  return `${anio}-${numeroMes}-${dia.padStart(2, '0')}`;
}

export function similitud(a: string, b: string): number {
  const bigramas = (texto: string) => {
    const limpio = normalizarTexto(texto).replace(/\s/g, '');
    const mapa = new Map<string, number>();
    for (let i = 0; i < limpio.length - 1; i++) {
      const par = limpio.slice(i, i + 2);
      mapa.set(par, (mapa.get(par) ?? 0) + 1);
    }
    return mapa;
  };
  const mapaA = bigramas(a);
  const mapaB = bigramas(b);
  const total = [...mapaA.values()].reduce((s, n) => s + n, 0) + [...mapaB.values()].reduce((s, n) => s + n, 0);
  if (total === 0) return 0;
  let coincidencias = 0;
  for (const [par, cantidad] of mapaA) {
    coincidencias += Math.min(cantidad, mapaB.get(par) ?? 0);
  }
  return (2 * coincidencias) / total;
}

export function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}
