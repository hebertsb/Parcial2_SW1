/**
 * Mensajes intercambiados por STOMP entre el frontend y el backend Spring Boot
 * para colaboración en tiempo real (CU-09 / CU-10 / CU-11 / CU-14).
 *
 * Los destinos STOMP están inspirados en el controlador del compañero:
 *   /app/editor/cambio                   -> /topic/editor/{politicaId}/cambios
 *   /app/editor/cursor                   -> /topic/editor/{politicaId}/cursores
 *   /app/editor/cursor-formulario        -> /topic/editor/{formularioId}/cursores-form
 *   /app/formulario/campo                -> /topic/formulario/{formularioId}/campos
 *   /app/tramite/estado                  -> /topic/tramite/{tramiteId}/estado
 */

export type TipoCambioEditor =
  | 'paso_creado'
  | 'paso_actualizado'
  | 'paso_movido'
  | 'paso_eliminado'
  | 'relacion_creada'
  | 'relacion_actualizada'
  | 'relacion_eliminada'
  | 'condicion_actualizada';

export interface EditorCambioDto {
  politicaId: string;
  usuarioId: string;
  usuarioNombre: string;
  tipo: TipoCambioEditor;
  /** Payload específico según tipo. */
  payload: any;
  timestamp?: number;
}

export interface CursorEditorDto {
  politicaId: string;
  usuarioId: string;
  usuarioNombre: string;
  color: string;
  x: number;
  y: number;
}

export interface CursorFormularioDto {
  formularioId: string;
  usuarioId: string;
  usuarioNombre: string;
  color: string;
  campoId?: string;
}

export interface CampoFormularioMessage {
  formularioId: string;
  campoId: string;
  /** Atributo del campo modificado (titulo, placeholder, obligatorio, etc). */
  atributo: string;
  valor: any;
  usuarioId: string;
  usuarioNombre: string;
}

export interface EstadoTramiteMessage {
  tramiteId: string;
  pasoActualId?: string;
  estadoNuevo: 'en_proceso' | 'completado' | 'cancelado';
  usuarioId: string;
}
