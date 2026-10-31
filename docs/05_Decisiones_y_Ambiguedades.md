# 05 · Decisiones y ambigüedades

Estado: **D1 a D15 aprobadas** por la analista, con las condiciones registradas en la sección 3. Las reglas aplicables están en `01_Especificacion_Solucion.md`, sección 25 (anexo de decisiones aprobadas), que prevalece sobre las secciones 7.3, 7.6, 9.2, 10 y 12.2 cuando hay contradicción.

Origen de cada punto: **PRD** (lo exige el PRD), **Especificación** (lo exige `01_Especificacion_Solucion.md`) o **Recomendación** (propuesta adicional).

---

## 1. Brechas del esquema del PRD

| # | Brecha | Origen | Tratamiento aprobado |
|---|---|---|---|
| B1 | El CSV no tiene columna `valor_indeterminado`. | Especificación 9.2 | Metadata en `out/sharepoint/contratos-metadata.json` (E2). |
| B2 | El CSV no tiene columnas para la condición de póliza. | Especificación 7.6 | Metadata por `id_contrato` (E2). |
| B3 | `moneda` admite solo `COP / USD / PEN / PAB / HNL`; no hay nulo. | PRD 7.2 | Extensión E1: celda vacía cuando la moneda no está informada y la confirmación lo acepta. |
| B4 | `fecha_inicio` es obligatoria; no admite nulo. | PRD 7.2 | Extensión E1: celda vacía cuando no está informada y la confirmación lo acepta. |
| B5 | `estado_poliza` no tiene estado de verificación. | PRD 7.2 | Se usa `pendiente` y el motivo va en metadata (E4). |
| B6 | Rutas históricas `.pdf`; contratos nuevos `.txt`. | Observación de fixtures | Se conservan las `.pdf`. Archivos nuevos con extensión real `.txt`. |
| B7 | `fecha_registro` depende del reloj. | PRD 8, Especificación 9.1 | Reloj de demo fijo 2026-09-03 (D10). |
| B8 | No hay columnas para confianza, fuentes ni versiones. | Especificación 9.2 | Metadata (E2). |
| B9 | El PRD no define el tratamiento tributario. | Vacío del PRD | Se conserva lo declarado en el documento (D11, E2). |
| B10 | RN5 bloquearía un cambio declarado por otrosí. | PRD RN2, RN5 | Cambios declarados por otrosí no bloquean (D6). |
| B11 | Los `.pdf` históricos no están en fixtures. | Observación de fixtures | No se verifican; se referencian sin validar. |

---

## 2. Supuestos

| # | Supuesto | Origen |
|---|---|---|
| S1 | Los fixtures `.txt` son el texto completo; no hay OCR. | PRD 3.2 |
| S2 | La confianza es una puntuación operativa, no una probabilidad calibrada. | Especificación 9.3 |
| S3 | El año de archivo de msg-006 es 2026 (firma en agosto de 2026). | Recomendación |
| S4 | La fecha del correo de msg-006 es la fecha de recepción, no la de firma. | Aprobado (D2) |
| S5 | `comerciales.json` es la única fuente de comerciales, por email exacto. | Especificación 6.1 |
| S6 | Ninguna escritura se ha hecho todavía; `out/` aún no existe. | Esta fase |

---

## 3. Decisiones aprobadas

### msg-006 (bloquean su registro)

**D1 · Moneda.** Aprobada con condición: `moneda` queda sin informar. No se infiere COP del umbral de la póliza. Se muestra en la confirmación como "no especificada".

**D2 · Fecha de inicio.** Aprobada con condición: `fecha_inicio` queda sin informar. La fecha del correo no se usa como inicio. La analista confirma que acepta conservar el dato pendiente de aclaración.

**D3 · Fecha de fin.** Aprobada con condición: `2027-08-31` es convención exclusiva de demostración, registrada como `CONVENCION`. En producción debe verificarse la fecha exacta de firma.

