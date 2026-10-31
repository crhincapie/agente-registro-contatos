import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

function apiLocal(): Plugin {
  return {
    name: 'api-local',
    apply: 'serve',
    configureServer(servidor) {
      const entorno = loadEnv(servidor.config.mode, process.cwd(), '');
      for (const [clave, valor] of Object.entries(entorno)) process.env[clave] ??= valor;

      servidor.middlewares.use(async (req, res, siguiente) => {
        if (!req.url?.startsWith('/api/')) return siguiente();
        try {
          const cuerpo = await leerCuerpoCrudo(req);
          const peticion = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: { 'content-type': req.headers['content-type'] ?? 'application/json' },
            body: cuerpo.length > 0 ? cuerpo : undefined,
          });
          const modulo = await servidor.ssrLoadModule('/api/[...ruta].ts');
          const respuesta: Response = await modulo.default.fetch(peticion);
          res.statusCode = respuesta.status;
          respuesta.headers.forEach((valor, clave) => res.setHeader(clave, valor));
          res.end(Buffer.from(await respuesta.arrayBuffer()));
        } catch (error) {
          servidor.config.logger.error(`Error en /api: ${error instanceof Error ? error.message : 'desconocido'}`);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Ocurrió un error interno. Intenta de nuevo.' }));
        }
      });
    },
  };
}

function leerCuerpoCrudo(req: import('node:http').IncomingMessage): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const trozos: Buffer[] = [];
    req.on('data', (trozo: Buffer) => trozos.push(trozo));
    req.on('end', () => resolver(Buffer.concat(trozos)));
    req.on('error', rechazar);
  });
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiLocal()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
