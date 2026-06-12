import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger rutas de invitados (como /login).
 * Si el usuario ya está autenticado e intenta ir al login (por ejemplo, dándole al botón "Atrás"),
 * lo redirigimos automáticamente a su panel correspondiente para evitar que salga sin cerrar sesión.
 */
export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  
  if (authService.estaAutenticado()) {
    // Si ya está logueado, lo devolvemos a su dashboard
    const redirectUrl = authService.getRedirectUrlByRol();
    router.navigate([redirectUrl], { replaceUrl: true });
    return false;
  }
  
  // Si no está logueado, lo dejamos ver el login
  return true;
};
