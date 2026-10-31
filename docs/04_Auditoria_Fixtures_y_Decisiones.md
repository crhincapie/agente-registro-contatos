# 04 · Auditoría de fixtures y matriz de decisiones aplicadas

Versión 2, tras la aprobación de D1 a D15. Reglas en `01_Especificacion_Solucion.md`, sección 25. Tipos de dato: EXTRAIDO, DERIVADO, CONVENCION, PENDIENTE.

Escala de confianza (especificación 9.3): 0.98–1.00 explícito e inequívoco; 0.90–0.97 explícito con normalización segura; 0.80–0.89 derivado con regla documentada; menor de 0.80 requiere revisión; ausente = `null`, confianza 0, tipo PENDIENTE.

---

## 1. Conteo de fixtures

Verificado: 14 archivos de datos (2 generales y 12 de mensajes) más `README_FIXTURES.md`, en total 15. Los fixtures no se han modificado.

---

## 2. Matriz por mensaje

| Mensaje | Clasificación | Contrato | Acción | Confirmación requerida | Ruta de archivo (relativa a `out/sharepoint/`) | Conflictos y observaciones |
|---|---|---|---|---|---|---|
| msg-001 | `nuevo` | CT-2026-015 | Insertar fila; archivar adjunto; `estado_poliza = pendiente`; evento `nuevo` | No | `Contratos/2026/industrias-delta/CT-2026-015.txt` | Mismo NIT que CT-2025-018, objeto distinto. No es RN1 ni RN2. |
| msg-002 | `nuevo` | CT-2026-016 | Insertar fila; archivar adjunto; `no_aplica`; evento `nuevo` | No | `Contratos/2026/corporacion-andina-de-servicios/CT-2026-016.txt` | Mismo RUC que CT-2026-007, objeto distinto (similitud < 0.9). Nota en metadata (D8). |
| msg-003 | `actualizacion` de CT-2026-011 | CT-2026-011, otrosí No. 1 | Actualizar fila: valor 520000 PEN, fecha_fin 2027-11-01, `estado_poliza = pendiente` (verificación de ampliación), `ruta_sharepoint` al otrosí; historial con antes y después; otrosí versionado | No (D6) | `Contratos/2026/minera-los-andes/CT-2026-011_otrosi-01.txt` | Inicio 2026-05-02 sin cambio. Original `.pdf` no está en fixtures. |
| msg-004 | `duplicado` de CT-2026-012 | CT-2026-012 | Sin escritura; no archivar el reenvío; marcar procesado | No | Sin cambio: `Contratos/2026/clinica-san-rafael/CT-2026-012.pdf` (histórica) | Coincide en id, valor, inicio y fin (RN1). |
| msg-005 | `rechazado` | Ninguno (COT-2026-088) | Sin escritura; marcar procesado con motivo | No | Ninguna | Cliente coincide por nombre con CT-2026-006; no es contrato (RA9). |
| msg-006 | `nuevo` con confirmación | CM-2026-03 (contrato marco) | No registrar sin confirmación; registrar con moneda y fecha de inicio PENDIENTES y fecha de fin CONVENCION | Sí, lista D15 | `Contratos/2026/distribuidora-caribe/CM-2026-03.txt` | Mismo NIT que CT-2026-002, objeto y vigencia distintos (RA9). Remitente no registrado; no bloquea. |

---

## 3. Detalle de campos por mensaje

Columnas: campo, valor, tipo de dato, confianza, fuente.

### 3.1 msg-001 · Industrias Delta · `nuevo`

| Campo | Valor | Tipo | Confianza | Fuente |
|---|---|---|---|---|
| id_contrato | CT-2026-015 | EXTRAIDO | 0.98 | Encabezado |
| cliente | INDUSTRIAS DELTA S.A.S. | EXTRAIDO | 0.98 | Encabezado |
| nit_cliente | 890900111 | EXTRAIDO (normalizado) | 0.95 | "NIT 890.900.111-4", sin dígito de verificación |
| pais | CO | DERIVADO | 0.90 | NIT colombiano; domicilio Bogotá |
| objeto | Implementación, parametrización y soporte de CRM, con migración y capacitación | EXTRAIDO | 0.95 | Cláusula PRIMERA |
| valor | 265000000 | EXTRAIDO | 0.97 | "COP $265.000.000" |
| tratamiento_tributario | incluido | EXTRAIDO | 0.97 | "IVA incluido" |
| moneda | COP | EXTRAIDO | 0.98 | "COP $" |
| fecha_inicio | 2026-08-01 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| fecha_fin | 2027-07-31 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| requiere_poliza | true | EXTRAIDO | 0.95 | Cláusula SEXTA y correo |
| tipo_poliza | cumplimiento | EXTRAIDO | 0.95 | Cláusula SEXTA (20%) |
| estado_poliza | pendiente | DERIVADO | 0.90 | Póliza exigida sin evidencia de constitución |
| comercial | Laura Gómez Restrepo | EXTRAIDO (resuelto) | 0.98 | `lgomez@` en comerciales.json |

