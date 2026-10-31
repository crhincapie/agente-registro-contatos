# Carga de insumos en Bolt.new sin ZIP

Bolt no admite archivos `.zip` como adjuntos de contexto. Este paquete está preparado para cargarse como **cinco archivos Markdown individuales**.

## Archivos incluidos

1. `PRD_Reto_Tecnico_02.md` — requerimiento original y criterios contractuales.
2. `01_Especificacion_Solucion.md` — fuente de verdad funcional y técnica que desarrolla el PRD.
3. `02_Prompt_Implementacion_Bolt.md` — instrucciones de construcción por fases.
4. `04_Fixtures_Completos_Reto_02.md` — contenido íntegro de los fixtures, cada archivo identificado por su ruta de destino.
5. Este documento — instrucciones para cargar y reconstruir los archivos.

## Orden exacto

1. Crea un proyecto nuevo en Bolt.
2. En el chat del proyecto, adjunta los cinco archivos Markdown. En el plan Free, Bolt permite hasta cinco adjuntos por mensaje. Cada archivo debe ser menor de 5 MB para que Bolt lo lea al enviar el prompt.
3. Pega el siguiente mensaje:

> Lee los cinco archivos adjuntos completos. Todavía no construyas la aplicación. Primero crea dentro del proyecto los documentos de referencia bajo `docs/` y reconstruye todos los fixtures del archivo `04_Fixtures_Completos_Reto_02.md` en sus rutas exactas bajo `fixtures/reto-02/`. Cada bloque `Archivo:` representa un archivo independiente. Conserva nombres, extensiones, estructura de carpetas, valores, fechas, monedas, identificadores y textos. No inventes ni completes datos faltantes. No modifiques los fixtures después de crearlos. Comprueba que existan 6 carpetas `msg-001` a `msg-006`, sus seis `correo.json`, sus adjuntos, `comerciales.json` y `maestro-contratos.csv`. Después informa qué archivos creaste y cualquier diferencia. No escribas todavía código de la aplicación ni instales dependencias.

4. Verifica en Code view que existan estas rutas:

```text
/docs/PRD_Reto_Tecnico_02.md
/docs/01_Especificacion_Solucion.md
/docs/02_Prompt_Implementacion_Bolt.md
/fixtures/reto-02/README_FIXTURES.md
/fixtures/reto-02/comerciales.json
/fixtures/reto-02/maestro-contratos.csv
/fixtures/reto-02/buzon/msg-001/...
/fixtures/reto-02/buzon/msg-002/...
/fixtures/reto-02/buzon/msg-003/...
/fixtures/reto-02/buzon/msg-004/...
/fixtures/reto-02/buzon/msg-005/...
/fixtures/reto-02/buzon/msg-006/...
```

5. Solo después de confirmar la reconstrucción, pega el contenido de `02_Prompt_Implementacion_Bolt.md` para iniciar la implementación.

## Límites de adjuntos de Bolt

Según la documentación oficial consultada, Bolt admite hasta cinco adjuntos por mensaje en el plan Free, y lee archivos de hasta 5 MB al procesar el prompt. Admite `.md`, `.txt`, `.csv` y `.json`, pero no `.zip`.

Fuente: https://support.bolt.new/building/upload-files

## Importante

Los adjuntos del chat sirven como contexto para la instrucción enviada. El paso 3 le pide explícitamente a Bolt que los convierta en archivos reales del proyecto. No asumas que quedaron guardados en el árbol del proyecto hasta comprobarlo en Code view.
