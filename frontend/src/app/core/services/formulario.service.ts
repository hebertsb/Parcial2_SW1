/**
 * FormularioService (CU-11)
 * -------------------------
 * CRUD de formularios dinámicos y sus campos.
 * Se integra con RealtimeService para emitir / recibir cambios campo a campo
 * y sincronizar dos diseñadores en tiempo real.
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { CampoFormulario, Formulario, TipoCampo } from '../models/flujo.models';

@Injectable({ providedIn: 'root' })
export class FormularioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/formularios`;

  listar(politicaId?: string): Observable<Formulario[]> {
    const url = politicaId
      ? `${this.apiUrl}?politicaId=${politicaId}`
      : this.apiUrl;
    return this.http
      .get<Formulario[]>(url)
      .pipe(catchError(() => of([] as Formulario[])));
  }

  /** Obtiene el formulario asociado a un paso específico. */
  obtenerPorPaso(pasoId: string): Observable<Formulario | null> {
    return this.http
      .get<Formulario>(`${this.apiUrl}/paso/${pasoId}`)
      .pipe(catchError(() => of(null)));
  }

  obtener(id: string): Observable<Formulario | null> {
    return this.http
      .get<Formulario>(`${this.apiUrl}/${id}`)
      .pipe(catchError(() => of(null)));
  }

  crear(formulario: Partial<Formulario>): Observable<Formulario> {
    return this.http.post<Formulario>(this.apiUrl, formulario);
  }

  actualizar(id: string, patch: Partial<Formulario>): Observable<Formulario> {
    return this.http.put<Formulario>(`${this.apiUrl}/${id}`, patch);
  }

  eliminar(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // ---- Campos ----

  agregarCampo(formularioId: string, campo: Partial<CampoFormulario>): Observable<CampoFormulario> {
    return this.http.post<CampoFormulario>(
      `${this.apiUrl}/${formularioId}/campos`,
      campo,
    );
  }

  actualizarCampo(
    formularioId: string,
    campoId: string,
    patch: Partial<CampoFormulario>,
  ): Observable<CampoFormulario> {
    return this.http.put<CampoFormulario>(
      `${this.apiUrl}/${formularioId}/campos/${campoId}`,
      patch,
    );
  }

  eliminarCampo(formularioId: string, campoId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${formularioId}/campos/${campoId}`);
  }

  // ---- Helpers ----

  etiquetaTipo(tipo: TipoCampo): string {
    switch (tipo) {
      case 'texto': return 'Texto';
      case 'texto_largo': return 'Texto largo';
      case 'numero': return 'Número';
      case 'lista': return 'Lista';
      case 'si_no': return 'Sí / No';
      case 'fecha': return 'Fecha';
      case 'archivo': return 'Archivo';
      case 'firma': return 'Firma Digital';
      case 'label': return 'Etiqueta';
      case 'grid': return 'Tabla / Grid';
      default: return 'Desconocido';
    }
  }

  iconoTipo(tipo: TipoCampo): string {
    switch (tipo) {
      case 'texto': return 'text_fields';
      case 'texto_largo': return 'notes';
      case 'numero': return 'tag';
      case 'lista': return 'list';
      case 'si_no': return 'check_box';
      case 'fecha': return 'event';
      case 'archivo': return 'attach_file';
      case 'firma': return 'draw';
      case 'label': return 'label';
      case 'grid': return 'table_chart';
      default: return 'help';
    }
  }
}
