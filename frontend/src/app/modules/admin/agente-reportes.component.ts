import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';

// ── Interfaces ─────────────────────────────────────────────────────
interface PoliticaCandidata {
  id: string; nombre: string; descripcion: string;
  tipo_flujo: string; duracion_dias: number;
  requisitos: string[]; pasos: string[]; score: number;
}
interface ClasificarResponse {
  politica_recomendada: PoliticaCandidata | null;
  politicas_candidatas: PoliticaCandidata[];
  respuesta_agente: string; confianza: number;
  total_politicas_revisadas: number; metodo: string;
}
interface Estadisticas {
  total: number;
  por_estado?: Record<string, number>;
  por_accion?: Record<string, number>;
  por_semaforo?: Record<string, number>;
  colores_estado?: Record<string, string>;
  colores_accion?: Record<string, string>;
  timeline?: Record<string, number>;
  timeline_label?: string;
}
interface ReporteResponse {
  archivo_b64: string; nombre_archivo: string; mime_type: string;
  total_registros: number; consulta_interpretada: string;
  formato: string; coleccion_consultada: string;
  datos_preview: Record<string, any>[];
  estadisticas: Estadisticas;
  columnas: string[];
}
interface DonutItem { label: string; value: number; pct: number; color: string; startDeg: number; }
interface BarItem  { label: string; value: number; pct: number; color: string; }
interface VistaPredefinida {
  label: string; icono: string; coleccion: string;
  estado?: string; accion?: string; periodo: string; descripcion: string;
}

