import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Unidad {
  id?: string;
  nombre: string;
  sigla: string;
  esta_activa: boolean;
  empresa_id: string;
  padre_id?: string;
}

@Injectable({ providedIn: 'root' })
export class UnidadService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/unidades`;

  obtenerTodasLasUnidades(): Observable<Unidad[]> {
    return this.http.get<Unidad[]>(this.apiUrl);
  }

  obtenerUnidadesPorEmpresa(empresaId: string): Observable<Unidad[]> {
    return this.http.get<Unidad[]>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  crearUnidad(unidad: Unidad): Observable<Unidad> {
    return this.http.post<Unidad>(this.apiUrl, unidad);
  }

  actualizarUnidad(id: string, unidad: Unidad): Observable<Unidad> {
    return this.http.put<Unidad>(`${this.apiUrl}/${id}`, unidad);
  }

  eliminarUnidad(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