### 3.2 msg-002 · Corporación Andina · `nuevo`

| Campo | Valor | Tipo | Confianza | Fuente |
|---|---|---|---|---|
| id_contrato | CT-2026-016 | EXTRAIDO | 0.98 | Encabezado |
| cliente | CORPORACIÓN ANDINA DE SERVICIOS S.A. | EXTRAIDO | 0.98 | Encabezado |
| nit_cliente | 1790012345001 | EXTRAIDO | 0.95 | RUC, sin normalizar |
| pais | EC | DERIVADO | 0.95 | RUC de 13 dígitos; Quito |
| objeto | Fábrica de software en célula dedicada de seis profesionales | EXTRAIDO | 0.95 | Cláusula PRIMERA |
| valor | 120000 | EXTRAIDO | 0.97 | "USD 120,000.00" |
| tratamiento_tributario | mas_impuestos_de_ley | EXTRAIDO | 0.97 | "más los impuestos de ley" |
| moneda | USD | EXTRAIDO | 0.98 | "DÓLARES DE LOS ESTADOS UNIDOS" |
| fecha_inicio | 2026-08-15 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| fecha_fin | 2027-08-14 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| requiere_poliza | false | DERIVADO | 0.90 | Sin cláusula de garantía; correo "Este no pide póliza" |
| tipo_poliza | vacío | DERIVADO | 0.90 | No aplica |
| estado_poliza | no_aplica | DERIVADO | 0.90 | Derivado de requiere_poliza |
| comercial | Carlos Ruiz Medina | EXTRAIDO (resuelto) | 0.98 | `cruiz@` |

### 3.3 msg-003 · Otrosí Minera Los Andes · `actualizacion`

| Campo | Valor | Tipo | Confianza | Fuente |
|---|---|---|---|---|
| contrato_referenciado | CT-2026-011 | EXTRAIDO | 0.98 | Título del otrosí |
| cliente | Minera Los Andes S.A.C. | EXTRAIDO | 0.98 | Otrosí, sin cambio |
| nit_cliente | 20512345678 | EXTRAIDO | 0.98 | RUC, igual al maestro |
| pais | PE | DERIVADO | 0.95 | RUC peruano; Lima |
| valor (nuevo) | 520000 PEN | EXTRAIDO | 0.97 | Cláusula SEGUNDA del otrosí |
| valor (anterior) | 350000 PEN | EXTRAIDO | 0.98 | Maestro |
| tratamiento_tributario | incluido | EXTRAIDO | 0.97 | "incluidos los impuestos de ley" |
| fecha_fin (nueva) | 2027-11-01 | EXTRAIDO | 0.98 | Cláusula PRIMERA del otrosí |
| fecha_fin (anterior) | 2027-05-01 | EXTRAIDO | 0.98 | Maestro |
| fecha_inicio | 2026-05-02 | EXTRAIDO (maestro, sin cambio) | 0.98 | Maestro |
| requiere_poliza | true | EXTRAIDO (maestro, sin cambio) | 0.95 | Maestro |
| estado_poliza | pendiente | DERIVADO | 0.90 | Garantías que deben ampliarse, sin evidencia de emisión. Motivo en `estado_poliza_motivo` (E4) |
| comercial | Carlos Ruiz Medina | EXTRAIDO (resuelto) | 0.98 | `cruiz@` |

Motivo registrado en historial: la cláusula TERCERA del otrosí exige ampliar las garantías de cumplimiento y responsabilidad civil. El documento no acredita su emisión. No se afirma que la póliza esté vencida.

### 3.4 msg-004 · Clínica San Rafael · `duplicado`

| Campo | Valor | Tipo | Confianza | Fuente |
|---|---|---|---|---|
| id_contrato | CT-2026-012 | EXTRAIDO | 0.98 | Encabezado |
| cliente | Clínica San Rafael S.A. | EXTRAIDO | 0.98 | Encabezado |
| nit_cliente | 890903456 | EXTRAIDO (normalizado) | 0.95 | "NIT 890.903.456-1" |
| pais | CO | DERIVADO | 0.90 | NIT colombiano; Medellín |
| valor | 210000000 | EXTRAIDO | 0.97 | "COP $210.000.000" |
| tratamiento_tributario | incluido | EXTRAIDO | 0.97 | "IVA incluido" |
| moneda | COP | EXTRAIDO | 0.98 | Texto |
| fecha_inicio | 2026-05-15 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| fecha_fin | 2026-11-14 | EXTRAIDO | 0.98 | Cláusula TERCERA |
| comercial | Laura Gómez Restrepo | EXTRAIDO (resuelto) | 0.98 | `lgomez@` |

