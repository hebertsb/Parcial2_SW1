import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class IaAssistantService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  // ── CU-19: Analítica ──────────────────────────────────────────
  getCuellosBotella(empresaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/analytics/cuellos-botella/${empresaId}`)
      .pipe(catchError(() => of([])));
  }

  getSugerencias(empresaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/analytics/sugerencias/${empresaId}`)
      .pipe(catchError(() => of([])));
  }

  getAlertas(empresaId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/analytics/alertas/${empresaId}`)
      .pipe(catchError(() => of([])));
  }

  reasignarTareas(nodoId: string, umbral: number, funcionarioId: string): Observable<any> {
    return this.http.post<any>(`${this.api}/analytics/reasignar`, {
      nodoId,
      umbral: String(umbral),
      funcionarioId
    }).pipe(catchError(() => of({ error: true })));
  }

  escalarVencidos(adminId: string): Observable<any> {
    return this.http.post<any>(`${this.api}/analytics/escalar`, { adminId })
      .pipe(catchError(() => of({ error: true })));
  }

  // ── CU-17: Generar diagrama con IA ───────────────────────────
  generarDiagrama(descripcion: string, politicaId: string): Observable<any> {
    return this.http.post<any>(`${this.api}/ia/generar-y-guardar`, { descripcion, politicaId })
      .pipe(catchError(err => of({ error: err?.error ?? 'Error al generar' })));
  }

  // ── CU-17b: Editar diagrama existente con IA ─────────────────
  editarDiagrama(politicaId: string, instruccion: string): Observable<any> {
    return this.http.post<any>(`${this.api}/ia/editar-diagrama/${politicaId}`, { instruccion })
      .pipe(catchError(err => of({ error: err?.error ?? 'Error al editar' })));
  }

  // ── CU-18: Transcripción de voz ───────────────────────────────
  transcribirVoz(audioBase64: string): Observable<any> {
    return this.http.post<any>(`${this.api}/ia/transcribir-voz`, { audio: audioBase64 })
      .pipe(catchError(() => of(null)));
  }
}
