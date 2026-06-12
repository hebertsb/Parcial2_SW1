import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class LayoutService {
  isSidebarOpen = signal(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  /** True mientras el editor colaborativo está abierto — oculta el FAB del agente IA */
  editorColabAbierto = signal(false);

  toggleSidebar() {
    this.isSidebarOpen.update(state => !state);
  }

  closeSidebar() {
    this.isSidebarOpen.set(false);
  }
}
