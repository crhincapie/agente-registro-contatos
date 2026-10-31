export const ETIQUETAS_HERRAMIENTA: Record<string, string> = {
  contratos_leer_buzon: 'Leer buzón',
  contratos_extraer: 'Extraer datos del contrato',
  contratos_validar: 'Validar mensaje',
  contratos_registrar: 'Registrar en el maestro',
  contratos_alertas: 'Generar alertas',
};

export const ETIQUETAS_ESTADO: Record<string, string> = {
  registrado: 'Registrado',
  actualizado: 'Actualizado',
  duplicado: 'Duplicado',
  rechazado: 'Rechazado',
  conflicto: 'Conflicto',
  requiere_confirmacion: 'Requiere confirmación',
  ya_procesado: 'Ya procesado',
};

export const ETIQUETAS_CAMPO: Record<string, string> = {
  id_contrato: 'Identificador',
  cliente: 'Cliente',
  nit_cliente: 'NIT',
  pais: 'País',
  objeto: 'Objeto',
  valor: 'Valor',
  moneda: 'Moneda',
  fecha_inicio: 'Fecha de inicio',
  fecha_fin: 'Fecha de terminación',
  requiere_poliza: 'Requiere póliza',
  tipo_poliza: 'Tipo de póliza',
};

export const INSTRUCCION_BUZON =
  'Procesa el buzón de contratos con fecha de hoy 2026-09-03. Registra lo que esté limpio, muéstrame lo que requiere revisión campo por campo y termina con el reporte de alertas. No registres nada dudoso sin preguntarme.';
