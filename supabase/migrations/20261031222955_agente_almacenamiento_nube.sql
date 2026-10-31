/*
# Almacenamiento en la nube para el agente de contratos

1. Nuevas tablas
- `agente_sesiones`: una fila por conversación con el agente (transcripción, pasos de herramientas, confirmaciones pendientes).
- `salida_archivos`: copia en la nube de los archivos de salida (maestro CSV, historial, procesados, pendientes, log, alertas, documentos).
- `bloqueos`: bloqueo distribuido con propietario y vencimiento para serializar los registros.

2. Funciones
- `adquirir_bloqueo`: toma el bloqueo si está libre o vencido.
- `liberar_bloqueo`: libera solo si el propietario coincide.
- `anexar_salida`: añade una línea a un archivo de forma atómica.

3. Seguridad
- RLS activo en las tres tablas sin políticas: el navegador (rol anon y authenticated) no puede leer ni escribir.
- Solo el rol service_role (servidor) recibe permisos.
- Las funciones se revocan de PUBLIC, anon y authenticated; solo service_role puede ejecutarlas.

4. Notas importantes
- No se borra ni modifica ningún dato existente.
- La migración es idempotente (IF NOT EXISTS, CREATE OR REPLACE).
*/

CREATE TABLE IF NOT EXISTS agente_sesiones (
  id uuid PRIMARY KEY,
  historial_ui jsonb NOT NULL DEFAULT '[]'::jsonb,
  contexto_modelo jsonb NOT NULL DEFAULT '[]'::jsonb,
  pendientes jsonb NOT NULL DEFAULT '[]'::jsonb,
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salida_archivos (
  ruta text PRIMARY KEY,
  contenido text NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bloqueos (
  nombre text PRIMARY KEY,
  propietario uuid NOT NULL,
  expira timestamptz NOT NULL
);

ALTER TABLE agente_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE salida_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON agente_sesiones, salida_archivos, bloqueos FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON agente_sesiones, salida_archivos, bloqueos TO service_role;

CREATE OR REPLACE FUNCTION adquirir_bloqueo(p_nombre text, p_propietario uuid, p_duracion_ms integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  filas integer;
BEGIN
  INSERT INTO bloqueos (nombre, propietario, expira)
  VALUES (p_nombre, p_propietario, now() + make_interval(secs => p_duracion_ms / 1000.0))
  ON CONFLICT (nombre) DO UPDATE
    SET propietario = excluded.propietario, expira = excluded.expira
    WHERE bloqueos.expira < now();
  GET DIAGNOSTICS filas = ROW_COUNT;
  RETURN filas = 1;
END;
$$;

CREATE OR REPLACE FUNCTION liberar_bloqueo(p_nombre text, p_propietario uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM bloqueos WHERE nombre = p_nombre AND propietario = p_propietario;
$$;

CREATE OR REPLACE FUNCTION anexar_salida(p_ruta text, p_linea text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO salida_archivos (ruta, contenido, actualizado_en)
  VALUES (p_ruta, p_linea || E'\n', now())
  ON CONFLICT (ruta) DO UPDATE
    SET contenido = salida_archivos.contenido || excluded.contenido,
        actualizado_en = now();
$$;

REVOKE EXECUTE ON FUNCTION adquirir_bloqueo(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION liberar_bloqueo(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION anexar_salida(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION adquirir_bloqueo(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION liberar_bloqueo(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION anexar_salida(text, text) TO service_role;
