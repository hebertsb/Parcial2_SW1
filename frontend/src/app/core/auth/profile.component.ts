import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h2 class="text-3xl font-bold text-slate-800 dark:text-white mb-2 font-headline">Mi Perfil</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">Administra tu información personal y la seguridad de tu cuenta.</p>
      </div>

      <div class="bg-white dark:bg-[#151822] border border-slate-200 dark:border-slate-800 rounded-xl p-8 shadow-sm">
        <div class="flex items-center gap-6 mb-8 pb-8 border-b border-slate-200 dark:border-slate-800">
          <div class="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNjsR4Da5tTiCEZh1dkFCz88_Vw6_1kUVcjSKNYAjTTtBKazbSNQzs2A_q1bcnzHVRJLDBM--IVIujK4jKHnB90jcQYpALxPrglJAJ8TUxhh7WYFiyjYDbsnspCOTRcmcTZJ585Xu3FNeOEcgzdTK_JuGKniFYgZDuhnJHNLrj8CpNyMpbcDQuYf5eUGGLXRuaXwWv8pg675gCGai_A8qSTifu7J40ZjPPNGBPDxV6VZTMCXVaG1dNBWI2jkgSUL7jZFMyKohNV3Vy" class="w-full h-full object-cover">
          </div>
          <div>
            <h3 class="text-2xl font-bold text-slate-800 dark:text-white">{{ authService.getUsuario()?.nombre }}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ authService.getUsuario()?.email }}</p>
            <span class="inline-block mt-3 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              {{ authService.getRol() }}
            </span>
          </div>
        </div>

        <h4 class="text-lg font-bold text-slate-800 dark:text-white mb-6">Seguridad: Cambiar Contraseña</h4>
        
        @if (successMessage()) {
          <div class="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
            <p class="text-sm text-emerald-700 dark:text-emerald-400 font-medium">{{ successMessage() }}</p>
          </div>
        }
        @if (errorMessage()) {
          <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-700 dark:text-red-400 font-medium">{{ errorMessage() }}</p>
          </div>
        }

        <form (ngSubmit)="onChangePassword()" class="flex flex-col gap-5 max-w-md">
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Contraseña Actual o Token Temporal</label>
            <input 
              type="password" 
              name="passwordActual"
              [(ngModel)]="passwordActual"
              placeholder="••••••••" 
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              [disabled]="isLoading()">
          </div>
          
          <div class="flex flex-col gap-1">
            <label class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Nueva Contraseña</label>
            <input 
              type="password" 
              name="nuevaPassword"
              [(ngModel)]="nuevaPassword"
              placeholder="••••••••" 
              class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              [disabled]="isLoading()">
          </div>

          <button 
            type="submit" 
            class="mt-2 w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            [disabled]="isLoading() || !passwordActual() || !nuevaPassword()">
            @if (isLoading()) {
              <span class="animate-spin">⏳</span> Actualizando...
            } @else {
              Actualizar Contraseña
            }
          </button>
        </form>
      </div>
    </div>
  `
})
export class ProfileComponent {
  authService = inject(AuthService);
  
  passwordActual = signal('');
  nuevaPassword = signal('');
  
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  onChangePassword() {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.passwordActual() || !this.nuevaPassword()) {
      this.errorMessage.set('Completa todos los campos');
      return;
    }

    const email = this.authService.getUsuario()?.email;
    if (!email) {
      this.errorMessage.set('Error: No se encontró el email del usuario.');
      return;
    }

    this.isLoading.set(true);
    this.authService.cambiarPassword(email, this.passwordActual(), this.nuevaPassword()).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.successMessage.set(res.mensaje || 'Contraseña actualizada con éxito. Ya puedes usar tu nueva contraseña.');
        this.passwordActual.set('');
        this.nuevaPassword.set('');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.error || 'Error al actualizar la contraseña. Verifica que tu contraseña actual/token sea correcto.');
      }
    });
  }
}
