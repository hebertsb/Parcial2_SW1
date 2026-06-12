import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { EmpresaService } from '../../core/services/empresa.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar flex flex-col text-slate-300 border-r border-slate-800 h-screen fixed left-0 top-0 bg-slate-900 z-50 p-6 w-60 max-w-[85vw] transform transition-transform duration-300 ease-in-out lg:translate-x-0"
         [class.-translate-x-full]="!layoutService.isSidebarOpen()"
         [class.translate-x-0]="layoutService.isSidebarOpen()">

      <!-- Logo + empresa -->
      <div class="mb-8 px-2 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
            <span class="text-white font-bold text-xs">NF</span>
          </div>
          <div>
            <h1 class="text-xl font-bold text-white tracking-tight">NexusFlow</h1>
            <p class="text-[10px] text-blue-400 font-bold uppercase truncate max-w-[130px]" [title]="nombreEmpresa()">
              {{ nombreEmpresa() }}
            </p>
          </div>
        </div>
        <button class="lg:hidden text-slate-400 hover:text-white" (click)="layoutService.closeSidebar()">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Navegación -->
      <div class="flex-1 space-y-1 overflow-y-auto mt-4 px-2">

        <!-- SuperAdmin -->
        @if (authService.getRol() === 'ROL-SUPER') {
          <div class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2 mt-4">Administración Global</div>
          <a routerLink="/superadmin/dashboard" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center">🌍</span>
            Panel SuperAdmin
          </a>
        }

        <!-- Admin -->
        @if (authService.getRol() === 'ROL-ADMIN') {
          <a routerLink="/admin/dashboard" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">dashboard</span>
            Panel Principal
          </a>

          <div class="mt-4 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3">Gestión Organizacional</div>
          <a routerLink="/admin/gestion-personal" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">group</span>
            Personal y Accesos
          </a>
          <a routerLink="/admin/politicas" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors mt-1">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">schema</span>
            Políticas de Negocio
          </a>

          <div class="mt-4 mb-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3">Inteligencia Artificial</div>
          <a routerLink="/admin/ia-dashboard" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">model_training</span>
            Motor Deep Learning
          </a>
          <a routerLink="/admin/agente-reportes" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors mt-1">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">support_agent</span>
            Agente & Reportes
          </a>
        }

        <!-- Diseñador -->
        @if (authService.getRol() === 'ROL-DISEÑADOR') {
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">Diseño de Flujos</div>
          <a routerLink="/admin/politicas" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">schema</span>
            Políticas de Negocio
          </a>
        }

        <!-- Cliente -->
        @if (authService.getRol() === 'ROL-CLIENTE') {
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">Mis Trámites</div>
          <a routerLink="/client/dashboard" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">folder_open</span>
            Mis Solicitudes
          </a>
        }

        <!-- Funcionario -->
        @if (authService.getRol() === 'ROL-FUNCIONARIO') {
          <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 mb-1">Bandeja de Trabajo</div>
          <a routerLink="/employee/inbox" (click)="closeOnMobile()"
            routerLinkActive="bg-slate-800 text-white"
            class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors">
            <span class="w-5 text-center material-symbols-outlined text-[18px]">inbox</span>
            Bandeja de Entrada
          </a>
        }

        <!-- Estado del sistema -->
        <div class="mt-8 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">Estado del sistema</div>
        <div class="px-2 space-y-3">
          <div class="flex items-center justify-between text-[11px]">
            <span>Autenticación</span>
            <span class="text-emerald-400">● Activa</span>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span>API Backend</span>
            <span class="text-emerald-400">● Conectado</span>
          </div>
        </div>
      </div>

      <!-- Cerrar sesión -->
      <div class="px-2 mt-auto">
        <button (click)="onLogout()"
          class="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer w-full">
          <span class="w-5 text-center material-symbols-outlined text-[18px]">logout</span>
          Cerrar Sesión
        </button>
      </div>
      <div class="pt-4 border-t border-slate-800 mt-4 text-center">
        <span class="text-[10px] text-slate-500 block">v2.4.0-NexusFlow-Stable</span>
      </div>
    </nav>
  `
})
export class SidebarComponent implements OnInit {
  layoutService = inject(LayoutService);
  authService = inject(AuthService);
  private empresaService = inject(EmpresaService);
  private router = inject(Router);

  nombreEmpresa = signal('Cargando...');

  ngOnInit(): void {
    const empresaId = this.authService.getUsuario()?.empresa ?? '';
    if (!empresaId) {
      this.nombreEmpresa.set('Global');
      return;
    }
    this.empresaService.obtenerEmpresas().subscribe({
      next: (lista) => {
        let match = lista.find(e => e.id === empresaId || (e as any)._id === empresaId);
        // Usuarios seed con "EMP-DEFAULT" (id sin empresa registrada):
        // mostrar la empresa del sistema en lugar del id crudo
        if (!match && empresaId === 'EMP-DEFAULT' && lista.length > 0) {
          match = lista[0];
        }
        this.nombreEmpresa.set(match?.nombre_legal ?? empresaId);
      },
      error: () => this.nombreEmpresa.set(empresaId),
    });
  }

  closeOnMobile() {
    if (window.innerWidth < 1024) this.layoutService.closeSidebar();
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
