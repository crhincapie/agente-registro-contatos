export type TipoDato = 'EXTRAIDO' | 'DERIVADO' | 'CONVENCION' | 'PENDIENTE';

export type TipoDocumento = 'contrato' | 'contrato_marco' | 'otrosi' | 'cotizacion' | 'desconocido';

export type Clasificacion = 'nuevo' | 'actualizacion' | 'duplicado' | 'rechazado' | 'conflicto';

export type CampoContrato =
  | 'id_contrato'
  | 'cliente'
  | 'nit_cliente'
  | 'pais'
  | 'objeto'
  | 'valor'
  | 'moneda'
  | 'fecha_inicio'
  | 'fecha_fin'
  | 'requiere_poliza'
  | 'tipo_poliza';

export interface MetaCampo {
  tipo: TipoDato;
  confianza: number;
  fuente: string | null;
}

export interface CondicionPoliza {
  texto_umbral: string;
  umbral: number;
  moneda_umbral: string;
  porcentaje: number;
  base: string;
}

export interface ContratoExtraido {
  documento: string;
  tipo_documento: TipoDocumento;
  id_contrato: string | null;
  contrato_referenciado: string | null;
  cliente: string | null;
  nit_cliente: string | null;
  pais: string | null;
  objeto: string | null;
  valor: number | null;
  valor_indeterminado: boolean;
  moneda: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  tratamiento_tributario: 'incluido' | 'mas_impuestos' | 'no_especificado';
  requiere_poliza: boolean | null;
  tipo_poliza: string | null;
  condicion_poliza: CondicionPoliza | null;
  meta: Partial<Record<CampoContrato, MetaCampo>>;
}

export const COLUMNAS_MAESTRO = [
  'id_contrato',
  'cliente',
  'nit_cliente',
  'pais',
  'objeto',
  'valor',
  'moneda',
  'fecha_inicio',
  'fecha_fin',
  'requiere_poliza',
  'tipo_poliza',
  'estado_poliza',
  'comercial',
  'ruta_sharepoint',
  'fecha_registro',
  'fuente',
] as const;

export type FilaMaestro = Record<(typeof COLUMNAS_MAESTRO)[number], string>;

export interface Comercial {
  email: string;
  nombre: string;
  region: string;
}

export interface CampoRevision {
  campo: string;
  valor_presentado: string | number | null;
  tipo: TipoDato;
  confianza: number;
  motivo: string;
}

export interface VersionDocumental {
  version: number;
  tipo: 'contrato_original' | 'contrato' | 'otrosi';
  ruta: string;
  mensaje_id: string | null;
  fecha: string;
}

export interface MetadatoContrato {
  id_contrato: string;
  valor_indeterminado: boolean;
  condicion_poliza: CondicionPoliza | null;
  tratamiento_tributario: ContratoExtraido['tratamiento_tributario'];
  tipo_dato_por_campo: Partial<Record<CampoContrato, TipoDato>>;
  confianza_por_campo: Partial<Record<CampoContrato, number>>;
  fuentes_por_campo: Partial<Record<CampoContrato, string | null>>;
  convenciones: string[];
  observaciones: string[];
  remitente_email: string | null;
  remitente_no_registrado: boolean;
  estado_poliza_motivo: string | null;
  versiones_documentales: VersionDocumental[];
}

export interface RegistroProcesado {
  estado: 'registrado' | 'actualizado' | 'duplicado' | 'rechazado';
  id_contrato: string | null;
  ts: string;
}

export interface Evaluacion {
  mensaje_id: string;
  clasificacion: Clasificacion;
  motivo: string;
  id_contrato: string | null;
  contrato: ContratoExtraido;
  fila: FilaMaestro | null;
  fila_anterior: FilaMaestro | null;
  cambios: Record<string, { antes: string | null; despues: string | null }>;
  campos_revision: CampoRevision[];
  requiere_confirmacion: boolean;
  estado_poliza: string | null;
  estado_poliza_motivo: string | null;
  archivo: { origen: string; destino: string } | null;
  comercial: string | null;
  remitente_email: string;
  remitente_no_registrado: boolean;
  convenciones: { campo: string; valor: string; motivo: string }[];
  observaciones: string[];
}
