import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Usuario {
  id?: string;
  nombre_completo: string;
  correo_electronico: string;
  clave_hash?: string; // Solo para creacion
  telefono?: string;
  sexo?: string;
  esta_activo: boolean;
  empresa_id: string;
  rol_id: string;
  unidad_id?: string;
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/usuarios`;

  obtenerUsuariosPorEmpresa(empresaId: string): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(`${this.apiUrl}/empresa/${empresaId}`);
  }

  obtenerTodosLosUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  obtenerMiPerfil(): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/perfil`);
  }

  obtenerUsuario(id: string): Observable<Usuario> {
    return this.http.get<Usuario>(`${this.apiUrl}/${id}`);
  }

  registrarUsuario(usuario: Usuario): Observable<Usuario> {
    // Registro administrativo (Admin crea personal) — usa POST /api/usuarios
    return this.http.post<Usuario>(this.apiUrl, usuario);
  }

  registrarCliente(datos: { nombre_completo: string; correo_electronico: string; clave_hash: string; telefono?: string; empresa_id?: string }): Observable<any> {
    // Auto-registro público desde la página de login — usa POST /api/usuarios/registrar
    return this.http.post<any>(`${this.apiUrl}/registrar`, datos);
  }

  actualizarUsuario(id: string, usuario: Usuario): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.apiUrl}/${id}`, usuario);
  }

  desactivarUsuario(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
