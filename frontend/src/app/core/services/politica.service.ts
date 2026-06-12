import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Politica {
  id?: string;
  nombre: string;
  tipo_flujo: string;
  duracion_estandar_dias?: number;
  esta_activa?: boolean;
  fecha_activacion?: string;
  esquema_workflow?: any;
  empresa_id?: string;
  formularios_ids?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class PoliticaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/politicas`;

  obtenerTodasLasPoliticas(): Observable<Politica[]> {
    return this.http.get<Politica[]>(this.apiUrl);
  }

  obtenerPoliticasPorEmpresa(empresaId: string): Observable<Politica[]> {
    return this.http.get<Politica[]>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  crearPolitica(politica: Politica): Observable<Politica> {
    return this.http.post<Politica>(this.apiUrl, politica);
  }

  actualizarPolitica(id: string, politica: Politica): Observable<Politica> {
    return this.http.put<Politica>(`${this.apiUrl}/${id}`, politica);
  }

  // Las otras rutas de actualizarEsquema y configurarNodo se implementarán después para CU-09/10/11
}
