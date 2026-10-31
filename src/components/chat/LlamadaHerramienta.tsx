import { AlertTriangle, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import type { EstadoPaso, PasoHerramienta } from '@/agent/tipos';
import { ETIQUETAS_ESTADO, ETIQUETAS_HERRAMIENTA } from '@/components/chat/etiquetas';

const ESTILO_ESTADO: Record<EstadoPaso, { icono: typeof CheckCircle2; clases: string; texto: string }> = {
  ok: { icono: CheckCircle2, clases: 'border-emerald-200 bg-emerald-50 text-emerald-800', texto: 'Correcto' },
  advertencia: { icono: AlertTriangle, clases: 'border-amber-200 bg-amber-50 text-amber-900', texto: 'Requiere atención' },
  error: { icono: XCircle, clases: 'border-rose-200 bg-rose-50 text-rose-800', texto: 'Error' },
};

export function LlamadaHerramienta({ paso }: { paso: PasoHerramienta }) {
  const estilo = ESTILO_ESTADO[paso.estado];
  const Icono = estilo.icono;
  const argumentos = Object.entries((paso.argumentos ?? {}) as Record<string, unknown>);
  const etiquetaEstado = (paso.datos as { estado?: string } | null)?.estado;

  return (
    <div className={`rounded-lg border p-3 text-sm ${estilo.clases}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <CircleDashed className="h-4 w-4 opacity-60" aria-hidden />
          {ETIQUETAS_HERRAMIENTA[paso.nombre] ?? paso.nombre}
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Icono className="h-4 w-4" aria-hidden />
          {etiquetaEstado ? ETIQUETAS_ESTADO[etiquetaEstado] ?? estilo.texto : estilo.texto}
        </span>
      </div>
      {argumentos.length > 0 && (
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
          {argumentos.map(([clave, valor]) => (
            <div key={clave} className="flex gap-1">
              <dt className="font-medium">{clave}:</dt>
              <dd>{typeof valor === 'string' ? valor : JSON.stringify(valor)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-2 leading-relaxed">{paso.resumen}</p>
    </div>
  );
}
