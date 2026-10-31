import { useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import type { Pendiente } from '@/agent/tipos';
import { ETIQUETAS_CAMPO } from '@/components/chat/etiquetas';

interface PanelConfirmacionProps {
  pendientes: Pendiente[];
  enviando: boolean;
  error: string | null;
  onConfirmar: (mensajeId: string, nombre: string, campos: Record<string, string | number | null>) => Promise<void>;
}

export function PanelConfirmacion({ pendientes, enviando, error, onConfirmar }: PanelConfirmacionProps) {
  if (pendientes.length === 0) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="h-4 w-4 text-teal-600" aria-hidden />
          Confirmaciones
        </h2>
        <p className="mt-2">No hay registros esperando tu confirmación.</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <TriangleAlert className="h-4 w-4" aria-hidden />
        {pendientes.length === 1 ? 'Un registro requiere tu confirmación' : `${pendientes.length} registros requieren tu confirmación`}
      </div>
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
      {pendientes.map((pendiente) => (
        <TarjetaConfirmacion key={pendiente.mensaje_id} pendiente={pendiente} enviando={enviando} onConfirmar={onConfirmar} />
      ))}
    </section>
  );
}

function TarjetaConfirmacion({
  pendiente,
  enviando,
  onConfirmar,
}: {
  pendiente: Pendiente;
  enviando: boolean;
  onConfirmar: PanelConfirmacionProps['onConfirmar'];
}) {
  const [nombre, setNombre] = useState('');
  const [revisados, setRevisados] = useState<Set<string>>(new Set());
  const todosRevisados = pendiente.campos_revision.every((c) => revisados.has(c.campo));
  const puedeConfirmar = nombre.trim().length > 0 && todosRevisados && !enviando;

  function alternar(campo: string) {
    setRevisados((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(campo)) siguiente.delete(campo);
      else siguiente.add(campo);
      return siguiente;
    });
  }

  async function confirmar() {
    const campos = Object.fromEntries(pendiente.campos_revision.map((c) => [c.campo, c.valor_presentado]));
    await onConfirmar(pendiente.mensaje_id, nombre.trim(), campos);
  }

  return (
    <article className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Mensaje {pendiente.mensaje_id}</p>
        <h3 className="text-base font-semibold text-slate-900">{pendiente.id_contrato ?? 'Contrato sin identificador'}</h3>
        <p className="text-sm text-slate-600">{pendiente.motivo}</p>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-3 font-medium">Campo</th>
              <th className="py-2 pr-3 font-medium">Valor propuesto</th>
              <th className="py-2 pr-3 font-medium">Confianza</th>
              <th className="py-2 pr-3 font-medium">Motivo</th>
              <th className="py-2 font-medium">Confirmo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pendiente.campos_revision.map((campo) => (
              <tr key={campo.campo} className="align-top">
                <td className="py-2 pr-3 font-medium text-slate-800">{ETIQUETAS_CAMPO[campo.campo] ?? campo.campo}</td>
                <td className="py-2 pr-3 text-slate-900">{campo.valor_presentado ?? 'Sin valor'}</td>
                <td className="py-2 pr-3 text-slate-600">{Math.round(campo.confianza * 100)}%</td>
                <td className="py-2 pr-3 text-slate-600">{campo.motivo}</td>
                <td className="py-2">
                  <input
                    type="checkbox"
                    aria-label={`Confirmo ${ETIQUETAS_CAMPO[campo.campo] ?? campo.campo}`}
                    checked={revisados.has(campo.campo)}
                    onChange={() => alternar(campo.campo)}
                    className="h-4 w-4 accent-teal-600"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1 block font-medium text-slate-700">Nombre de quien confirma</span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={120}
            placeholder="Escribe tu nombre"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </label>
        <button
          type="button"
          onClick={confirmar}
          disabled={!puedeConfirmar}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
        >
          {enviando ? 'Registrando...' : 'Confirmar y registrar'}
        </button>
      </div>
      {!todosRevisados && <p className="mt-2 text-xs text-slate-500">Marca cada campo para habilitar la confirmación.</p>}
    </article>
  );
}
