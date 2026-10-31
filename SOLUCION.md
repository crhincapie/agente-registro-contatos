# Solución: registro de contratos vigentes

## Problema

Los contratos llegan por correo en distintos formatos: nuevos, otrosíes, renovaciones, cotizaciones y adjuntos incompletos. Hay que registrar solo los contratos vigentes en el CSV maestro, detectar duplicados y conflictos, pedir confirmación humana cuando un dato es dudoso y avisar de lo que vence pronto.

## Arquitectura

- **Herramientas deterministas** (`src/tools/`): leer el buzón, extraer, validar, registrar y generar alertas. Aplican RN1–RN7 y no dependen del modelo.
- **Agente** (`src/agent/`, `src/llm/`): un modelo de lenguaje decide qué herramienta usar y redacta la respuesta. Solo puede llamar a cinco herramientas con esquemas tipados.
- **Confirmación humana**: ocurre en una ruta HTTP separada (`/api/confirmar`). El modelo no tiene forma de enviar una confirmación; el servidor exige el nombre de quien confirma y los mismos campos que se mostraron.
- **Persistencia desacoplada**: `AlmacenamientoPort` con dos adaptadores. `AlmacenamientoLocal` escribe en disco para la demo; `AlmacenamientoNube` usa Supabase para anexos y bloqueos. El CSV maestro sigue siendo la fuente de verdad.
- **Interfaz**: un chat en React que muestra el historial, las llamadas a herramientas, el panel de confirmación y el resumen de mensajes procesados.

## Ciclo del agente

1. El mensaje del usuario entra al contexto de la sesión.
2. El modelo responde con texto o con llamadas a herramientas.
3. El servidor ejecuta cada llamada y devuelve el resultado al modelo.
4. Se repite hasta que el modelo responde sin llamadas, con un máximo de 25 iteraciones (`MAX_ITERACIONES`). Al llegar al límite, el turno termina como proceso parcial y el usuario puede pedir que continúe.
5. Si el proveedor del modelo falla, el contexto del turno se revierte y se muestra un mensaje claro; la sesión sigue activa.

## Modelo y costo por transacción

- Modelo: Claude (por defecto `claude-sonnet-4-5`, configurable con `LLM_MODEL`). No se ha verificado su disponibilidad en la cuenta del despliegue.
- Costo: no medido. Cada turno envía las instrucciones, las definiciones de herramientas y el historial acumulado, por lo que el costo crece con la longitud de la sesión. Antes de producción conviene medir tokens por turno y acotar el historial enviado al modelo.

## Extracción y confianza

- Confianza 0.98–1.00: dato explícito en el contrato.
- 0.90–0.97: dato normalizado (formato de fecha o moneda).
- 0.80–0.89: dato derivado (por ejemplo, fecha de fin calculada desde la duración).
- Menos de 0.80: pasa a revisión humana.
- Dato ausente: se guarda como vacío con confianza 0.

## Gobierno

- El CSV original de `fixtures/` no se modifica; el registro se hace sobre una copia de trabajo en la carpeta de salida.
- Cada decisión queda en el historial de salida (`out/log.jsonl`) con el mensaje, la clasificación y el motivo.
- Las confirmaciones guardan quién confirmó y qué campos se revisaron.
- Los contenidos del correo se tratan como datos no confiables: no pueden cambiar las instrucciones del agente.
- El navegador nunca accede a la base de datos. Las tablas tienen RLS activo sin políticas públicas; solo el servidor, con la clave de servicio, las usa.

## Decisiones y trade-offs

1. **El CSV es la fuente de verdad, no la base de datos.** Ventaja: auditable y portable, cumple el requisito del reto. Costo: escribir el CSV exige bloqueo para evitar carreras. Se resolvió con un bloqueo en PostgreSQL (`adquirir_bloqueo` / `liberar_bloqueo`) que sobrevive a varias instancias de Vercel.
2. **El modelo no confirma registros.** Ventaja: un error de lenguaje no puede registrar un contrato dudoso. Costo: la persona debe usar el panel de confirmación; el chat no puede cerrar el caso solo.
3. **Herramientas tipadas en lugar de escritura libre.** Ventaja: el modelo solo puede hacer lo que las herramientas permiten, y los errores se devuelven como resultados. Costo: cada cambio nuevo requiere código y esquema, no basta con una instrucción.

## Supuestos y riesgos

- Se asume que el buzón y el CSV de muestra representan el formato real. Un correo con otra estructura puede caer en revisión.
- La identidad de quien confirma es un nombre declarado, suficiente para la demo. En producción debe haber inicio de sesión.
- Sin clave de modelo configurada, el chat responde con un mensaje de servicio no disponible; las herramientas deterministas siguen funcionando con la demo.
- La publicación en Vercel depende de que el repositorio esté conectado y de que las variables de entorno estén cargadas en el panel.
- Quedan 15 avisos de vulnerabilidades en dependencias de npm sin revisar.

## Historias de usuario

- Como encargada de contratos, quiero procesar el buzón con una instrucción para que los contratos vigentes queden registrados sin revisar cada correo.
- Como encargada de contratos, quiero que un duplicado o una cotización se rechacen con su motivo para no contarlos dos veces.
- Como encargada de contratos, quiero confirmar los campos dudosos de un contrato antes de registrarlo para evitar errores en el maestro.
- Como responsable de pólizas, quiero ver los contratos que vencen en 60 días y las pólizas pendientes en el reporte de alertas.
- Como auditor, quiero que cada decisión quede registrada con su motivo y su confirmación.

## Herramientas de IA usadas

- Bolt, como entorno de construcción de la aplicación.
- Claude, como modelo de lenguaje del agente en tiempo de ejecución.

## Qué falta para producción

- Inicio de sesión para quien confirma, en lugar de un nombre declarado.
- Medición de costo por turno y límite del historial enviado al modelo.
- Pruebas de extremo a extremo de la interfaz y de la confirmación en la nube.
- Revisión de las vulnerabilidades de dependencias.
- Monitoreo de errores del modelo y de la base de datos.
- Verificación de que las instrucciones y las fixtures se incluyan en el paquete del servidor de Vercel.
