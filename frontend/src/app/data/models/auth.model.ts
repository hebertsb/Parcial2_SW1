/**
 * Modelos para autenticación (CU-01)
 * Interfaces para login, response y datos del usuario
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: string | {
    id?: string;
    email?: string;
    nombre?: string;
    empresa?: string;
    unidad_id?: string;
  };
  rol?: string;
  redirectUrl?: string;
}

export interface AuthUser {
  id?: string;
  email: string;
  nombre: string;
  rol: string;
  empresa?: string;
  unidadId?: string;
}

export interface AuthState {
  token: string | null;
  usuario: AuthUser | null;
  isAuthenticated: boolean;
  rol: string | null;
}

export type UserRol = 'ROL-SUPER' | 'ROL-ADMIN' | 'ROL-DISEÑADOR' | 'ROL-FUNCIONARIO' | 'ROL-CLIENTE';
