# Registro de contratos vigentes

Agente conversacional que lee el buzón de correos, extrae los contratos vigentes, los registra en el CSV maestro y genera el reporte de alertas. El CSV es la fuente de verdad; la base de datos solo guarda sesiones, confirmaciones y metadatos operativos.

## Requisitos

- Node.js 22 o superior.
- Para el chat con el agente: una clave de API de Anthropic.
- Para la persistencia en la nube: un proyecto de Supabase.

## Instalación

```bash
npm install
cp .env.example .env
```

Completa `.env` en el servidor (nunca en el navegador):

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Sí, para el chat | Clave del modelo de lenguaje. |
| `LLM_MODEL` | No | Modelo a usar. Por defecto `claude-sonnet-4-5`. |
| `SUPABASE_URL` | Sí, para la nube | URL del proyecto de Supabase. |
| `SUPABASE_SECRET_KEY` | Sí, para la nube | Clave secreta de Supabase (`sb_secret_...`), solo del lado del servidor. Tiene prioridad. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Clave `service_role` heredada, solo como respaldo si no existe `SUPABASE_SECRET_KEY`. |
| `FECHA_REFERENCIA` | No | Fecha `AAAA-MM-DD` para las alertas. |

## Ejecución local

```bash
npm run dev
```

La interfaz y la API (`/api/*`) se sirven juntas desde Vite.

## Demo sin LLM ni base de datos

```bash
npm run demo
```

Procesa los seis mensajes del buzón de muestra sin credenciales. Genera el registro, las alertas y el reporte en `out/`. Dos ejecuciones producen la misma salida.

## Pruebas

```bash
npm test
npm run typecheck
npm run build
```

`npm test` incluye las pruebas de herramientas deterministas y las del agente con un proveedor simulado (ciclo conversacional, bloqueo de confirmaciones desde el modelo, fallo del proveedor, límite de iteraciones y confirmación de msg-006).

## Endpoints de la API

- `GET /api/health`: estado de la base de datos y de la configuración del modelo.
- `POST /api/chat`: envía un mensaje al agente (`{ sessionId?, mensaje }`).
- `POST /api/confirmar`: registra un contrato que requiere confirmación humana.
- `GET /api/sessions/:id`: recupera una sesión.

## Publicación

El proyecto se despliega en Vercel. La carpeta `api/` se convierte en funciones del servidor y el resto en la interfaz. Configura las variables de la tabla anterior en el panel de Vercel antes de desplegar.

## Estructura

- `fixtures/reto-02/`: buzón, CSV maestro y adjuntos originales (no modificar).
- `src/tools/`: herramientas deterministas (lectura, extracción, validación, registro, alertas).
- `src/agent/`: ciclo del agente, servicio de sesiones y herramientas expuestas al modelo.
- `src/llm/`: adaptador del modelo de lenguaje y su implementación con Anthropic.
- `src/storage/`: almacenamiento local (demo) y en la nube (Supabase).
- `src/api/` y `api/`: rutas HTTP.
- `src/components/chat/` y `src/App.tsx`: interfaz del chat.
- `agent/prompt.md` y `src/knowledge/registro-contratos.md`: instrucciones y conocimiento del agente.
- `SOLUCION.md`: decisiones de diseño, riesgos y trabajo pendiente para producción.
