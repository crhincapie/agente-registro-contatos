# Registro de contratos vigentes: conocimiento del proceso

## Fuentes de verdad

- El maestro de contratos (CSV) es la única fuente de verdad. El agente nunca inventa filas ni valores.
- El buzón de correos contiene los mensajes con los contratos, otrosíes y cotizaciones a procesar.
- Supabase solo guarda sesiones, confirmaciones y metadatos operativos.

## Clasificación de cada mensaje

| Clasificación | Cuándo aplica | Qué ocurre |
|---|---|---|
| nuevo | No existe el identificador en el maestro. | Se inserta una fila. |
| actualizacion | El identificador existe con cambios, o el documento es un otrosí, o coinciden NIT y objeto con similitud de al menos 0.9. | Se actualiza la fila y se versiona el documento. |
| duplicado | Existe el mismo identificador con el mismo valor, fecha de inicio y fecha de fin. | No se escribe nada. |
| rechazado | No hay adjunto contractual, no se identifican partes y objeto, o es una cotización. | No se registra; se informa la razón. |
| conflicto | El documento contradice el maestro de forma que impide decidir. | Bloquea el registro hasta revisión humana. |
| requiere_confirmacion | Algún campo tiene confianza menor a 0.80 o hay conflicto que la persona debe aprobar. | No se escribe hasta confirmación humana explícita. |

## Reglas de negocio

- RN1 Duplicado: mismo identificador con mismos valor, fecha de inicio y fecha de fin. No modificar maestro ni archivo.
- RN2 Actualización: mismo identificador con cambios, coincidencia de NIT y objeto con similitud de al menos 0.9, o un otrosí. Un otrosí no sobrescribe el documento previo.
- RN3 Nuevo: no existe coincidencia. Se inserta una fila.
- RN4 Rechazado: sin adjunto contractual, sin partes u objeto identificables, o cotización sin contrato.
- RN5 Confianza menor a 0.80 o conflicto con el maestro: el campo entra en revisión y el registro queda bloqueado hasta confirmación humana.
- RN6 El maestro original es de solo lectura; se trabaja sobre una copia.
- RN7 Toda ejecución de herramienta se registra en el log con fecha, herramienta, mensaje, resultado y resumen, sin volcar texto contractual completo.

## Confianza de los datos

- 0.98 a 1.00: dato explícito en el documento.
- 0.90 a 0.97: dato explícito pero normalizado (formato de fecha, moneda, separadores).
- 0.80 a 0.89: dato derivado de otro dato del documento.
- Menor a 0.80: requiere revisión humana.
- Dato ausente: vacío, con confianza 0. Nunca se completa con suposiciones.

## Tipos de dato por campo

- EXTRAIDO: tomado literalmente del documento.
- DERIVADO: calculado a partir de otros campos.
- CONVENCION: regla de la demostración aplicada por norma interna, se indica como tal.
- PENDIENTE: falta información en el documento.

## Confirmación humana

- Solo la persona puede confirmar. El agente nunca confirma por su cuenta.
- La confirmación exige el nombre de quien confirma y el valor exacto de cada campo presentado.
- Si la persona corrige un valor, el sistema vuelve a validar antes de escribir.
- La identidad declarada no está verificada; se registra como tal.

## Pólizas

- Cuando un contrato requiere póliza, su estado puede ser vigente, pendiente o condicionado. El motivo queda registrado.
- Las pólizas no vigentes aparecen en el reporte de alertas.

## Alertas

- Contratos que vencen en 60 días o menos desde la fecha de referencia.
- Pólizas pendientes o condicionadas.
- Contratos registrados desde 2026-05-30.

## Gobierno del proceso

- Canal único de recepción: buzón funcional de contratos, administrado por el área responsable.
- Dueño del maestro: responsable administrativo u operativo designado. Las decisiones contractuales se escalan al gerente o área responsable.
- Indicador de cumplimiento: porcentaje de contratos firmados que quedan registrados dentro del plazo acordado.
- No existe un área legal interna que deba asumirse; no se inventan responsables.
