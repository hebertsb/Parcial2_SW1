import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';
import { Observable, of, map } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Tramite, TramiteResumenDTO } from '../models/tramite.models';

interface TramiteBandejaBackend {
  id: string;
  cliente_nombre?: string;
  cliente_email?: string;
  politica_nombre?: string;
  prioridad?: string;
  estado?: string;
  nodo_actual_id?: string;
  nodo_actual_nombre?: string;
  semaforizacion?: string;
  fecha_inicio?: string;
  fecha_limite?: string;
  tiempo_restante_horas?: number;
  funcionario_asignado_id?: string;
  funcionario_asignado_nombre?: string;
  progreso?: number;
}

interface TramiteBandejaResponseBackend {
  total?: number;
  pagina_actual?: number;
  total_paginas?: number;
  pendientes?: number;
  en_progreso?: number;
  observados?: number;
  finalizados?: number;
  semaforizacion?: {
    verde?: number;
    amarillo?: number;
    rojo?: number;
  };
  tramites?: TramiteBandejaBackend[];
}

export interface TramiteBandejaResponseDTO {
  total: number;
  paginaActual: number;
  totalPaginas: number;
  pendientes: number;
  enProgreso: number;
  observados: number;
  finalizados: number;
  semaforizacion: {
    verde: number;
    amarillo: number;
    rojo: number;
  };
  tramites: TramiteResumenDTO[];
}

@Injectable({ providedIn: 'root' })
export class TramiteService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/tramites`;

  /** CU-12: Inicia un nuevo trámite (clienteId viene del JWT). */
  iniciar(politicaId: string, duracionDias?: number): Observable<Tramite> {
    const payload: any = { politicaId };
    if (typeof duracionDias === 'number') payload.duracionDias = duracionDias;
    return this.http.post<Tramite>(this.apiUrl, payload);
  }

  /** CU-12: Lista los trámites del cliente autenticado. */
  listarMisTramites(): Observable<Tramite[]> {
    return this.http.get<Tramite[]>(`${this.apiUrl}/mis-tramites`).pipe(
      catchError(() => of([]))
    );
  }

  /** CU-12: Obtiene el formulario del paso actual de un trámite. */
  obtenerFormularioActual(idInstancia: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${idInstancia}/formulario-actual`);
  }

  /** CU-12: Guarda las respuestas del paso actual y avanza al siguiente. */
  responder(idInstancia: string, nodoId: string, respuestas: Record<string, any>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${idInstancia}/responder`, { nodoId, respuestas });
  }

  /** CU-14: Funcionario guarda respuestas del paso actual y avanza al siguiente nodo. */
  responderFuncionario(idInstancia: string, nodoId: string, respuestas: Record<string, any>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${idInstancia}/responder-funcionario`, { nodoId, respuestas });
  }

  /** CU-12: Obtiene el detalle completo de un trámite. */
  obtenerDetalle(id: string): Observable<Tramite> {
    return this.http.get<Tramite>(`${this.apiUrl}/${id}`);
  }

  /** CU-13: Lista trámites para la bandeja del funcionario. Devuelve siempre el arreglo mapeado. */
  listarBandeja(unidadId: string): Observable<TramiteResumenDTO[]> {
    return this.http.get<TramiteBandejaResponseBackend | TramiteBandejaBackend[]>(`${this.apiUrl}/bandeja/${unidadId}`).pipe(
      map(response => mapBandejaResponse(response).tramites),
      catchError(() => of([] as TramiteResumenDTO[]))
    );
  }

  /** CU-14: Avanza el trámite al siguiente paso (funcionario). */
  avanzar(id: string, datosFormulario: Record<string, any>): Observable<Tramite> {
    const usuario = this.auth.getUsuario();
    const payload = { ...datosFormulario, usuario_id: usuario?.id ?? usuario?.email ?? null };
    return this.http.post<Tramite>(`${this.apiUrl}/${id}/transicion`, payload);
  }

  /** CU-14: Guarda datos adicionales en el trámite (firma del funcionario, etc.). */
  guardarDatos(id: string, datos: Record<string, any>): Observable<any> {
    const usuario = this.auth.getUsuario();
    const payload = { datos, usuario_id: usuario?.id ?? usuario?.email ?? null };
    return this.http.put<any>(`${this.apiUrl}/${id}/datos`, payload);
  }

  /** Cancela un trámite. */
  cancelar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}

