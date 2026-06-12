import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-consulta-tramite',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#F1F5F9] flex flex-col items-center justify-center p-4 font-sans">

      <!-- Header -->
      <div class="flex items-center gap-2 mb-10">
        <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
          <span class="material-symbols-outlined text-white text-sm">architecture</span>
        </div>
        <h1 class="text-xl font-bold text-slate-900 tracking-tight">NexusFlow</h1>
      </div>

      <div class="w-full max-w-xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden">

        <!-- Card header -->
        <div class="bg-slate-900 p-5 sm:p-8 text-center">
          <span class="material-symbols-outlined text-4xl text-blue-300 mb-3 block">search</span>
          <h2 class="text-2xl font-bold text-white font-headline mb-1">Consultar Trámite</h2>
          <p class="text-slate-400 text-sm">Ingresa el código del trámite para ver su estado actual</p>
        </div>

        <div class="p-5 sm:p-8">

          <!-- Formulario de búsqueda -->
          @if (!tramite()) {
            @if (error()) {
              <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <p class="text-sm text-red-700 font-medium">{{ error() }}</p>
              </div>
            }

            <form (ngSubmit)="consultar()" class="space-y-5">
              <div>
                <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Código del Trámite
                </label>
                <input
                  type="text"
                  [(ngModel)]="codigoIngresado"
                  name="codigo"
                  placeholder="Ej: 6842a1f3c9d..."
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                  [disabled]="buscando()">
                <p class="mt-1.5 text-xs text-slate-400">El código completo fue entregado al titular del trámite</p>
              </div>

              <button type="submit" [disabled]="buscando() || !codigoIngresado.trim()"
                class="w-full py-3.5 bg-slate-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                @if (buscando()) { <span class="animate-spin">⏳</span> Buscando... }
                @else { Consultar Estado <span class="material-symbols-outlined text-lg">search</span> }
              </button>
            </form>
          }

          <!-- Resultado del trámite -->
          @if (tramite()) {
            <div class="space-y-5">

              <!-- Estado principal -->
              <div class="rounded-xl p-5 text-center" [ngClass]="bgEstado()">
                <p class="text-xs font-bold uppercase tracking-widest mb-1 opacity-70">Estado del Trámite</p>
                <p class="text-2xl font-bold capitalize">{{ tramite()?.estado?.replace('_', ' ') }}</p>
                @if (tramite()?.nombre_tramite) {
                  <p class="text-sm mt-1 opacity-70">{{ tramite()?.nombre_tramite }}</p>
                }
              </div>

              <!-- Semáforo + código -->
              <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-50 rounded-xl p-4 text-center">
                  <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Semáforo</p>
                  <div class="flex items-center justify-center gap-2">
                    <div class="w-3 h-3 rounded-full" [ngClass]="colorSemaforo()"></div>
                    <span class="font-semibold text-slate-800">{{ tramite()?.semaforizacion || 'Verde' }}</span>
                  </div>
                </div>
                <div class="bg-slate-50 rounded-xl p-4 text-center">
                  <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Código</p>
                  <p class="font-mono font-bold text-slate-800">#{{ (tramite()?.id || '').substring(0, 8).toUpperCase() }}</p>
                </div>
              </div>

              <!-- Fechas -->
              <div class="bg-slate-50 rounded-xl p-4 space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-slate-500 font-medium">Fecha inicio</span>
                  <span class="font-semibold text-slate-800">{{ formatFecha(tramite()?.fecha_inicio) }}</span>
                </div>
                @if (tramite()?.fecha_limite) {
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500 font-medium">Fecha límite</span>
                    <span class="font-semibold text-slate-800">{{ formatFecha(tramite()?.fecha_limite) }}</span>
                  </div>
                }
                @if (tramite()?.fecha_fin) {
                  <div class="flex justify-between text-sm">
                    <span class="text-slate-500 font-medium">Fecha finalización</span>
                    <span class="font-semibold text-emerald-700">{{ formatFecha(tramite()?.fecha_fin) }}</span>
                  </div>
                }
              </div>

              <!-- Historial de pasos -->
              @if (tramite()?.historial?.length) {
                <div>
                  <p class="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Historial de Pasos</p>
                  <div class="space-y-2">
                    @for (h of tramite()?.historial; track $index) {
                      <div class="flex items-center gap-3 text-sm">
                        <div class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {{ $index + 1 }}
                        </div>
                        <div class="flex-1">
                          <span class="font-semibold text-slate-700">{{ h.paso || 'Paso completado' }}</span>
                          @if (h.fecha) {
                            <span class="text-slate-400 text-xs ml-2">{{ formatFecha(h.fecha) }}</span>
                          }
                        </div>
                        <span class="material-symbols-outlined text-emerald-500 text-[16px]">check_circle</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Botón nueva consulta -->
              <button type="button" (click)="nuevaConsulta()"
                class="w-full py-3 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
                Consultar otro trámite
              </button>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="px-5 sm:px-8 pb-5 sm:pb-6 text-center">
          <a routerLink="/login" class="text-xs text-slate-400 hover:text-blue-600 transition-colors font-medium">
            ← Volver al inicio de sesión
          </a>
        </div>
      </div>

      <p class="mt-8 text-xs text-slate-400">NexusFlow — Portal de consulta pública de trámites</p>
    </div>
  `
})
export class ConsultaTramiteComponent {
  private http = inject(HttpClient);

  codigoIngresado = '';
  buscando = signal(false);
  error = signal('');
  tramite = signal<any>(null);

  consultar() {
    const codigo = this.codigoIngresado.trim();
    if (!codigo) return;
    this.buscando.set(true);
    this.error.set('');
    this.tramite.set(null);

    this.http.get<any>(`${environment.apiUrl}/tramites/${codigo}/consulta-publica`).subscribe({
      next: (data) => {
        this.buscando.set(false);
        this.tramite.set(data);
      },
      error: (err) => {
        this.buscando.set(false);
        if (err.status === 404) {
          this.error.set('No se encontró ningún trámite con ese código. Verifica que sea correcto.');
        } else {
          this.error.set('Error al consultar. Intenta nuevamente.');
        }
      }
    });
  }

  nuevaConsulta() {
    this.tramite.set(null);
    this.error.set('');
    this.codigoIngresado = '';
  }

  bgEstado(): string {
    const estado = this.tramite()?.estado;
    if (estado === 'finalizado') return 'bg-emerald-50 text-emerald-800';
    if (estado === 'en_proceso') return 'bg-blue-50 text-blue-800';
    if (estado === 'observado') return 'bg-amber-50 text-amber-800';
    return 'bg-slate-50 text-slate-800';
  }

  colorSemaforo(): string {
    switch (this.tramite()?.semaforizacion) {
      case 'Rojo': return 'bg-red-500';
      case 'Amarillo': return 'bg-amber-400';
      default: return 'bg-emerald-500';
    }
  }

  formatFecha(f: any): string {
    if (!f) return '—';
    try { return new Date(f).toLocaleString('es-BO'); } catch { return String(f); }
  }
}