**D4 · Póliza.** Aprobada con condición: `requiere_poliza = true` y `estado_poliza = pendiente`. Pendiente significa "verificar si existe una orden que active la obligación", no "póliza exigible no constituida". El umbral (COP 100.000.000 por orden) y el 10% se guardan en metadata.

**D5 · Año de archivo.** Aprobada: `Contratos/2026/distribuidora-caribe/CM-2026-03.txt`.

### msg-003 (no bloquea)

**D6 · Cambios declarados por otrosí.** Aprobada: la actualización se registra sin bloquear por la ausencia del documento de ampliación de garantías. Valor a PEN 520000 y fecha de fin a 2027-11-01. Fecha de inicio sin cambio.

**D7 · Póliza de msg-003.** Aprobada: `estado_poliza = pendiente` con motivo "pendiente de verificación de ampliación de garantías" en metadata e historial. No se afirma que esté vencida.

### Decisiones generales

**D8 · Mismo RUC que CT-2026-007 (msg-002).** Aprobada: se registra como `nuevo`; nota en metadata. No bloquea.

**D9 · Rutas históricas.** Aprobada: se conservan las `.pdf`; no se verifican.

**D10 · Fecha de registro.** Aprobada con condición: `demo.ts` usa el reloj fijo 2026-09-03. En producción, la fecha real de procesamiento. No se fija la fecha global del sistema.

**D11 · Impuestos.** Aprobada con condición: se conserva el valor y el tratamiento tal como aparece en cada documento. No se suman, restan ni calculan impuestos. msg-006 queda como tratamiento no especificado.

**D12 · Remitente no registrado (jperez).** Aprobada: comercial vacío, `remitente_no_registrado = true`, no bloquea, sin asignación inventada.

**D13 · Cotización de msg-005.** Aprobada: no se archiva; rechazada con motivo.

**D14 · Reenvío de msg-004.** Aprobada: no se archiva ni reemplaza; solo se marca procesado.

**D15 · Confirmación de msg-006.** Aprobada con condición: la confirmación muestra todos los campos dudosos (valor 0 indeterminado, moneda no especificada, fecha de inicio no informada, fecha de fin como convención, condición de póliza, remitente desconocido). La analista confirma expresamente. La confirmación no convierte datos desconocidos en datos verificados y queda registrada en `historial.jsonl` con los campos revisados y quién confirmó.

---

## 4. Extensiones de esquema que requieren documentación

| # | Extensión | Motivo |
|---|---|---|
| E1 | Celdas `moneda` y `fecha_inicio` vacías para registros con dato no informado. | Aprobado en D1 y D2. Contradice PRD 7.2; es preferible a inventar datos. |
| E2 | `contratos-metadata.json` con `valor_indeterminado`, condición de póliza, tratamiento tributario, tipo de dato por campo, convenciones, observaciones, remitente no registrado, versiones documentales y confianza/fuente por campo. | B1, B2, B8, B9. |
| E3 | Entradas de `historial.jsonl` para confirmaciones, con campos revisados, valores presentados, valores confirmados y quién confirmó. | D15. |
| E4 | Motivo de `estado_poliza` en metadata. | B5. |

Detalle completo en `01_Especificacion_Solucion.md`, sección 25.

---

## 5. Decisiones nuevas que necesito confirmar

**P1 · Identidad de quien confirma.** La aplicación no tiene autenticación. ¿Basta con un nombre que la analista escriba en la confirmación, o prefieres que quede solo el identificador de la sesión?

**P2 · Persistencia.** El sistema de referencia del proyecto indica usar la base de datos de Supabase para persistir datos. El PRD y la Especificación 14.3 piden conservar el CSV como maestro y no usar una base de datos para reemplazarlo. Propongo mantener el CSV como maestro exportable y usar Supabase solo como almacén de copias y del historial de sesiones y confirmaciones. Necesito tu aprobación antes de decidirlo.
