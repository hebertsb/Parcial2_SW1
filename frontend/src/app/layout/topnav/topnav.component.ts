import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NotificacionService } from '../../core/services/notificacion.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topnav',
  standalone: true,
  imports: [RouterLink, CommonModule],
  template: `
    <header class="h-16 lg:h-20 bg-white dark:bg-[#151822] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 shrink-0 z-30 transition-all duration-300">
      <div class="flex items-center gap-4">
        <button class="lg:hidden p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" (click)="layoutService.toggleSidebar()">
          <span class="material-symbols-outlined">menu</span>
        </button>

        <div class="hidden sm:flex items-center text-sm px-3 py-1.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 w-48 md:w-64 lg:w-80">
          <span class="material-symbols-outlined text-[18px] mr-2">search</span>
          <input type="text" placeholder="Buscar..." class="bg-transparent border-none outline-none w-full text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500">
        </div>
      </div>

      <div class="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
        <a href="#" class="hover:text-slate-900 dark:hover:text-white transition-colors">Documentos</a>
        <a href="#" class="hover:text-slate-900 dark:hover:text-white transition-colors">Mercado</a>
        <a href="#" class="hover:text-slate-900 dark:hover:text-white transition-colors">Registros</a>
      </div>

      <div class="flex items-center gap-2 sm:gap-4 shrink-0">
        <div class="text-right hidden sm:block">
          <div class="text-xs font-bold text-slate-900 dark:text-white">{{ usuarioNombre() }}</div>
          <div class="text-[10px] text-slate-400 font-mono">{{ usuarioRol() }}</div>
        </div>
        <button (click)="themeService.toggleTheme()" title="Cambiar Tema" class="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1 cursor-pointer items-center justify-center hidden sm:flex">
          <span class="material-symbols-outlined text-[22px]">
            {{ themeService.isDarkMode() ? 'light_mode' : 'dark_mode' }}
          </span>
        </button>

        <!-- ── Campana de notificaciones ── -->
        <div class="relative">
          <button (click)="toggleDropdown()" class="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative">
            <span class="material-symbols-outlined text-[22px]">notifications</span>
            @if (notificacionSvc.noLeidas() > 0) {
              <span class="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-blue-500 border-2 border-white dark:border-[#151822] flex items-center justify-center text-[9px] font-bold text-white leading-none px-0.5">
                {{ notificacionSvc.noLeidas() > 9 ? '9+' : notificacionSvc.noLeidas() }}
              </span>
            } @else {
              <span class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 border border-white dark:border-[#151822]"></span>
            }
          </button>

          <!-- Dropdown -->
          @if (dropdownOpen()) {
            <!-- Overlay para cerrar al hacer click fuera -->
            <div class="fixed inset-0 z-40" (click)="dropdownOpen.set(false)"></div>

            <div class="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#1e2234] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              <!-- Header del dropdown -->
              <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <span class="text-sm font-semibold text-slate-800 dark:text-white">
                  Notificaciones
                  @if (notificacionSvc.noLeidas() > 0) {
                    <span class="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded-full">{{ notificacionSvc.noLeidas() }} nuevas</span>
                  }
                </span>
                @if (notificacionSvc.noLeidas() > 0) {
                  <button (click)="marcarTodas()" class="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 font-medium">Marcar todas leídas</button>
                }
              </div>

              <!-- Lista de notificaciones -->
              <div class="max-h-80 overflow-y-auto">
                @if (notificacionSvc.notificaciones().length === 0) {
                  <div class="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-500">
                    <span class="material-symbols-outlined text-4xl mb-2">notifications_none</span>
                    <p class="text-sm">Sin notificaciones</p>
                  </div>
                }
                @for (n of notificacionSvc.notificaciones().slice(0, 20); track n.id) {
                  <div
                    class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    [class.bg-blue-50]="!n.leida"
                    [class.dark:bg-blue-950]="!n.leida"
                    (click)="leer(n.id)"
                  >
                    <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                         [class.bg-blue-100]="!n.leida" [class.bg-slate-100]="n.leida"
                         [class.dark:bg-blue-900]="!n.leida" [class.dark:bg-slate-700]="n.leida">
                      <span class="material-symbols-outlined text-[16px]"
                            [class.text-blue-500]="!n.leida" [class.text-slate-400]="n.leida">
                        {{ n.icono || 'notifications' }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-xs font-semibold text-slate-800 dark:text-white truncate">{{ n.titulo || 'Notificación' }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{{ n.mensaje }}</p>
                      <p class="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{{ n.fechaCreacion | date:'dd/MM HH:mm' }}</p>
                      @if (n.tipo === 'EDICION_SOLICITADA' && docKeyDe(n)) {
                        <button (click)="abrirDocumento(n); $event.stopPropagation()"
                          class="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 transition-colors">
                          <span class="material-symbols-outlined text-[14px]">edit_document</span>
                          Abrir documento
                        </button>
                      }
                    </div>
                    @if (!n.leida) {
                      <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <div routerLink="/profile" class="h-8 w-8 sm:h-10 sm:w-10 bg-slate-200 dark:bg-slate-800 rounded-full border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden ml-1 sm:ml-2 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all">
          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNjsR4Da5tTiCEZh1dkFCz88_Vw6_1kUVcjSKNYAjTTtBKazbSNQzs2A_q1bcnzHVRJLDBM--IVIujK4jKHnB90jcQYpALxPrglJAJ8TUxhh7WYFiyjYDbsnspCOTRcmcTZJ585Xu3FNeOEcgzdTK_JuGKniFYgZDuhnJHNLrj8CpNyMpbcDQuYf5eUGGLXRuaXwWv8pg675gCGai_A8qSTifu7J40ZjPPNGBPDxV6VZTMCXVaG1dNBWI2jkgSUL7jZFMyKohNV3Vy" class="w-full h-full object-cover">
        </div>
      </div>
    </header>
  `
})
export class TopnavComponent {
  layoutService = inject(LayoutService);
  themeService = inject(ThemeService);
  notificacionSvc = inject(NotificacionService);
  private authService = inject(AuthService);
  private router = inject(Router);

