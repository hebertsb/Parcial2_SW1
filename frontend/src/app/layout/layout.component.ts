import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgClass } from '@angular/common';
import { SidebarComponent } from './sidebar/sidebar.component';
import { TopnavComponent } from './topnav/topnav.component';
import { LayoutService } from '../core/services/layout.service';
import { AuthService } from '../core/services/auth.service';
import { NotificacionService } from '../core/services/notificacion.service';
import { IaAssistantFabComponent } from '../shared/components/ia-assistant-fab/ia-assistant-fab.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, NgClass, SidebarComponent, TopnavComponent, IaAssistantFabComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-slate-100 dark:bg-[#0f111a] transition-colors duration-300 print:h-auto print:bg-white print:overflow-visible">
      <app-sidebar class="print:hidden"></app-sidebar>

      @if (layoutService.isSidebarOpen()) {
        <div class="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity print:hidden"
             (click)="layoutService.closeSidebar()"></div>
      }

      <div
        class="flex-1 flex flex-col h-screen overflow-hidden w-full transition-all duration-300 print:ml-0 print:h-auto print:overflow-visible"
        [ngClass]="layoutService.isSidebarOpen() ? 'lg:ml-60' : 'lg:ml-0'">
        <app-topnav class="print:hidden"></app-topnav>
        <main class="flex-1 p-4 sm:p-8 overflow-y-auto relative print:p-0 print:overflow-visible">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- FAB IA — visible para todos los roles autenticados -->
      <app-ia-assistant-fab class="print:hidden"></app-ia-assistant-fab>
    </div>
  `
})
export class LayoutComponent implements OnInit {
  layoutService = inject(LayoutService);
  private authSvc = inject(AuthService);
  private notificacionSvc = inject(NotificacionService);

  ngOnInit(): void {
    this.notificacionSvc.registrarPushGlobal();
    this.notificacionSvc.conectarWebSocket();
    this.notificacionSvc.iniciarPolling();
  }

  esAdminODisenador(): boolean {
    const rol = this.authSvc.getRol();
    return rol === 'ROL-ADMIN' || rol === 'ROL-DISEÑADOR' || rol === 'ROL-SUPER';
  }
}
