/**
 * FlujoEditorService
 * ------------------
 * Persiste el esquema del workflow (pasos + relaciones) dentro de la Política.
 *
 * Estrategia usada para no depender de que Spring Boot exponga endpoints nuevos
 * hoy mismo: el esquema completo se guarda dentro de politica.esquema_workflow
 * vía PUT /api/politicas/{id}/esquema (endpoint que ya existe en FRONTEND_ARCHITECTURE).
 *
 * Cuando el backend del compañero esté disponible, se puede pasar al endpoint
 * granular (POST /api/politicas/{id}/pasos, PUT /api/politicas/{id}/relaciones, ...).
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Carril,
  EsquemaWorkflow,
  FlujoRelacion,
  Paso,
  TipoFlujo,
} from '../models/flujo.models';

@Injectable({ providedIn: 'root' })
export class FlujoEditorService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/politicas`;

  /** Obtiene la Política completa (incluye esquema_workflow si lo hay). */
  obtenerPolitica(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`).pipe(
      catchError(() =>
        this.http
          .get<any[]>(this.apiUrl)
          .pipe(map((list) => list.find((p) => p.id === id))),
      ),
    );
  }

  /** Lee el esquema tipado desde la política. Devuelve un esquema vacío si no existe. */
  obtenerEsquema(politicaId: string): Observable<EsquemaWorkflow> {
    return this.obtenerPolitica(politicaId).pipe(
      map((pol) => this.normalizarEsquema(pol?.esquema_workflow, pol?.tipo_flujo)),
    );
  }

  /** Guarda el esquema completo (operación atómica). */
  guardarEsquema(
    politicaId: string,
    esquema: EsquemaWorkflow,
  ): Observable<any> {
    return this.http.put(`${this.apiUrl}/${politicaId}/esquema`, esquema);
  }

  // ------------------------------------------------------------
  // Operaciones granulares (optimistas, se propagan por STOMP
  // y se consolidan periódicamente con guardarEsquema).
  // ------------------------------------------------------------

  crearPasoLocal(
    esquema: EsquemaWorkflow,
    nuevo: Omit<Paso, 'id' | 'orden'> & Partial<Pick<Paso, 'id' | 'orden'>>,
  ): Paso {
    const orden =
      nuevo.orden ??
      (esquema.pasos.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1);
    const paso: Paso = {
      id: nuevo.id ?? this.uuid(),
      politicaId: nuevo.politicaId,
      nombre: nuevo.nombre ?? `Paso ${orden}`,
      orden,
      obligatorio: nuevo.obligatorio ?? true,
      x: nuevo.x ?? 120 + orden * 40,
      y: nuevo.y ?? 120 + orden * 40,
      formularioId: nuevo.formularioId ?? null,
      departamentoId: nuevo.departamentoId ?? null,
      esUltimo: nuevo.esUltimo ?? false,
      tipoPaso: nuevo.tipoPaso,
      campotipo: nuevo.campotipo,
    };
    esquema.pasos = [...esquema.pasos, paso];
    return paso;
  }

  actualizarPasoLocal(esquema: EsquemaWorkflow, id: string, patch: Partial<Paso>): void {
    esquema.pasos = esquema.pasos.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    );
  }

  eliminarPasoLocal(esquema: EsquemaWorkflow, id: string): void {
    esquema.pasos = esquema.pasos.filter((p) => p.id !== id);
    esquema.relaciones = esquema.relaciones.filter(
      (r) => r.padreId !== id && r.destinoId !== id,
    );
  }

  crearRelacionLocal(
    esquema: EsquemaWorkflow,
    padreId: string,
    destinoId: string,
    tipo: FlujoRelacion['tipo'],
    politicaId: string,
  ): FlujoRelacion {
    const rel: FlujoRelacion = {
      id: this.uuid(),
      politicaId,
      padreId,
      destinoId,
      tipo,
      condicion: null,
    };
    esquema.relaciones = [...esquema.relaciones, rel];
    return rel;
  }

  actualizarRelacionLocal(
    esquema: EsquemaWorkflow,
    id: string,
    patch: Partial<FlujoRelacion>,
  ): void {
    esquema.relaciones = esquema.relaciones.map((r) =>
      r.id === id ? { ...r, ...patch } : r,
    );
  }

  eliminarRelacionLocal(esquema: EsquemaWorkflow, id: string): void {
    esquema.relaciones = esquema.relaciones.filter((r) => r.id !== id);
  }

  // ------------------------------------------------------------

  normalizarEsquema(raw: any, tipoFlujo?: TipoFlujo): EsquemaWorkflow {
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) {}
    }
    
    // Si es un esquema legacy de JointJS, lo reiniciamos
    if (raw && (raw.cells || raw.enlaces || !raw.pasos)) {
      raw = null;
    }

    if (!raw) {
      return {
        version: 1,
        tipoFlujo: tipoFlujo ?? 'secuencial',
        pasos: [],
        relaciones: [],
        formularios: [],
      };
    }
    return {
      version: raw.version ?? 1,
      tipoFlujo: raw.tipoFlujo ?? tipoFlujo ?? 'secuencial',
      pasos: Array.isArray(raw.pasos) ? raw.pasos.map((p: any, i: number) => ({
        ...p,
        x: typeof p.x === 'number' && !isNaN(p.x) ? p.x : 120 + (i * 60),
        y: typeof p.y === 'number' && !isNaN(p.y) ? p.y : 120 + (i * 60),
        orden: typeof p.orden === 'number' && !isNaN(p.orden) ? p.orden : i + 1
      })) : [],
      relaciones: Array.isArray(raw.relaciones) ? raw.relaciones : [],
      formularios: Array.isArray(raw.formularios) ? raw.formularios : [],
      carriles: Array.isArray(raw.carriles) ? raw.carriles as Carril[] : undefined,
    };
  }

  uuid(): string {
    // uuid v4 sin dependencias
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /** Fallback en caso de que el backend aún no tenga el endpoint del esquema. */
  guardarEsquemaSafe(politicaId: string, esquema: EsquemaWorkflow): Observable<boolean> {
    return this.guardarEsquema(politicaId, esquema).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