  dropdownOpen = signal(false);

  toggleDropdown(): void {
    this.dropdownOpen.update(v => !v);
    if (this.dropdownOpen()) {
      this.notificacionSvc.recargar();
    }
  }

  leer(id: string): void {
    this.notificacionSvc.leerLocal(id);
  }

  /** Clave MinIO del documento asociado a la notificación (con fallback legado) */
  docKeyDe(n: any): string | null {
    if (n.docKey) return n.docKey;
    // Notificaciones antiguas guardaban la key del documento en tramiteId
    if (n.tramiteId && n.tramiteId.includes('/')) return n.tramiteId;
    return null;
  }

  /** Abre el editor colaborativo directo desde la notificación de la campana */
  abrirDocumento(n: any): void {
    const docKey = this.docKeyDe(n);
    if (!docKey) return;

    // tramiteId real: campo propio, o tercer segmento de la key (empresa/politica/tramite/archivo)
    let tramiteId = n.tramiteId && !n.tramiteId.includes('/') ? n.tramiteId : '';
    if (!tramiteId) {
      const partes = docKey.split('/');
      if (partes.length >= 4) tramiteId = partes[2];
    }

    this.leer(n.id);
    this.dropdownOpen.set(false);

    const rol = this.authService.getRol();
    if (rol === 'ROL-FUNCIONARIO') {
      this.router.navigate(['/employee/inbox'], {
        queryParams: { abrirDoc: docKey, tramiteId, docNombre: n.docNombre ?? '' },
        onSameUrlNavigation: 'reload'
      });
    } else if (tramiteId) {
      this.router.navigate(['/tramites', tramiteId, 'detalle'], {
        queryParams: { abrirDoc: docKey }
      });
    }
  }

  marcarTodas(): void {
    this.notificacionSvc.leerTodasLocal();
  }

  usuarioNombre() {
    return this.authService.getUsuario()?.nombre || 'Usuario';
  }

  usuarioRol() {
    return this.authService.getUsuario()?.rol || 'USER';
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
