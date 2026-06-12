import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, AuthUser, AuthState, UserRol } from '../../data/models/auth.model';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth/login`;
  private tokenKey = 'nexusflow_token';
  private userKey = 'nexusflow_user';
  private rolKey = 'nexusflow_rol';

  // Señales reactivas para el estado de autenticación
  private authState = signal<AuthState>({
    token: this.getStoredToken(),
    usuario: this.getStoredUser(),
    isAuthenticated: !!this.getStoredToken(),
    rol: this.getStoredRol()
  });

  readonly isAuthenticated = this.authState.asReadonly();

  constructor(private http: HttpClient) {
    // Sincronizar estado inicial del localStorage
    this.loadAuthState();
  }

  /**
   * Iniciar sesión con email y contraseña (CU-01)
   */
  login(credentials: LoginRequest, recordarSesion: boolean = false): Observable<LoginResponse> {
    return this.http.post<any>(this.apiUrl, credentials).pipe(
      tap(response => {
        if (!response.token) {
          throw new Error('Sin token en response');
        }

        const storage = recordarSesion ? localStorage : sessionStorage;
        const otherStorage = recordarSesion ? sessionStorage : localStorage;

        // Limpiar otra persistencia para evitar sesiones duplicadas
        otherStorage.removeItem(this.tokenKey);
        otherStorage.removeItem(this.userKey);
        otherStorage.removeItem(this.rolKey);

        // Guardar token en storage elegido
        storage.setItem(this.tokenKey, response.token);
        
        // Extraer rol: primero del response, luego del usuario, luego del token
        let rol: string = response.rol || (response.usuario && (response.usuario as any).rol_id) || this.extractRolFromToken(response.token) || 'ROL-CLIENTE';
        storage.setItem(this.rolKey, rol);
        
        // Procesar usuario: puede venir como string o como objeto
        let usuario: AuthUser;
        if (typeof response.usuario === 'string') {
          // Si viene como string, usar el nombre directamente
          usuario = {
            nombre: response.usuario,
            email: credentials.email,
            rol: rol
          };
        } else {
          // Si viene como objeto
          const usuarioData: any = response.usuario || {};
          usuario = {
            id: usuarioData.id,
            nombre: usuarioData.nombre_completo || usuarioData.nombre || usuarioData.name || 'Usuario',
            email: usuarioData.correo_electronico || usuarioData.email || credentials.email,
            rol: rol,
            empresa: usuarioData.empresa_id || usuarioData.empresa || usuarioData.company,
            unidadId: usuarioData.unidad_id || usuarioData.unidadId
          };
        }
        storage.setItem(this.userKey, JSON.stringify(usuario));
        
        // Actualizar estado
        this.authState.set({
          token: response.token,
          usuario: usuario,
          isAuthenticated: true,
          rol: rol
        });
      })
    );
  }

  /**
   * CU-02: Solicitar recuperación de contraseña (envía email / genera token)
   */
  solicitarRecuperacion(email: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/recuperar-password`, { email });
  }

  /**
   * CU-02: Restablecer la contraseña con el token temporal y la nueva contraseña (desde fuera sin login)
   */
  restablecerPassword(token: string, nuevaPassword: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/restablecer-password`, { token, nuevaPassword });
  }

  /**
   * CU-02: Cambiar contraseña desde el perfil (estando logueado) usando token o contraseña actual
   */
  cambiarPassword(email: string, passwordActual: string, nuevaPassword: string): Observable<any> {
    return this.http.post<any>(`${environment.apiUrl}/auth/cambiar-password`, { email, passwordActual, nuevaPassword });
  }

  /**
   * Cerrar sesión (CU-03)
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.rolKey);
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.rolKey);
    this.authState.set({
      token: null,
      usuario: null,
      isAuthenticated: false,
      rol: null
    });
  }

  /**
   * Obtener token almacenado
   */
  getToken(): string | null {
    return this.authState().token;
  }

  /**
   * Obtener usuario autenticado
   */
  getUsuario(): AuthUser | null {
    return this.authState().usuario;
  }

  /**
   * Obtener rol del usuario
   */
  getRol(): UserRol | null {
    return this.authState().rol as UserRol;
  }

  /**
   * Verificar si está autenticado
   */
  estaAutenticado(): boolean {
    return this.authState().isAuthenticated;
  }

  /**
   * Obtener URL de redirección según el rol
   */
  getRedirectUrlByRol(): string {
    const rol = this.getRol();
    return this.mapRolToRoute(rol);
  }

  /**
   * Mapear rol a ruta
   */
  private mapRolToRoute(rol: UserRol | null): string {
    switch(rol) {
      case 'ROL-SUPER':
        return '/superadmin/dashboard';
      case 'ROL-ADMIN':
        return '/admin/dashboard';
      case 'ROL-DISEÑADOR':
        return '/admin/politicas';
      case 'ROL-FUNCIONARIO':
        return '/employee/inbox';
      case 'ROL-CLIENTE':
        return '/client/dashboard';
      default:
        return '/login';
    }
  }

  /**
    * Cargar estado de autenticación desde storage
   */
  private loadAuthState(): void {
    const token = this.getStoredToken();
    const usuario = this.getStoredUser();
    const rol = this.getStoredRol();
    
    if (token && usuario) {
      this.authState.set({
        token,
        usuario,
        isAuthenticated: true,
        rol: rol
      });
    }
  }

  /**
   * Obtener token almacenado (prioriza sessionStorage)
   */
  private getStoredToken(): string | null {
    return sessionStorage.getItem(this.tokenKey) || localStorage.getItem(this.tokenKey);
  }

  /**
   * Obtener usuario almacenado (prioriza sessionStorage)
   */
  private getStoredUser(): AuthUser | null {
    const user = sessionStorage.getItem(this.userKey) || localStorage.getItem(this.userKey);
    return user ? JSON.parse(user) : null;
  }

  /**
   * Obtener rol almacenado con fallback al token
   */
  private getStoredRol(): string | null {
    let rol = sessionStorage.getItem(this.rolKey) || localStorage.getItem(this.rolKey);
    if (!rol) {
      const token = this.getStoredToken();
      if (token) {
        rol = this.extractRolFromToken(token);
        if (rol) {
          sessionStorage.setItem(this.rolKey, rol);
        }
      }
    }
    return rol;
  }

  /**
   * Extraer rol del JWT token (payload)
   */
  /**
   * Extrae el rol del JWT token
   * Intenta múltiples campos: 'rol', 'role', 'authorities'
   */
  private extractRolFromToken(token: string): UserRol | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }
      
      const payload = JSON.parse(atob(parts[1]));
      
      // Intentar múltiples nombres de campo
      const rol = payload.rol || payload.role || payload.authorities?.[0];
      
      return rol || null;
    } catch (error) {
      return null;
    }
  }
}
