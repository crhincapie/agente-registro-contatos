import { Bot, User, CheckCircle2, Info } from 'lucide-react';
import type { EntradaHistorial } from '@/agent/tipos';
import { LlamadaHerramienta } from '@/components/chat/LlamadaHerramienta';
import { ETIQUETAS_ESTADO } from '@/components/chat/etiquetas';

export function MensajeChat({ entrada }: { entrada: EntradaHistorial }) {
  if (entrada.tipo === 'usuario') {
    return (
      <div className="flex justify-end gap-3">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm leading-relaxed text-white">
          {entrada.texto}
        </div>
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
          <User className="h-4 w-4" aria-hidden />
        </span>
      </div>
    );
  }

  if (entrada.tipo === 'confirmacion') {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          {entrada.nombre_declarado} confirmó el mensaje {entrada.mensaje_id}:{' '}
          {ETIQUETAS_ESTADO[entrada.estado] ?? entrada.estado}
          {entrada.id_contrato ? ` (${entrada.id_contrato})` : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white">
        <Bot className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        {entrada.pasos.length > 0 && (
          <div className="space-y-2">
            {entrada.pasos.map((paso) => (
              <LlamadaHerramienta key={paso.id} paso={paso} />
            ))}
          </div>
        )}
        {entrada.texto && (
          <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800 shadow-sm whitespace-pre-line">
            {entrada.texto}
          </div>
        )}
        {entrada.error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{entrada.error}</div>
        )}
        {entrada.limiteAlcanzado && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            El proceso alcanzó el límite de pasos de este turno. Puedes pedir que continúe.
          </div>
        )}
      </div>
    </div>
  );
}