function mapBandejaItem(item: TramiteBandejaBackend): TramiteResumenDTO {
  const semaforizacion = normalizarSemaforo(item.semaforizacion);
  const prioridad = normalizarPrioridad(item.prioridad);
  const tiempoRestanteHoras = item.tiempo_restante_horas ?? 0;

  return {
    id: item.id,
    politicaNombre: item.politica_nombre || 'Política sin nombre',
    clienteNombre: item.cliente_nombre || 'Cliente sin nombre',
    clienteEmail: item.cliente_email,
    prioridad,
    estado: (item.estado as TramiteResumenDTO['estado']) || 'pendiente',
    pasoActualNombre: item.nodo_actual_nombre || 'Paso actual',
    pasoActualId: item.nodo_actual_id,
    progreso: typeof item.progreso === 'number' ? item.progreso : 0,
    semaforizacion,
    fechaInicio: item.fecha_inicio,
    fechaLimite: item.fecha_limite,
    tiempoRestanteHoras,
    funcionarioAsignadoId: item.funcionario_asignado_id,
    funcionarioAsignadoNombre: item.funcionario_asignado_nombre,
    venceEn: tiempoRestanteHoras <= 0 ? 'Hoy' : `${tiempoRestanteHoras}h`
  };
}

function mapBandejaResponse(response: TramiteBandejaResponseBackend | TramiteBandejaBackend[]): TramiteBandejaResponseDTO {
  const lista = Array.isArray(response) ? response : (response.tramites || []);
  const tramites = lista.map(mapBandejaItem);

  if (Array.isArray(response)) {
    return {
      total: tramites.length,
      paginaActual: 1,
      totalPaginas: 1,
      pendientes: tramites.filter(t => t.estado === 'pendiente').length,
      enProgreso: tramites.filter(t => t.estado === 'en_progreso').length,
      observados: tramites.filter(t => t.estado === 'observado').length,
      finalizados: tramites.filter(t => t.estado === 'finalizado').length,
      semaforizacion: contarSemaforos(tramites),
      tramites
    };
  }

  return {
    total: response.total ?? tramites.length,
    paginaActual: response.pagina_actual ?? 1,
    totalPaginas: response.total_paginas ?? 1,
    pendientes: response.pendientes ?? tramites.filter(t => t.estado === 'pendiente').length,
    enProgreso: response.en_progreso ?? tramites.filter(t => t.estado === 'en_progreso').length,
    observados: response.observados ?? tramites.filter(t => t.estado === 'observado').length,
    finalizados: response.finalizados ?? tramites.filter(t => t.estado === 'finalizado').length,
    semaforizacion: {
      verde: response.semaforizacion?.verde ?? tramites.filter(t => t.semaforizacion === 'Verde').length,
      amarillo: response.semaforizacion?.amarillo ?? tramites.filter(t => t.semaforizacion === 'Amarillo').length,
      rojo: response.semaforizacion?.rojo ?? tramites.filter(t => t.semaforizacion === 'Rojo').length
    },
    tramites
  };
}

function contarSemaforos(tramites: TramiteResumenDTO[]) {
  return {
    verde: tramites.filter(t => t.semaforizacion === 'Verde').length,
    amarillo: tramites.filter(t => t.semaforizacion === 'Amarillo').length,
    rojo: tramites.filter(t => t.semaforizacion === 'Rojo').length
  };
}

function emptyBandejaResponse(): TramiteBandejaResponseDTO {
  return {
    total: 0,
    paginaActual: 1,
    totalPaginas: 1,
    pendientes: 0,
    enProgreso: 0,
    observados: 0,
    finalizados: 0,
    semaforizacion: {
      verde: 0,
      amarillo: 0,
      rojo: 0
    },
    tramites: []
  };
}

function normalizarSemaforo(valor?: string): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
  if (!valor) {
    return undefined;
  }

  const normalizado = valor.trim().toLowerCase();
  if (normalizado === 'rojo') return 'Rojo';
  if (normalizado === 'amarillo') return 'Amarillo';
  if (normalizado === 'verde') return 'Verde';
  return undefined;
}

function normalizarPrioridad(valor?: string): TramiteResumenDTO['prioridad'] {
  const normalizado = (valor || '').trim().toLowerCase();
  if (normalizado === 'urgente' || normalizado === 'alta' || normalizado === 'alto') {
    return 'urgente';
  }
  if (normalizado === 'prioritario' || normalizado === 'media' || normalizado === 'medio') {
    return 'prioritario';
  }
  return 'normal';
}
