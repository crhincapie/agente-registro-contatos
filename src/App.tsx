import { FileText } from 'lucide-react';
import { ChatAgente } from '@/components/chat/ChatAgente';

function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
            <FileText className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold">Registro de contratos vigentes</p>
            <p className="text-xs text-slate-500">Agente de buzón y maestro de contratos</p>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <ChatAgente />
      </main>
    </div>
  );
}

export default App;
