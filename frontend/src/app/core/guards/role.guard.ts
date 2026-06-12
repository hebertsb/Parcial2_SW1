import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { UserRol } from '../../data/models/auth.model';

@Injectable({ providedIn: 'root' })
export class RoleGuardService {
  constructor(private authService: AuthService, private router: Router) {}

  canActivateWithRole(rol: UserRol): boolean {
    if (this.authService.estaAutenticado() && this.authService.getRol() === rol) {
      return true;
    }
    this.router.navigate(['/login']);
    return false;
  }
}

// Guards funcionales por rol
export const superAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado() && authService.getRol() === 'ROL-SUPER') {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado() && authService.getRol() === 'ROL-ADMIN') {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

export const designerGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado() && authService.getRol() === 'ROL-DISEÑADOR') {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

export const employeeGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado() && authService.getRol() === 'ROL-FUNCIONARIO') {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

export const clientGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado() && authService.getRol() === 'ROL-CLIENTE') {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};

export const designerOrAdminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const rol = authService.getRol();
  
  if (authService.estaAutenticado() && (rol === 'ROL-ADMIN' || rol === 'ROL-DISEÑADOR')) {
    return true;
  }
  
  router.navigate(['/login']);
  return false;
};