@Component({
  selector: 'app-agente-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .custom-scroll::-webkit-scrollbar { width: 4px; }
    .custom-scroll::-webkit-scrollbar-track { background: transparent; }
    .custom-scroll::-webkit-scrollbar-thumb { background: #475569; border-radius: 9999px; }
    .custom-scroll::-webkit-scrollbar-thumb:hover { background: #64748b; }
  `],
  template: `
<div class="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto w-full">

  <!-- HEADER -->
  <div>
    <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-slate-800 dark:text-white mb-1">
      Agente IA & Reportes Dinámicos
    </h2>
    <p class="text-sm text-slate-500 dark:text-slate-400">
      Clasificador de políticas · Generación de reportes PDF / Excel / Word · Análisis por audiencia
    </p>
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- SECCIÓN 1 — AGENTE CLASIFICADOR                               -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
    <div class="flex items-center gap-3 mb-5">
      <div class="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
        <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">support_agent</span>
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-800 dark:text-white">Agente Clasificador de Políticas</h3>
        <p class="text-xs text-slate-500">Analiza la necesidad del cliente y recomienda qué trámite iniciar</p>
      </div>
    </div>

    <div class="relative mb-4">
      <textarea [(ngModel)]="consultaAgente" rows="3"
        placeholder="Ej: Necesito solicitar un crédito vehicular, tengo ingresos fijos..."
        class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900
               text-slate-800 dark:text-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none
               focus:ring-2 focus:ring-blue-500 resize-none">
      </textarea>
      <button (click)="grabar('agente')" [disabled]="transcribiendoAgente()"
        [title]="grabandoAgente() ? 'Detener grabación' : 'Hablar (dictado por voz)'"
        class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
        [class]="grabandoAgente()
          ? 'bg-red-500 text-white animate-pulse'
          : transcribiendoAgente()
            ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:bg-blue-200'">
        <span class="material-symbols-outlined text-[18px]">
          {{ grabandoAgente() ? 'stop' : transcribiendoAgente() ? 'hourglass_empty' : 'mic' }}
        </span>
      </button>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      <p class="text-xs text-slate-500 font-semibold w-full">Ejemplos de consultas:</p>
      @for (sug of sugerenciasAgente; track sug) {
        <button (click)="consultaAgente = sug"
          class="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
                 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-full
                 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-left">
          {{ sug }}
        </button>
      }
    </div>

    <button (click)="clasificar()" [disabled]="clasificando() || !consultaAgente.trim()"
      class="bg-blue-600 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow
             hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-60 mb-6">
      <span class="material-symbols-outlined text-sm" [class.animate-spin]="clasificando()">psychology</span>
      {{ clasificando() ? 'Analizando...' : 'Clasificar Necesidad' }}
    </button>

    @if (resultadoAgente()) {
      <div class="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-4">
        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 mt-0.5">smart_toy</span>
            <div>
              <p class="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">Respuesta del Agente</p>
              <p class="text-sm text-slate-700 dark:text-slate-300">{{ resultadoAgente()!.respuesta_agente }}</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="text-center bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Confianza</p>
            <p class="text-xl font-bold" [class]="confianzaColor()">{{ (resultadoAgente()!.confianza * 100).toFixed(0) }}%</p>
          </div>
          <div class="text-center bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Políticas revisadas</p>
            <p class="text-xl font-bold text-slate-700 dark:text-white">{{ resultadoAgente()!.total_politicas_revisadas }}</p>
          </div>
          <div class="text-center bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
            <p class="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Método</p>
            <p class="text-xs font-bold text-slate-700 dark:text-white">{{ resultadoAgente()!.metodo === 'ia_openai' ? 'IA OpenAI' : 'Keywords' }}</p>
          </div>
        </div>
        @if (resultadoAgente()!.politica_recomendada) {
          <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
            <p class="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">✓ Política Recomendada</p>
            <p class="font-bold text-slate-800 dark:text-white text-base">{{ resultadoAgente()!.politica_recomendada!.nombre }}</p>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">{{ resultadoAgente()!.politica_recomendada!.descripcion }}</p>
            <div class="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-700 flex flex-col sm:flex-row gap-2">
              <button (click)="copiarLinkCliente(resultadoAgente()!.politica_recomendada!.id)"
                class="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl
                       bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                <span class="material-symbols-outlined text-[18px]">
                  {{ linkCopiado() ? 'check_circle' : 'link' }}
                </span>
                {{ linkCopiado() ? '¡Link copiado!' : 'Copiar link para cliente' }}
              </button>
            </div>
            @if (linkCopiado()) {
              <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-2 text-center">
                El cliente abrirá ese link → si no tiene sesión irá al login → al ingresar se carga la política automáticamente
              </p>
            }
          </div>
        }
      </div>
    }
    @if (!resultadoAgente() && !clasificando()) {
      <div class="text-center py-6 text-slate-400 dark:text-slate-600">
        <span class="material-symbols-outlined text-4xl mb-2 block">support_agent</span>
        <p class="text-sm">Describí la necesidad del cliente para identificar el trámite correcto</p>
      </div>
    }
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- SECCIÓN 2 — REPORTES DINÁMICOS                                -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
    <div class="flex items-center gap-3 mb-5">
      <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
        <span class="material-symbols-outlined text-emerald-600 dark:text-emerald-400">assessment</span>
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-800 dark:text-white">Reportes Dinámicos</h3>
        <p class="text-xs text-slate-500">Filtros estructurados o lenguaje natural · PDF / Excel / Word · Gráficos en tiempo real</p>
      </div>
    </div>

    <!-- Tab selector -->
    <div class="flex gap-1 bg-slate-100 dark:bg-slate-900 rounded-xl p-1 mb-5 w-fit">
      <button (click)="modoConsulta.set('estructurado')"
        [class]="modoConsulta() === 'estructurado'
          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
        class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-sm">tune</span>Filtros
      </button>
      <button (click)="modoConsulta.set('natural')"
        [class]="modoConsulta() === 'natural'
          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
        class="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5">
        <span class="material-symbols-outlined text-sm">chat</span>Lenguaje Natural
      </button>
    </div>

    <!-- Panel: Filtros Estructurados -->
    @if (modoConsulta() === 'estructurado') {
      <div class="space-y-5 mb-5">

        <!-- Colección — segmented control -->
        <div>
          <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Colección</p>
          <div class="inline-flex bg-slate-100 dark:bg-slate-900 rounded-xl p-1 gap-0.5">
            @for (col of COLECCIONES; track col.valor) {
              <button (click)="coleccionSel.set(col.valor); estadoSel.set(''); accionSel.set('')"
                [class]="coleccionSel() === col.valor
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                class="flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-sm font-semibold transition-all whitespace-nowrap">
                <span class="material-symbols-outlined text-sm">{{ col.icono }}</span>{{ col.label }}
              </button>
            }
          </div>
        </div>

        <!-- Estado / Período — custom dropdowns -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <!-- Estado o Acción — custom dropdown -->
          @if (coleccionSel() !== 'Politica') {
            <div>
              <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                {{ coleccionSel() === 'Tramite' ? 'Estado' : 'Acción' }}
              </p>
              <div class="relative">
                <button (click)="openDropdown.set(openDropdown() === 'estado' ? '' : 'estado')"
                  [class]="openDropdown() === 'estado'
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'"
                  class="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl
                         bg-white dark:bg-slate-900 border text-sm font-medium
                         text-slate-700 dark:text-slate-200 transition-all">
                  <span class="w-2.5 h-2.5 rounded-full shrink-0 transition-colors"
                    [style.background-color]="getEstadoColor()"></span>
                  <span class="flex-1 text-left">
                    {{ coleccionSel() === 'Tramite' ? estadoLabel() : accionLabel() }}
                  </span>
                  <span class="material-symbols-outlined text-slate-400 text-base transition-transform duration-200"
                    [class.rotate-180]="openDropdown() === 'estado'">expand_more</span>
                </button>
                @if (openDropdown() === 'estado') {
                  <div class="fixed inset-0 z-10" (click)="openDropdown.set('')"></div>
                  <div class="absolute top-full left-0 right-0 mt-1.5 z-20
                              bg-white dark:bg-slate-800 rounded-xl shadow-2xl
                              border border-slate-100 dark:border-slate-700 py-1.5
                              max-h-56 overflow-y-auto custom-scroll">
                    @if (coleccionSel() === 'Tramite') {
                      @for (est of ESTADOS_TRAMITE; track est.valor) {
                        <button (click)="estadoSel.set(est.valor); openDropdown.set('')"
                          [class]="estadoSel() === est.valor
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
                          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors">
                          <span class="w-2 h-2 rounded-full shrink-0"
                            [style.background-color]="COLORES_ESTADO[est.valor] || '#94a3b8'"></span>
                          <span class="flex-1 text-left">{{ est.label }}</span>
                          @if (estadoSel() === est.valor) {
                            <span class="material-symbols-outlined text-emerald-500 text-base">check</span>
                          }
                        </button>
                      }
                    } @else {
                      @for (ac of ACCIONES_BITACORA; track ac.valor) {
                        <button (click)="accionSel.set(ac.valor); openDropdown.set('')"
                          [class]="accionSel() === ac.valor
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
                          class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors">
                          <span class="w-2 h-2 rounded-full shrink-0"
                            [style.background-color]="COLORES_ACCION[ac.valor] || '#94a3b8'"></span>
                          <span class="flex-1 text-left">{{ ac.label }}</span>
                          @if (accionSel() === ac.valor) {
                            <span class="material-symbols-outlined text-emerald-500 text-base">check</span>
                          }
                        </button>
                      }
                    }
                  </div>
                }
              </div>
            </div>
          }

          <!-- Período — custom dropdown -->
          <div [class]="coleccionSel() === 'Politica' ? 'sm:col-span-2' : ''">
            <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Período</p>
            <div class="relative">
              <button (click)="openDropdown.set(openDropdown() === 'periodo' ? '' : 'periodo')"
                [class]="openDropdown() === 'periodo'
                  ? 'border-emerald-500 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-emerald-400'"
                class="flex items-center gap-2.5 w-full px-3.5 py-2.5 rounded-xl
                       bg-white dark:bg-slate-900 border text-sm font-medium
                       text-slate-700 dark:text-slate-200 transition-all">
                <span class="material-symbols-outlined text-slate-400 text-base">calendar_month</span>
                <span class="flex-1 text-left">{{ periodoLabel() }}</span>
                <span class="material-symbols-outlined text-slate-400 text-base transition-transform duration-200"
                  [class.rotate-180]="openDropdown() === 'periodo'">expand_more</span>
              </button>
              @if (openDropdown() === 'periodo') {
                <div class="fixed inset-0 z-10" (click)="openDropdown.set('')"></div>
                <div class="absolute top-full left-0 right-0 mt-1.5 z-20
                            bg-white dark:bg-slate-800 rounded-xl shadow-2xl
                            border border-slate-100 dark:border-slate-700 py-1.5
                            max-h-56 overflow-y-auto custom-scroll">
                  @for (p of PERIODOS; track p.valor) {
                    <button (click)="periodoSel.set(p.valor); openDropdown.set('')"
                      [class]="periodoSel() === p.valor
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'"
                      class="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors">
                      <span class="material-symbols-outlined text-base shrink-0">
                        {{ p.valor === 'personalizado' ? 'date_range' : p.valor === '' ? 'all_inclusive' : 'today' }}
                      </span>
                      <span class="flex-1 text-left">{{ p.label }}</span>
                      @if (periodoSel() === p.valor) {
                        <span class="material-symbols-outlined text-emerald-500 text-base">check</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
          </div>
        </div>

        <!-- Rango personalizado -->
        @if (periodoSel() === 'personalizado') {
          <div class="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Desde</label>
              <input type="date" [(ngModel)]="fechaDesdeVal"
                class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
                       text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Hasta</label>
              <input type="date" [(ngModel)]="fechaHastaVal"
                class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
                       text-slate-800 dark:text-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            </div>
          </div>
        }

        <!-- Límite — segmented pills -->
        <div class="flex items-center gap-3 flex-wrap">
          <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest shrink-0">Registros</p>
          <div class="flex bg-slate-100 dark:bg-slate-900 rounded-xl p-0.5 gap-0.5">
            @for (n of ['50','100','200','500','1000']; track n) {
              <button (click)="limiteVal = n"
                [class]="limiteVal === n
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                class="px-3 py-1 rounded-[9px] text-xs font-semibold transition-all">
                {{ n }}
              </button>
            }
          </div>
        </div>
      </div>
    }

    <!-- Panel: Lenguaje Natural -->
    @if (modoConsulta() === 'natural') {
      <div class="mb-5">
        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">¿Qué reporte necesitás?</label>
        <div class="relative mb-3">
          <textarea [(ngModel)]="consultaReporte" rows="3"
            placeholder="Ej: Dame todos los trámites finalizados del último mes con detalle de cliente..."
            class="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900
                   text-slate-800 dark:text-slate-200 px-4 py-3 pr-12 text-sm focus:outline-none
                   focus:ring-2 focus:ring-emerald-500 resize-none">
          </textarea>
          <button (click)="grabar('reporte')" [disabled]="transcribiendoReporte()"
            [title]="grabandoReporte() ? 'Detener grabación' : 'Hablar (dictado por voz)'"
            class="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            [class]="grabandoReporte()
              ? 'bg-red-500 text-white animate-pulse'
              : transcribiendoReporte()
                ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200'">
            <span class="material-symbols-outlined text-[18px]">
              {{ grabandoReporte() ? 'stop' : transcribiendoReporte() ? 'hourglass_empty' : 'mic' }}
            </span>
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <p class="text-xs text-slate-500 font-semibold w-full">Consultas rápidas:</p>
          @for (sug of sugerenciasReporte; track sug) {
            <button (click)="consultaReporte = sug"
              class="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300
                     border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors">
              {{ sug }}
            </button>
          }
        </div>
      </div>
    }

    <!-- Formato + Generar -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">Formato:</p>
      @for (fmt of formatos; track fmt.valor) {
        <button (click)="formatoSeleccionado = fmt.valor"
          [class]="formatoSeleccionado === fmt.valor
            ? 'bg-emerald-600 text-white border-emerald-600'
            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-emerald-400'"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-colors">
          <span class="material-symbols-outlined text-sm">{{ fmt.icono }}</span>{{ fmt.label }}
        </button>
      }
    </div>

    <button (click)="generarReporte()" [disabled]="generandoReporte() || !puedeGenerar()"
      class="bg-emerald-600 text-white font-semibold text-sm py-2.5 px-6 rounded-xl shadow
             hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-60">
      <span class="material-symbols-outlined text-sm" [class.animate-spin]="generandoReporte()">description</span>
      {{ generandoReporte() ? 'Generando reporte...' : 'Generar Reporte' }}
    </button>
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- SECCIÓN 3 — RESULTADO + PREVIEW + GRÁFICOS                    -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  @if (resultadoReporte()) {
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 space-y-6">

      <!-- Badge resultado + descarga -->
      <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-center gap-4">
        <span class="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-4xl">check_circle</span>
        <div class="flex-1 min-w-0">
          <p class="font-bold text-slate-800 dark:text-white">Reporte generado</p>
          <p class="text-sm text-slate-600 dark:text-slate-300">{{ resultadoReporte()!.consulta_interpretada }}</p>
          <p class="text-xs text-slate-500 mt-1">
            {{ resultadoReporte()!.total_registros }} registros ·
            {{ resultadoReporte()!.coleccion_consultada }} ·
            {{ resultadoReporte()!.nombre_archivo }}
          </p>
        </div>
        <button (click)="descargarReporte()"
          class="bg-emerald-600 text-white font-semibold text-sm py-2 px-4 rounded-xl
                 hover:bg-emerald-700 transition-colors flex items-center gap-2 shrink-0">
          <span class="material-symbols-outlined text-sm">download</span>Descargar
        </button>
      </div>

      <!-- Gráficos -->
      @if (resultadoReporte()!.estadisticas.total > 0) {
        <div>
          <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <span class="material-symbols-outlined text-base">bar_chart</span>
            Análisis Visual — {{ resultadoReporte()!.coleccion_consultada }}
          </h4>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <!-- Gráfico donut: distribución -->
            @if (donutItems().length > 0) {
              <div class="bg-slate-50 dark:bg-slate-900 rounded-xl p-5">
                <p class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
                  Distribución por {{ resultadoReporte()!.coleccion_consultada === 'Bitacora' ? 'Acción' : 'Estado' }}
                </p>
                <div class="flex items-center gap-6">
                  <!-- Donut CSS -->
                  <div class="relative shrink-0 w-36 h-36">
                    <div class="w-36 h-36 rounded-full" [style]="'background: ' + donutGradient()"></div>
                    <div class="absolute inset-[28%] rounded-full bg-slate-50 dark:bg-slate-900
                                flex flex-col items-center justify-center">
                      <span class="text-lg font-bold text-slate-800 dark:text-white leading-none">
                        {{ resultadoReporte()!.estadisticas.total }}
                      </span>
                      <span class="text-[9px] text-slate-500">total</span>
                    </div>
                  </div>
                  <!-- Leyenda -->
                  <div class="flex flex-col gap-2 flex-1 min-w-0">
                    @for (item of donutItems(); track item.label) {
                      <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-sm shrink-0" [style.background-color]="item.color"></div>
                        <span class="text-xs text-slate-600 dark:text-slate-400 truncate flex-1">{{ item.label }}</span>
                        <span class="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                          {{ item.value }} <span class="font-normal text-slate-400">({{ item.pct.toFixed(0) }}%)</span>
                        </span>
                      </div>
                    }
                  </div>
                </div>
              </div>
            }

            <!-- SVG Area Chart: timeline -->
            @if (svgChart(); as chart) {
              <div class="bg-slate-50 dark:bg-slate-900 rounded-xl p-5">
                <div class="flex items-center justify-between mb-3">
                  <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Actividad {{ resultadoReporte()!.estadisticas.timeline_label || 'por período' }}
                  </p>
                  <span class="text-[10px] text-slate-400 font-medium">
                    máx: {{ barMax() }} reg.
                  </span>
                </div>

                <svg [attr.viewBox]="'0 0 ' + chart.W + ' ' + chart.H"
                     class="w-full overflow-visible" style="height:160px">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stop-color="#3b82f6" stop-opacity="0.35"/>
                      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.02"/>
                    </linearGradient>
                  </defs>

                  <!-- Grid lines horizontales -->
                  @for (gl of chart.gridLines; track gl.y) {
                    <line [attr.x1]="chart.padL" [attr.x2]="chart.W - 10"
                          [attr.y1]="gl.y" [attr.y2]="gl.y"
                          stroke="#334155" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.5"/>
                    <text [attr.x]="chart.padL - 4" [attr.y]="gl.y + 3.5"
                          text-anchor="end" fill="#64748b" font-size="8">{{ gl.label }}</text>
                  }

                  <!-- Línea base -->
                  <line [attr.x1]="chart.padL" [attr.x2]="chart.W - 10"
                        [attr.y1]="chart.padT + chart.cH" [attr.y2]="chart.padT + chart.cH"
                        stroke="#475569" stroke-width="0.8" opacity="0.6"/>

                  <!-- Área rellena -->
                  @if (chart.n > 1) {
                    <path [attr.d]="chart.areaPath" fill="url(#areaGrad)"/>
                  }

                  <!-- Línea suavizada -->
                  <path [attr.d]="chart.linePath"
                        fill="none" stroke="#3b82f6" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round"/>

                  <!-- Puntos de datos -->
                  @for (p of chart.pts; track p.label; let i = $index) {
                    <circle [attr.cx]="p.x" [attr.cy]="p.y" r="3.5"
                            fill="#1e3a5f" stroke="#3b82f6" stroke-width="2"/>
                    <!-- Valor encima del punto si hay pocos puntos -->
                    @if (chart.n <= 10) {
                      <text [attr.x]="p.x" [attr.y]="p.y - 7"
                            text-anchor="middle" fill="#93c5fd" font-size="9" font-weight="600">
                        {{ p.value }}
                      </text>
                    }
                  }

                  <!-- Labels eje X -->
                  @for (p of chart.pts; track p.label; let i = $index) {
                    @if (i % chart.step === 0) {
                      <text [attr.x]="p.x" [attr.y]="chart.H - 6"
                            text-anchor="middle" fill="#64748b" font-size="8">
                        {{ p.label }}
                      </text>
                    }
                  }
                </svg>
              </div>
            }

          </div>

          <!-- KPI cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
              <p class="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mb-1">Total</p>
              <p class="text-2xl font-bold text-slate-800 dark:text-white">{{ resultadoReporte()!.estadisticas.total }}</p>
            </div>
            @if (resultadoReporte()!.estadisticas.por_estado?.['finalizado']) {
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                <p class="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 font-bold mb-1">Finalizados</p>
                <p class="text-2xl font-bold text-slate-800 dark:text-white">{{ resultadoReporte()!.estadisticas.por_estado!['finalizado'] }}</p>
              </div>
            }
            @if (resultadoReporte()!.estadisticas.por_accion?.['APROBAR']) {
              <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-center">
                <p class="text-[10px] uppercase tracking-wider text-green-600 dark:text-green-400 font-bold mb-1">Aprobaciones</p>
                <p class="text-2xl font-bold text-slate-800 dark:text-white">{{ resultadoReporte()!.estadisticas.por_accion!['APROBAR'] }}</p>
              </div>
            }
            @if (resultadoReporte()!.estadisticas.por_accion?.['RECHAZAR']) {
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                <p class="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 font-bold mb-1">Rechazos</p>
                <p class="text-2xl font-bold text-slate-800 dark:text-white">{{ resultadoReporte()!.estadisticas.por_accion!['RECHAZAR'] }}</p>
              </div>
            }
            @if (resultadoReporte()!.estadisticas.por_estado?.['rechazado']) {
              <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-center">
                <p class="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 font-bold mb-1">Rechazados</p>
                <p class="text-2xl font-bold text-slate-800 dark:text-white">{{ resultadoReporte()!.estadisticas.por_estado!['rechazado'] }}</p>
              </div>
            }
          </div>
        </div>
      }

      <!-- Preview tabla -->
      @if (resultadoReporte()!.datos_preview.length > 0) {
        <div>
          <h4 class="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <span class="material-symbols-outlined text-base">table_view</span>
            Vista previa — primeras {{ resultadoReporte()!.datos_preview.length }} filas
          </h4>
          <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table class="text-xs w-full">
              <thead class="bg-slate-100 dark:bg-slate-900">
                <tr>
                  @for (col of resultadoReporte()!.columnas; track col) {
                    <th class="px-3 py-2 text-left font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                      {{ colLabel(col) }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of resultadoReporte()!.datos_preview; track $index) {
                  <tr [class]="$index % 2 === 0 ? 'bg-white dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-900/50'">
                    @for (col of resultadoReporte()!.columnas; track col) {
                      <td class="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
                          [title]="row[col]?.toString()">
                        <span [class]="getCellClass(col, row[col])">{{ formatCellValue(col, row[col]) }}</span>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (resultadoReporte()!.total_registros > resultadoReporte()!.datos_preview.length) {
            <p class="text-xs text-slate-400 mt-2 text-center">
              Mostrando {{ resultadoReporte()!.datos_preview.length }} de {{ resultadoReporte()!.total_registros }} registros.
              Descargá el archivo para ver todos.
            </p>
          }
        </div>
      }

    </div>
  }

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- SECCIÓN 4 — VISTAS POR AUDIENCIA                              -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
    <div class="flex items-center gap-3 mb-5">
      <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
        <span class="material-symbols-outlined text-violet-600 dark:text-violet-400">groups</span>
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-800 dark:text-white">Reportes por Audiencia</h3>
        <p class="text-xs text-slate-500">Consultas predefinidas para empresa, funcionarios y clientes</p>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

      <!-- Empresa -->
      <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-blue-600 dark:text-blue-400">business</span>
          <p class="font-bold text-slate-700 dark:text-white text-sm">Vista Empresa</p>
        </div>
        <p class="text-xs text-slate-500 mb-3">KPIs generales de toda la operación</p>
        <div class="space-y-2">
          @for (v of VISTAS_EMPRESA; track v.label) {
            <button (click)="aplicarVista(v)"
              class="w-full text-left text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800
                     text-blue-700 dark:text-blue-300 px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">{{ v.icono }}</span>
              <span>{{ v.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Funcionarios -->
      <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-emerald-600 dark:text-emerald-400">manage_accounts</span>
          <p class="font-bold text-slate-700 dark:text-white text-sm">Vista Funcionarios</p>
        </div>
        <p class="text-xs text-slate-500 mb-3">Actividad y rendimiento del equipo</p>
        <div class="space-y-2">
          @for (v of VISTAS_FUNCIONARIOS; track v.label) {
            <button (click)="aplicarVista(v)"
              class="w-full text-left text-xs bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800
                     text-emerald-700 dark:text-emerald-300 px-3 py-2 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">{{ v.icono }}</span>
              <span>{{ v.label }}</span>
            </button>
          }
        </div>
      </div>

      <!-- Clientes -->
      <div class="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
        <div class="flex items-center gap-2 mb-3">
          <span class="material-symbols-outlined text-orange-600 dark:text-orange-400">person</span>
          <p class="font-bold text-slate-700 dark:text-white text-sm">Vista Clientes</p>
        </div>
        <p class="text-xs text-slate-500 mb-3">Estado de solicitudes y trámites</p>
        <div class="space-y-2">
          @for (v of VISTAS_CLIENTES; track v.label) {
            <button (click)="aplicarVista(v)"
              class="w-full text-left text-xs bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800
                     text-orange-700 dark:text-orange-300 px-3 py-2 rounded-lg hover:bg-orange-100 transition-colors flex items-center gap-2">
              <span class="material-symbols-outlined text-sm">{{ v.icono }}</span>
              <span>{{ v.label }}</span>
            </button>
          }
        </div>
      </div>

    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- SECCIÓN 5 — ARQUITECTURA (para defensa)                       -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  <div class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
    <h3 class="text-base font-bold text-slate-700 dark:text-white mb-4">
      Arquitectura — Agente & Reportes Dinámicos
    </h3>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs text-slate-600 dark:text-slate-400">
      <div class="space-y-1.5">
        <p class="font-semibold text-blue-600 dark:text-blue-400 text-sm">Agente Clasificador</p>
        <p><span class="font-semibold">Entrada:</span> texto libre del cliente</p>
        <p><span class="font-semibold">Modo IA:</span> OpenAI/Groq → JSON estructurado</p>
        <p><span class="font-semibold">Modo local:</span> tokenización + score Jaccard vs políticas</p>
        <p><span class="font-semibold">Fuente:</span> colección Politica de MongoDB</p>
        <p><span class="font-semibold">Endpoint:</span> POST /ai/agente/clasificar</p>
      </div>
      <div class="space-y-1.5">
        <p class="font-semibold text-emerald-600 dark:text-emerald-400 text-sm">Reportes Dinámicos</p>
        <p><span class="font-semibold">Modos:</span> filtros estructurados + lenguaje natural</p>
        <p><span class="font-semibold">Parser local:</span> keywords → colección, estado, período</p>
        <p><span class="font-semibold">Parser IA:</span> OpenAI → filtros MongoDB directos</p>
        <p><span class="font-semibold">ML:</span> LSTM (siguiente acción) + Dense (riesgo demora)</p>
        <p><span class="font-semibold">Formatos:</span> openpyxl · reportlab · python-docx</p>
        <p><span class="font-semibold">Endpoint:</span> POST /ai/reportes/generar</p>
        <p><span class="font-semibold">Response:</span> base64 + preview 20 filas + estadísticas gráficos</p>
      </div>
    </div>
  </div>

</div>
  `,
})
export class AgenteReportesComponent {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // ── Agente ────────────────────────────────────────────────────
  consultaAgente = '';
  clasificando = signal(false);
  resultadoAgente = signal<ClasificarResponse | null>(null);
  linkCopiado = signal(false);

  // ── Voz ───────────────────────────────────────────────────────
  grabandoAgente    = signal(false);
  grabandoReporte   = signal(false);
  transcribiendoAgente  = signal(false);
  transcribiendoReporte = signal(false);
  private _mediaRecorder: MediaRecorder | null = null;
  private _audioChunks: Blob[] = [];
  private _campoVoz: 'agente' | 'reporte' = 'agente';

  // ── Reportes — modo + estado ──────────────────────────────────
  modoConsulta = signal<'estructurado' | 'natural'>('estructurado');
  consultaReporte = '';
  formatoSeleccionado = 'excel';
  generandoReporte = signal(false);
  resultadoReporte = signal<ReporteResponse | null>(null);

  // Filtros estructurados
  coleccionSel  = signal<string>('Tramite');
  estadoSel     = signal<string>('');
  accionSel     = signal<string>('');
  periodoSel    = signal<string>('mes');
  openDropdown  = signal<string>('');
  fechaDesdeVal = '';
  fechaHastaVal = '';
  limiteVal     = '200';

  // ── Constantes UI ─────────────────────────────────────────────
  readonly COLECCIONES = [
    { valor: 'Tramite',  label: 'Trámites',  icono: 'description' },
    { valor: 'Bitacora', label: 'Bitácora',  icono: 'history' },
    { valor: 'Politica', label: 'Políticas', icono: 'policy' },
  ];

  readonly ESTADOS_TRAMITE = [
    { valor: '',           label: 'Todos' },
    { valor: 'en_proceso', label: 'En Proceso' },
    { valor: 'en_progreso',label: 'En Progreso' },
    { valor: 'en_revision',label: 'En Revisión' },
    { valor: 'finalizado', label: 'Finalizado' },
    { valor: 'rechazado',  label: 'Rechazado' },
    { valor: 'observado',  label: 'Observado' },
    { valor: 'escalado',   label: 'Escalado' },
    { valor: 'pendiente',  label: 'Pendiente' },
  ];

  readonly ACCIONES_BITACORA = [
    { valor: '',                   label: 'Todas' },
    { valor: 'INICIO_PROCESO',     label: 'Inicio' },
    { valor: 'LLENADO_FORMULARIO', label: 'Formulario' },
    { valor: 'SUBIDA_EVIDENCIA',   label: 'Evidencia' },
    { valor: 'APROBAR',            label: 'Aprobar' },
    { valor: 'OBSERVAR',           label: 'Observar' },
    { valor: 'RECHAZAR',           label: 'Rechazar' },
    { valor: 'ESCALAR',            label: 'Escalar' },
    { valor: 'FINALIZAR',          label: 'Finalizar' },
  ];

  readonly PERIODOS = [
    { valor: 'hoy',          label: 'Hoy' },
    { valor: 'semana',       label: 'Esta semana' },
    { valor: 'mes',          label: 'Este mes' },
    { valor: '3meses',       label: '3 meses' },
    { valor: 'año',          label: 'Este año' },
    { valor: 'personalizado',label: 'Personalizado' },
    { valor: '',             label: 'Todos' },
  ];

  readonly COLORES_ESTADO: Record<string, string> = {
    'en_proceso': '#3b82f6', 'en_progreso': '#6366f1', 'en_revision': '#f59e0b',
    'finalizado': '#22c55e', 'rechazado': '#ef4444',   'observado': '#8b5cf6',
    'escalado': '#f97316',   'pendiente': '#94a3b8',   'vencido': '#dc2626',
  };

  readonly COLORES_ACCION: Record<string, string> = {
    'INICIO_PROCESO': '#3b82f6', 'LLENADO_FORMULARIO': '#06b6d4',
    'SUBIDA_EVIDENCIA': '#10b981','APROBAR': '#22c55e',
    'OBSERVAR': '#f59e0b',        'RECHAZAR': '#ef4444',
    'ESCALAR': '#f97316',         'FINALIZAR': '#8b5cf6',
  };

  readonly formatos = [
    { valor: 'excel', label: 'Excel', icono: 'table_chart' },
    { valor: 'pdf',   label: 'PDF',   icono: 'picture_as_pdf' },
    { valor: 'word',  label: 'Word',  icono: 'description' },
  ];

  readonly sugerenciasReporte = [
    // Trámites — estados
    'Trámites pendientes (activos)',
    'Trámites finalizados del último mes',
    'Trámites en revisión',
    'Trámites en progreso de este mes',
    'Trámites rechazados',
    // Con período
    'Trámites pendientes de esta semana',
    'Trámites finalizados de este año',
    // Bitácora
    'Historial de aprobaciones de los últimos 30 días',
    'Observaciones de los últimos 7 días',
    'Todas las acciones de hoy',
    // Políticas
    'Las políticas activas',
  ];

  readonly sugerenciasAgente = [
    'El cliente quiere comprar un auto y necesita financiamiento vehicular, tiene empleo estable y buen historial crediticio',
    'El cliente solicita un préstamo personal para gastos médicos, tiene ingresos mensuales de 5000 bolivianos',
    'El cliente necesita instalar un medidor de luz en su vivienda nueva de El Alto',
    'El cliente quiere adquirir una casa y necesita un crédito inmobiliario, ofrece garantía hipotecaria',
    'El cliente pide un préstamo bancario para capital de trabajo de su negocio pequeño',
  ];

  // ── Vistas predefinidas por audiencia ─────────────────────────
  readonly VISTAS_EMPRESA: VistaPredefinida[] = [
    { label: 'Resumen general (todos)',   icono: 'summarize', coleccion: 'Tramite',  periodo: 'año',   descripcion: 'Todos los trámites del año' },
    { label: 'Trámites finalizados',      icono: 'task_alt',  coleccion: 'Tramite',  estado: 'finalizado', periodo: 'año', descripcion: 'Trámites cerrados' },
    { label: 'Bitácora completa (mes)',   icono: 'history',   coleccion: 'Bitacora', periodo: 'mes',   descripcion: 'Toda la actividad del mes' },
    { label: 'Políticas activas',         icono: 'policy',    coleccion: 'Politica', periodo: '',      descripcion: 'Políticas de negocio' },
  ];

  readonly VISTAS_FUNCIONARIOS: VistaPredefinida[] = [
    { label: 'Actividad bitácora (mes)',  icono: 'manage_history', coleccion: 'Bitacora', periodo: 'mes',   descripcion: 'Acciones del equipo en el mes' },
    { label: 'Aprobaciones del mes',      icono: 'thumb_up',       coleccion: 'Bitacora', accion: 'APROBAR',  periodo: 'mes', descripcion: 'Trámites aprobados' },
    { label: 'Rechazos del mes',          icono: 'thumb_down',     coleccion: 'Bitacora', accion: 'RECHAZAR', periodo: 'mes', descripcion: 'Trámites rechazados' },
    { label: 'Escalamientos (3 meses)',   icono: 'arrow_upward',   coleccion: 'Bitacora', accion: 'ESCALAR',  periodo: '3meses', descripcion: 'Trámites escalados' },
  ];

  readonly VISTAS_CLIENTES: VistaPredefinida[] = [
    { label: 'Trámites en proceso',       icono: 'pending',   coleccion: 'Tramite', estado: 'en_proceso', periodo: 'año',  descripcion: 'Solicitudes activas' },
    { label: 'Solicitudes finalizadas',   icono: 'done_all',  coleccion: 'Tramite', estado: 'finalizado', periodo: 'año',  descripcion: 'Completados históricamente' },
    { label: 'Trámites en revisión',      icono: 'rate_review', coleccion: 'Tramite', estado: 'en_revision', periodo: 'año', descripcion: 'En revisión' },
    { label: 'Trámites rechazados',       icono: 'cancel',    coleccion: 'Tramite', estado: 'rechazado',  periodo: 'año',  descripcion: 'Solicitudes rechazadas' },
  ];

  // ── Computed: gráficos ────────────────────────────────────────

  donutItems = computed<DonutItem[]>(() => {
    const r = this.resultadoReporte();
    if (!r) return [];
    const dist: Record<string, number> =
      r.estadisticas.por_accion || r.estadisticas.por_estado || {};
    const colores: Record<string, string> =
      r.estadisticas.colores_accion || r.estadisticas.colores_estado || {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    let deg = 0;
    return Object.entries(dist).map(([label, value]) => {
      const pct = (value / total) * 100;
      const item: DonutItem = { label, value, pct, color: colores[label] || '#94a3b8', startDeg: deg };
      deg += pct * 3.6;
      return item;
    }).sort((a, b) => b.value - a.value);
  });

  donutGradient = computed<string>(() => {
    const items = this.donutItems();
    if (!items.length) return 'conic-gradient(#e2e8f0 0deg 360deg)';
    let gradient = 'conic-gradient(';
    let deg = 0;
    items.forEach((item, i) => {
      const endDeg = deg + item.pct * 3.6;
      gradient += `${item.color} ${deg.toFixed(1)}deg ${endDeg.toFixed(1)}deg`;
      deg = endDeg;
      if (i < items.length - 1) gradient += ', ';
    });
    return gradient + ')';
  });

  barItems = computed<BarItem[]>(() => {
    const r = this.resultadoReporte();
    if (!r?.estadisticas?.timeline) return [];
    const tl = r.estadisticas.timeline;
    const max = Math.max(...Object.values(tl), 1);
    return Object.entries(tl).map(([label, value]) => ({
      label, value,
      pct: Math.max((value / max) * 100, 2),
      color: '#3b82f6',
    }));
  });

  barMax = computed<number>(() => {
    const items = this.barItems();
    return items.length ? Math.max(...items.map(i => i.value)) : 0;
  });

  barLabelStep = computed<number>(() => {
    const n = this.barItems().length;
    if (n <= 7)  return 1;
    if (n <= 14) return 2;
    if (n <= 20) return 4;
    return 5;
  });

  // ── SVG Area Chart ────────────────────────────────────────────
  svgChart = computed(() => {
    const items = this.barItems();
    if (!items.length) return null;

    const W = 560, H = 160;
    const padL = 34, padR = 10, padT = 12, padB = 28;
    const cW = W - padL - padR;
    const cH = H - padT - padB;
    const max = Math.max(...items.map(i => i.value), 1);
    const n = items.length;

    const pts = items.map((item, i) => ({
      x: padL + (n === 1 ? cW / 2 : (i / (n - 1)) * cW),
      y: padT + cH - (item.value / max) * cH,
      value: item.value,
      label: item.label,
    }));

    // Smooth cubic bezier path
    const linePath = pts.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = pts[i - 1];
      const cpX = ((prev.x + p.x) / 2).toFixed(1);
      return acc + ` C ${cpX} ${prev.y.toFixed(1)} ${cpX} ${p.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }, '');

    const baseY = (padT + cH).toFixed(1);
    const areaPath = n === 1
      ? ''
      : `${linePath} L ${pts[n-1].x.toFixed(1)} ${baseY} L ${pts[0].x.toFixed(1)} ${baseY} Z`;

    // 4 horizontal grid lines
    const gridLines = [0.25, 0.5, 0.75, 1].map(pct => ({
      y: padT + cH - pct * cH,
      label: Math.ceil(max * pct),
    }));

    const step = n <= 7 ? 1 : n <= 14 ? 2 : n <= 21 ? 3 : 5;

    return { pts, linePath, areaPath, gridLines, W, H, padL, padT, padB, cH, step, n, max };
  });

  // ── Lógica del agente ─────────────────────────────────────────

  clasificar(): void {
    const empresa = this.auth.getUsuario()?.empresa ?? 'empresa-001';
    this.clasificando.set(true);
    this.resultadoAgente.set(null);
    this.linkCopiado.set(false);
    this.http.post<ClasificarResponse>('/ai/agente/clasificar', {
      descripcion: this.consultaAgente, empresa_id: empresa,
    }).subscribe({
      next: r => { this.resultadoAgente.set(r); this.clasificando.set(false); },
      error: () => this.clasificando.set(false),
    });
  }

  copiarLinkCliente(politicaId: string): void {
    const url = `${window.location.origin}/client/dashboard?politica=${politicaId}`;
    navigator.clipboard.writeText(url).then(() => {
      this.linkCopiado.set(true);
      setTimeout(() => this.linkCopiado.set(false), 3000);
    });
  }

  grabar(campo: 'agente' | 'reporte'): void {
    const grabando = campo === 'agente' ? this.grabandoAgente : this.grabandoReporte;
    if (grabando()) {
      this._mediaRecorder?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no soporta grabación de audio.');
      return;
    }
    this._campoVoz = campo;
    this._audioChunks = [];
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      this._mediaRecorder = new MediaRecorder(stream, { mimeType });
      this._mediaRecorder.ondataavailable = e => { if (e.data.size > 0) this._audioChunks.push(e.data); };
      this._mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(this._audioChunks, { type: mimeType });
        this._procesarAudio(blob, this._campoVoz);
      };
      this._mediaRecorder.start();
      grabando.set(true);
    }).catch(() => alert('No se pudo acceder al micrófono. Verifica los permisos.'));
  }

  private _procesarAudio(blob: Blob, campo: 'agente' | 'reporte'): void {
    (campo === 'agente' ? this.grabandoAgente : this.grabandoReporte).set(false);
    (campo === 'agente' ? this.transcribiendoAgente : this.transcribiendoReporte).set(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      const formato = blob.type.includes('webm') ? 'webm' : 'ogg';
      this.http.post<{ texto: string }>('/ai/voz/transcribir', {
        audioBase64: base64,
        formato,
      }).subscribe({
        next: r => {
          if (r.texto?.trim()) {
            if (campo === 'agente') this.consultaAgente = r.texto;
            else this.consultaReporte = r.texto;
          }
          (campo === 'agente' ? this.transcribiendoAgente : this.transcribiendoReporte).set(false);
        },
        error: () => {
          (campo === 'agente' ? this.transcribiendoAgente : this.transcribiendoReporte).set(false);
        },
      });
    };
    reader.readAsDataURL(blob);
  }

  confianzaColor(): string {
    const c = this.resultadoAgente()?.confianza ?? 0;
    if (c >= 0.7) return 'text-emerald-600 dark:text-emerald-400';
    if (c >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-500';
  }

  getEstadoColor(): string {
    if (this.coleccionSel() === 'Tramite') {
      return this.COLORES_ESTADO[this.estadoSel()] || '#94a3b8';
    }
    return this.COLORES_ACCION[this.accionSel()] || '#94a3b8';
  }

  estadoLabel(): string {
    return this.ESTADOS_TRAMITE.find(e => e.valor === this.estadoSel())?.label ?? 'Todos';
  }

  accionLabel(): string {
    return this.ACCIONES_BITACORA.find(a => a.valor === this.accionSel())?.label ?? 'Todas';
  }

  periodoLabel(): string {
    return this.PERIODOS.find(p => p.valor === this.periodoSel())?.label ?? 'Este mes';
  }

  // ── Lógica de reportes ────────────────────────────────────────

  puedeGenerar(): boolean {
    if (this.modoConsulta() === 'natural') return !!this.consultaReporte.trim();
    return true; // modo estructurado siempre puede generar
  }

  generarReporte(): void {
    const empresa = this.auth.getUsuario()?.empresa ?? 'empresa-001';
    this.generandoReporte.set(true);
    this.resultadoReporte.set(null);

    const body = this.construirBody(empresa);
    this.http.post<ReporteResponse>('/ai/reportes/generar', body).subscribe({
      next: r => { this.resultadoReporte.set(r); this.generandoReporte.set(false); },
      error: () => this.generandoReporte.set(false),
    });
  }

  private construirBody(empresa: string): Record<string, any> {
    const base: Record<string, any> = {
      empresa_id: empresa,
      formato: this.formatoSeleccionado,
      limite: parseInt(this.limiteVal, 10),
    };

    if (this.modoConsulta() === 'natural') {
      base['consulta'] = this.consultaReporte;
      return base;
    }

    // Modo estructurado
    base['coleccion'] = this.coleccionSel();
    const periodoTexto = this.periodoTexto();
    const colLabel = this.coleccionSel() === 'Tramite' ? 'Trámites' :
                     this.coleccionSel() === 'Bitacora' ? 'Bitácora' : 'Políticas';
    base['consulta'] = `${colLabel}${periodoTexto}`;

    if (this.coleccionSel() === 'Tramite' && this.estadoSel()) {
      base['estado'] = this.estadoSel();
    }
    if (this.coleccionSel() === 'Bitacora' && this.accionSel()) {
      base['accion'] = this.accionSel();
      base['consulta'] = `Bitácora acciones ${this.accionSel()}${periodoTexto}`;
    }

    // Convertir periodo predefinido a fechas explícitas para que el backend
    // no dependa del parser de texto — garantiza que solo se devuelve el rango pedido
    const { desde, hasta } = this.periodoAFechas(this.periodoSel());
    if (this.periodoSel() === 'personalizado') {
      if (this.fechaDesdeVal) base['fecha_desde'] = this.fechaDesdeVal;
      if (this.fechaHastaVal) base['fecha_hasta'] = this.fechaHastaVal;
    } else if (desde) {
      base['fecha_desde'] = desde;
      base['fecha_hasta'] = hasta;
    }

    return base;
  }

  private periodoAFechas(periodo: string): { desde: string; hasta: string } {
    const ahora = new Date();
    const hasta = ahora.toISOString().split('T')[0];
    const desde = new Date(ahora);
    const map: Record<string, number> = {
      'hoy': 0, 'semana': 7, 'mes': 30, '3meses': 90, 'año': 365,
    };
    const dias = map[periodo];
    if (dias === undefined) return { desde: '', hasta: '' };
    if (dias === 0) {
      return { desde: hasta, hasta };  // hoy
    }
    desde.setDate(desde.getDate() - dias);
    return { desde: desde.toISOString().split('T')[0], hasta };
  }

  private periodoTexto(): string {
    const p = this.periodoSel();
    const map: Record<string, string> = {
      'hoy': ' de hoy', 'semana': ' de esta semana',
      'mes': ' del último mes', '3meses': ' de los últimos 3 meses',
      'año': ' de este año', 'personalizado': ' (rango personalizado)', '': '',
    };
    return map[p] ?? '';
  }

  aplicarVista(v: VistaPredefinida): void {
    this.modoConsulta.set('estructurado');
    this.coleccionSel.set(v.coleccion);
    this.estadoSel.set(v.estado ?? '');
    this.accionSel.set(v.accion ?? '');
    this.periodoSel.set(v.periodo);
    this.resultadoReporte.set(null);
    // Auto-generar
    setTimeout(() => this.generarReporte(), 50);
  }

  descargarReporte(): void {
    const r = this.resultadoReporte();
    if (!r) return;
    const bytes = atob(r.archivo_b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: r.mime_type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = r.nombre_archivo; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers para la tabla preview ─────────────────────────────

  formatCellValue(col: string, val: any): string {
    if (val === null || val === undefined || val === '') return '—';
    if (col === 'confianza_prediccion' || col === 'riesgo_probabilidad') {
      return (parseFloat(val) * 100).toFixed(0) + '%';
    }
    return String(val).substring(0, 60);
  }

  colLabel(col: string): string {
    return col.split('_').join(' ');
  }

  getCellClass(col: string, val: any): string {
    const v = String(val ?? '');
    if (col === 'riesgo_ia') {
      const m: Record<string, string> = {
        'CRÍTICO': 'text-red-600 font-bold', 'ALTO': 'text-orange-500 font-bold',
        'MEDIO': 'text-yellow-600 font-semibold', 'BAJO': 'text-emerald-600 font-semibold',
      };
      return m[v] ?? '';
    }
    if (col === 'estado') {
      const m: Record<string, string> = {
        'finalizado': 'text-emerald-600 font-semibold', 'rechazado': 'text-red-500 font-semibold',
        'en_proceso': 'text-blue-500', 'en_revision': 'text-yellow-600',
        'observado': 'text-violet-500', 'escalado': 'text-orange-500',
      };
      return m[v] ?? '';
    }
    if (col === 'accion') {
      const m: Record<string, string> = {
        'APROBAR': 'text-emerald-600 font-semibold', 'RECHAZAR': 'text-red-500 font-semibold',
        'ESCALAR': 'text-orange-500', 'OBSERVAR': 'text-yellow-600',
        'FINALIZAR': 'text-violet-500',
      };
      return m[v] ?? 'text-slate-600 dark:text-slate-400';
    }
    return '';
  }
}
