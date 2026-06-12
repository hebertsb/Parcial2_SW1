import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Empresa {
  id?: string;
  nombre_legal: string;
  nit: string;
  telefono: string;
  direccion: string;
  estado: string;
  plan_suscripcion: string;
  fecha_registro?: string;
}

export interface AdminData {
  nombre_completo: string;
  correo_electronico: string;
  clave_hash: string;
}

@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/empresas`;

  obtenerEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.apiUrl);
  }

  registrarEmpresaConAdmin(empresa: Empresa, admin: AdminData): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/registrar-con-admin`, { empresa, admin });
  }

  eliminarEmpresa(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${id}`);
  }
}
