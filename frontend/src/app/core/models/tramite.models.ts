/**
 * Modelos para CU-12 (Iniciar Trámite), CU-13 (Bandeja Operativa)
 * y CU-14 (Ejecución de Trámite).
 */

import { EstadoTramite, PrioridadTramite } from './flujo.models';

/** Representa una instancia de ejecución de una Política (CU-12). */
export interface Tramite {
  id: string;
  politicaId: string;
  politicaNombre?: string;
  clienteId: string;
  clienteNombre?: string;
  prioridad: PrioridadTramite;
  estado: EstadoTramite;
  /** ID del paso actual según el esquema_workflow (CU-14). */
  pasoActualId: string;
  pasoActualNombre?: string;
  fechaInicio: string;
  fechaUltimoCambio?: string;
  /** Porcentaje de avance (calculado o manual). */
  progreso: number;
  /** Historial de respuestas / actividades en cada paso. */
  actividades: TramiteActividad[];
}

/** Registro de lo completado en un paso específico (CU-14). */
export interface TramiteActividad {
  pasoId: string;
  usuarioId: string;
  fecha: string;
  /** Valores del formulario respondidos en este paso. */
  datosFormulario: Record<string, any>;
  completado: boolean;
}

/** DTO para listar trámites en la bandeja del funcionario (CU-13). */
export interface TramiteResumenDTO {
  id: string;
  politicaNombre: string;
  clienteNombre: string;
  clienteEmail?: string;
  prioridad: PrioridadTramite;
  estado: EstadoTramite;
  pasoActualNombre: string;
  pasoActualId?: string;
  progreso: number;
  semaforizacion?: 'Verde' | 'Amarillo' | 'Rojo';
  fechaInicio?: string;
  fechaLimite?: string;
  tiempoRestanteHoras?: number;
  funcionarioAsignadoId?: string;
  funcionarioAsignadoNombre?: string;
  venceEn?: string; // ej: "2h", "Hoy"
}
