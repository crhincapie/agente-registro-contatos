import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Bot, Loader2, RotateCcw, Send } from 'lucide-react';
import type { VistaSesion } from '@/agent/tipos';
import { MensajeChat } from '@/components/chat/MensajeChat';
import { PanelConfirmacion } from '@/components/chat/PanelConfirmacion';
import { ResumenProcesados } from '@/components/chat/ResumenProcesados';
import { INSTRUCCION_BUZON } from '@/components/chat/etiquetas';
import { confirmarRegistro, enviarMensaje, obtenerSesion } from '@/lib/api-chat';

const CLAVE_SESION = 'contratos-sesion-id';

export function ChatAgente() {
  const [sesion, setSesion] = useState<VistaSesion | null>(null);
  const [borrador, setBorrador] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorConfirmacion, setErrorConfirmacion] = useState<string | null>(null);
  const [restaurando, setRestaurando] = useState(true);
  const finalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guardada = localStorage.getItem(CLAVE_SESION);
    if (!guardada) {
      setRestaurando(false);
      return;
    }
    obtenerSesion(guardada)
      .then(setSesion)
      .catch((err: unknown) => {
        localStorage.removeItem(CLAVE_SESION);
        if (err instanceof Error && !err.message.includes('no existe')) setError(err.message);
      })
      .finally(() => setRestaurando(false));
  }, []);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [sesion?.historial.length, procesando]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || procesando) return;
    setProcesando(true);
    setError(null);
    try {
      const respuesta = await enviarMensaje(sesion?.id ?? null, limpio);
      localStorage.setItem(CLAVE_SESION, respuesta.sesion.id);
      setSesion(respuesta.sesion);
      setBorrador('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setProcesando(false);
    }
  }

  async function confirmar(mensajeId: string, nombre: string, campos: Record<string, string | number | null>) {
    if (!sesion) return;
    setConfirmando(true);
    setErrorConfirmacion(null);
    try {
      const actualizada = await confirmarRegistro({ sessionId: sesion.id, mensaje_id: mensajeId, nombre_declarado: nombre, campos });
      setSesion(actualizada);
    } catch (err) {
      setErrorConfirmacion(err instanceof Error ? err.message : 'No se pudo confirmar el registro.');
    } finally {
      setConfirmando(false);
    }
  }

  function nuevaConversacion() {
    localStorage.removeItem(CLAVE_SESION);
    setSesion(null);
    setError(null);
    setErrorConfirmacion(null);
  }

  function alPulsarTecla(evento: KeyboardEvent<HTMLTextAreaElement>) {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      void enviar(borrador);
    }
  }

  function alEnviar(evento: FormEvent) {
    evento.preventDefault();
    void enviar(borrador);
  }

  const historial = sesion?.historial ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="flex min-h-[70vh] flex-col rounded-2xl border border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Conversación</h2>
            <p className="text-xs text-slate-500">Pide al agente que procese el buzón o consulte un mensaje.</p>
          </div>
          <button
            type="button"
            onClick={nuevaConversacion}
            disabled={procesando}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-white hover:text-slate-900 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Nueva conversación
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
          {restaurando && <p className="text-sm text-slate-500">Recuperando la conversación...</p>}
          {!restaurando && historial.length === 0 && (
            <div className="mx-auto max-w-md space-y-4 py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-white">
                <Bot className="h-6 w-6" aria-hidden />
              </span>
              <h3 className="text-lg font-semibold text-slate-900">Registro de contratos vigentes</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Puedo leer el buzón, registrar los contratos limpios, explicarte lo que requiere revisión y generar el reporte de alertas.
              </p>
              <button
                type="button"
                onClick={() => void enviar(INSTRUCCION_BUZON)}
                disabled={procesando}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
              >
                Procesar el buzón de hoy
              </button>
            </div>
          )}
          {historial.map((entrada, indice) => (
            <MensajeChat key={indice} entrada={entrada} />
          ))}
          {procesando && (
            <div className="flex items-center gap-2 text-sm text-slate-600" role="status">
              <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden />
              El agente está procesando tu solicitud...
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
          <div ref={finalRef} />
        </div>

        <form onSubmit={alEnviar} className="border-t border-slate-200 bg-white p-4">
          <div className="flex items-end gap-3">
            <textarea
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              onKeyDown={alPulsarTecla}
              rows={2}
              maxLength={2000}
              disabled={procesando}
              placeholder="Escribe una instrucción para el agente..."
              aria-label="Instrucción para el agente"
              className="min-h-[44px] flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100"
            />
            <button
              type="submit"
              disabled={procesando || borrador.trim().length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
            >
              <Send className="h-4 w-4" aria-hidden />
              Enviar
            </button>
          </div>
        </form>
      </section>

      <aside className="space-y-6">
        <PanelConfirmacion
          pendientes={sesion?.pendientes ?? []}
          enviando={confirmando}
          error={errorConfirmacion}
          onConfirmar={confirmar}
        />
        <ResumenProcesados filas={sesion?.resumen ?? []} />
      </aside>
    </div>
  );
}
