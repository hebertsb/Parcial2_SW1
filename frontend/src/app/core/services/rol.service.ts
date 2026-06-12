import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Rol {
  id?: string;
  nombre_rol: string;
  es_nucleo: boolean;
  empresa_id: string;
  permisos: { [key: string]: boolean };
}

@Injectable({ providedIn: 'root' })
export class RolService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/roles`;

  obtenerRolesPorEmpresa(empresaId: string): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  obtenerTodosLosRoles(): Observable<Rol[]> {
    return this.http.get<Rol[]>(this.apiUrl);
  }

  crearRol(rol: Rol): Observable<Rol> {
    return this.http.post<Rol>(this.apiUrl, rol);
  }

  actualizarRol(id: string, rol: Rol): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/${id}`, rol);
  }

  eliminarRol(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