Comparación con el maestro: id, valor, inicio y fin coinciden. Aplica RN1.

### 3.5 msg-005 · Cotización Universidad · `rechazado`

| Campo | Valor | Tipo | Confianza | Fuente |
|---|---|---|---|---|
| tipo_documento | cotización | EXTRAIDO | 0.98 | Título "COTIZACIÓN No. COT-2026-088" |
| contrato | Ninguno | EXTRAIDO | 0.98 | Cuerpo: "Aún no hay contrato" |
| campos contractuales | null | PENDIENTE | 0 | No aplica. El valor estimado COP 192.000.000 no se registra |
| comercial | Andrés Molina Pardo | EXTRAIDO (resuelto) | 0.98 | `amolina@` |

### 3.6 msg-006 · Contrato marco Distribuidora Caribe · `nuevo` con confirmación

| Campo | Valor a registrar | Tipo | Confianza | Fuente y observación |
|---|---|---|---|---|
| id_contrato | CM-2026-03 | EXTRAIDO | 0.95 | Título. No es CT-2026-002 |
| cliente | DISTRIBUIDORA CARIBE S.A.S. | EXTRAIDO | 0.98 | Encabezado |
| nit_cliente | 800222333 | EXTRAIDO (normalizado) | 0.95 | "NIT 800.222.333-9" |
| pais | CO | DERIVADO | 0.90 | NIT colombiano; Barranquilla |
| objeto | Desarrollo de software, soporte y consultoría mediante órdenes de servicio | EXTRAIDO | 0.90 | Cláusula PRIMERA |
| valor | 0 (`valor_indeterminado = true`) | DERIVADO | 0.90 | Cláusula SEGUNDA: "no tiene un valor determinado". Regla del PRD |
| moneda | vacía (no especificada) | PENDIENTE | 0 | El texto no declara moneda. El umbral de la póliza no se usa (RA1, D1) |
| fecha_inicio | vacía (no informada) | PENDIENTE | 0 | Solo consta "agosto de 2026". La fecha del correo no se usa (RA2, D2) |
| fecha_fin | 2027-08-31 | CONVENCION | n/a | Convención de demostración (RA3, D3). No extraída del contrato |
| requiere_poliza | true | DERIVADO | 0.85 | Cláusula CUARTA condicional |
| condicion_poliza | umbral 100000000 (moneda del umbral COP), 10%, base: cada orden de servicio | EXTRAIDO | 0.95 | Cláusula CUARTA. Guardado en metadata (RA4) |
| tipo_poliza | cumplimiento | EXTRAIDO | 0.90 | Cláusula CUARTA |
| estado_poliza | pendiente | DERIVADO | 0.70 | Verificación de si existe una orden que active la obligación. Sin órdenes registradas (RA4, D4) |
| tratamiento_tributario | no_especificado | PENDIENTE | 0 | El documento no lo indica (D11) |
| comercial | vacío | PENDIENTE | 0 | `jperez@` no está en comerciales.json. `remitente_no_registrado = true` (RA10, D12) |
| fecha del correo | 2026-08-31 | — | — | Fecha de recepción. No se usa como inicio (D2) |

Rango posible de la fecha de fin: con firma en agosto de 2026 y 12 meses de duración, el fin real cae entre finales de julio y agosto de 2027. El 2027-08-31 del PRD es una convención de demostración y debe verificarse con la fecha exacta de firma en producción (D3).

Observación de conflicto: CT-2026-002 comparte NIT 800222333 (portal de pedidos B2B, 150000000 COP, 2026-01-10 a 2026-07-09). No hay coincidencia de identificador ni de objeto; no es RN1 ni RN2 (RA9).

Campos en la confirmación de msg-006 (D15): valor 0 indeterminado; moneda no especificada; fecha de inicio no informada; fecha de fin 2027-08-31 como convención; condición de póliza; remitente desconocido sin bloqueo.

---

## 4. Rutas de archivo

- Los contratos nuevos se archivan con su extensión real `.txt`.
- Las rutas históricas del maestro (`.pdf`) no cambian.
- El otrosí se archiva como `CT-2026-011_otrosi-01.txt`. El contrato original no se sobrescribe. `ruta_sharepoint` apunta al documento más reciente y el historial guarda la ruta anterior y la nueva.
- Carpeta por año de inicio y slug del cliente.

## 5. Decisiones

Ver `05_Decisiones_y_Ambiguedades.md`. Quedan dos decisiones nuevas pendientes: P1 (identidad de quien confirma) y P2 (uso de Supabase frente al CSV como maestro).
