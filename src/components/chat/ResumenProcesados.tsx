import { ClipboardList } from 'lucide-react';
import type { FilaResumen } from '@/agent/tipos';
import { ETIQUETAS_ESTADO } from '@/components/chat/etiquetas';

const ESTADOS_REGISTRADOS = ['registrado', 'actualizado'];

export function ResumenProcesados({ filas }: { filas: FilaResumen[] }) {
  const registrados = filas.filter((f) => ESTADOS_REGISTRADOS.includes(f.estado)).length;
  const pendientes = filas.filter((f) => f.estado === 'requiere_confirmacion').length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold text-slate-900">
        <ClipboardList className="h-4 w-4 text-teal-600" aria-hidden />
        Resumen de la sesión
      </h2>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Todavía no se han procesado mensajes.</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            {registrados} registrados, {pendientes} esperando confirmación, {filas.length - registrados - pendientes} sin registrar.
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {filas.map((fila) => (
              <li key={fila.mensaje_id} className="flex items-center justify-between gap-3 py-2">
                <span className="font-medium text-slate-800">
                  {fila.mensaje_id}
                  {fila.id_contrato ? <span className="ml-2 font-normal text-slate-500">{fila.id_contrato}</span> : null}
                </span>
                <span className="text-xs font-semibold text-slate-700">{ETIQUETAS_ESTADO[fila.estado] ?? fila.estado}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
