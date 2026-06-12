import { Component, inject, signal, OnInit, AfterViewInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { catchError, of } from 'rxjs';
import { UsuarioService } from '../../core/services/usuario.service';
import { UnidadService } from '../../core/services/unidad.service';
import { IaAssistantService } from '../../core/services/ia-assistant.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { PoliticaService } from '../../core/services/politica.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="flex flex-col gap-4 sm:gap-8 p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">

    <!-- ─── HEADER ─────────────────────────────────────────────────── -->
    <div class="flex flex-wrap justify-between items-end gap-4">
      <div>
        <h2 class="text-2xl sm:text-4xl font-bold leading-none tracking-tight text-slate-800 dark:text-white mb-1">
          Panel de Control
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Visión en tiempo real de procesos, trámites y departamentos.
        </p>
      </div>
      <div class="flex gap-3">
        <button (click)="sincronizar()" [disabled]="cargandoDashboard()"
          class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium text-sm py-2 px-4 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60">
          <span class="material-symbols-outlined text-sm" [class.animate-spin]="cargandoDashboard()">refresh</span>
          Sincronizar
        </button>
        <button (click)="exportarInforme()"
          class="bg-blue-600 text-white font-medium text-sm py-2 px-4 rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">download</span>
          Exportar Informe
        </button>
      </div>
    </div>

    <!-- ─── KPI CARDS ──────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">

      <!-- Total Trámites -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-5 relative overflow-hidden group">
        <div class="absolute -top-4 -right-4 w-24 h-24 bg-blue-100 dark:bg-blue-900/20 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
        <p class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Total Trámites</p>
        @if (cargandoDashboard()) {
          <div class="h-9 w-20 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse mb-3"></div>
        } @else {
          <h3 class="text-3xl font-bold text-slate-800 dark:text-white mb-3 tabular-nums">
            {{ metricas()?.totalTramites ?? 0 }}
          </h3>
        }
        <div class="flex items-center gap-1.5">
          <div class="flex gap-1">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" title="Pendientes"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" title="En progreso"></span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" title="Finalizados"></span>
          </div>
          <span class="text-xs text-slate-400">Este período</span>
        </div>
      </div>

      <!-- Usuarios -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-5 relative overflow-hidden group cursor-pointer hover:border-emerald-400 transition-colors"
           (click)="goToGestionPersonal()">
        <div class="absolute -top-4 -right-4 w-24 h-24 bg-emerald-100 dark:bg-emerald-900/20 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
        <p class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Usuarios</p>
        @if (isLoading()) {
          <div class="h-9 w-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse mb-3"></div>
        } @else {
          <h3 class="text-3xl font-bold text-slate-800 dark:text-white mb-3 tabular-nums">
            {{ metricas()?.usuariosActivos ?? totalUsuarios() }}
          </h3>
        }
        <div class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <span class="material-symbols-outlined text-sm">arrow_forward</span>
          <span class="text-xs font-medium">Ver gestión</span>
        </div>
      </div>

      <!-- Unidades -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-5 relative overflow-hidden group cursor-pointer hover:border-violet-400 transition-colors border-l-4 border-l-violet-500"
           (click)="scrollToDepts()">
        <div class="absolute -top-4 -right-4 w-24 h-24 bg-violet-100 dark:bg-violet-900/20 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
        <p class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Departamentos</p>
        @if (isLoading()) {
          <div class="h-9 w-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse mb-3"></div>
        } @else {
          <h3 class="text-3xl font-bold text-slate-800 dark:text-white mb-3 tabular-nums">
            {{ unidadesActivas() }}
          </h3>
        }
        <div class="flex items-center gap-1 text-violet-600 dark:text-violet-400">
          <span class="w-2 h-2 rounded-full bg-violet-500 animate-pulse inline-block"></span>
          <span class="text-xs font-medium">Operativos</span>
        </div>
      </div>

      <!-- Políticas -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-5 relative overflow-hidden group">
        <div class="absolute -top-4 -right-4 w-24 h-24 bg-orange-100 dark:bg-orange-900/20 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"></div>
        <p class="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-1">Políticas Activas</p>
        @if (cargandoDashboard()) {
          <div class="h-9 w-16 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse mb-3"></div>
        } @else {
          <h3 class="text-3xl font-bold text-slate-800 dark:text-white mb-3 tabular-nums">
            {{ metricas()?.politicasActivas ?? politicas().length }}
          </h3>
        }
        <div class="flex items-center gap-1 text-orange-500">
          <span class="material-symbols-outlined text-sm">account_tree</span>
          <span class="text-xs font-medium">Flujos de trabajo</span>
        </div>
      </div>
    </div>

    <!-- ─── ANALYTICS GRID ─────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- Gráfica: Trámites por Estado (ocupa 2 cols) -->
      <div class="xl:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white">Estado de Trámites</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Distribución actual por estado del proceso</p>
          </div>
          @if (!cargandoDashboard() && metricas()) {
            <span class="text-xs font-semibold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full">
              {{ metricas()?.totalTramites ?? 0 }} en total
            </span>
          }
        </div>

        @if (cargandoDashboard()) {
          <div class="h-48 flex items-center justify-center">
            <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        } @else if (!metricas()) {
          <div class="h-48 flex items-center justify-center text-slate-400 flex-col gap-2">
            <span class="material-symbols-outlined text-4xl">bar_chart</span>
            <p class="text-sm">Sin datos disponibles</p>
          </div>
        } @else {
          <!-- Barras verticales -->
          <div class="flex items-end justify-around h-36 sm:h-52 px-4 gap-6 border-b border-slate-100 dark:border-slate-700 mb-4">

            <div class="flex flex-col items-center gap-2 flex-1">
              <span class="text-sm font-bold text-amber-600 tabular-nums">{{ metricas()?.pendientes ?? 0 }}</span>
              <div class="w-full rounded-t-xl bg-gradient-to-t from-amber-500 to-amber-300 transition-all duration-700 ease-out shadow-sm"
                   [style.height.%]="pctEstado(metricas()?.pendientes ?? 0)">
              </div>
            </div>

            <div class="flex flex-col items-center gap-2 flex-1">
              <span class="text-sm font-bold text-blue-600 tabular-nums">{{ metricas()?.enProgreso ?? 0 }}</span>
              <div class="w-full rounded-t-xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700 ease-out shadow-sm"
                   [style.height.%]="pctEstado(metricas()?.enProgreso ?? 0)">
              </div>
            </div>

            <div class="flex flex-col items-center gap-2 flex-1">
              <span class="text-sm font-bold text-slate-600 tabular-nums">{{ contarEstado('observado') }}</span>
              <div class="w-full rounded-t-xl bg-gradient-to-t from-slate-400 to-slate-300 transition-all duration-700 ease-out shadow-sm"
                   [style.height.%]="pctEstado(contarEstado('observado'))">
              </div>
            </div>

            <div class="flex flex-col items-center gap-2 flex-1">
              <span class="text-sm font-bold text-red-500 tabular-nums">{{ contarEstado('rechazado') }}</span>
              <div class="w-full rounded-t-xl bg-gradient-to-t from-red-500 to-red-300 transition-all duration-700 ease-out shadow-sm"
                   [style.height.%]="pctEstado(contarEstado('rechazado'))">
              </div>
            </div>

            <div class="flex flex-col items-center gap-2 flex-1">
              <span class="text-sm font-bold text-emerald-600 tabular-nums">{{ metricas()?.finalizados ?? 0 }}</span>
              <div class="w-full rounded-t-xl bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all duration-700 ease-out shadow-sm"
                   [style.height.%]="pctEstado(metricas()?.finalizados ?? 0)">
              </div>
            </div>
          </div>

          <div class="flex justify-around px-4">
            <div class="flex items-center gap-1.5 flex-1 justify-center">
              <span class="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
              <span class="text-[11px] text-slate-500 font-medium">Pendientes</span>
            </div>
            <div class="flex items-center gap-1.5 flex-1 justify-center">
              <span class="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span>
              <span class="text-[11px] text-slate-500 font-medium">En Progreso</span>
            </div>
            <div class="flex items-center gap-1.5 flex-1 justify-center">
              <span class="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block"></span>
              <span class="text-[11px] text-slate-500 font-medium">Observados</span>
            </div>
            <div class="flex items-center gap-1.5 flex-1 justify-center">
              <span class="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block"></span>
              <span class="text-[11px] text-slate-500 font-medium">Rechazados</span>
            </div>
            <div class="flex items-center gap-1.5 flex-1 justify-center">
              <span class="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
              <span class="text-[11px] text-slate-500 font-medium">Finalizados</span>
            </div>
          </div>
        }
      </div>

      <!-- Gráfica: Semáforo + Prioridad -->
      <div class="flex flex-col gap-6">

        <!-- Donut Semáforo -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6">
          <h3 class="text-base font-bold text-slate-800 dark:text-white mb-4">Semáforo</h3>
          @if (cargandoDashboard()) {
            <div class="flex justify-center py-6">
              <div class="w-32 h-32 rounded-full bg-slate-100 dark:bg-slate-700 animate-pulse"></div>
            </div>
          } @else {
            <div class="flex items-center gap-6">
              <!-- Donut chart -->
              <div class="relative w-28 h-28 shrink-0">
                <div class="w-28 h-28 rounded-full" [style.background]="donutGradient()"></div>
                <div class="absolute inset-3 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                  <span class="text-lg font-bold text-slate-700 dark:text-white tabular-nums">
                    {{ metricas()?.totalTramites ?? 0 }}
                  </span>
                </div>
              </div>
              <!-- Leyenda -->
              <div class="flex flex-col gap-2.5 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 inline-block shrink-0"></span>
                    <span class="text-xs text-slate-600 dark:text-slate-300">Verde</span>
                  </div>
                  <span class="text-xs font-bold text-slate-700 dark:text-white tabular-nums">
                    {{ metricas()?.porSemaforo?.Verde ?? 0 }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-amber-400 inline-block shrink-0"></span>
                    <span class="text-xs text-slate-600 dark:text-slate-300">Amarillo</span>
                  </div>
                  <span class="text-xs font-bold text-slate-700 dark:text-white tabular-nums">
                    {{ metricas()?.porSemaforo?.Amarillo ?? 0 }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full bg-red-500 inline-block shrink-0"></span>
                    <span class="text-xs text-slate-600 dark:text-slate-300">Rojo</span>
                  </div>
                  <span class="text-xs font-bold text-slate-700 dark:text-white tabular-nums">
                    {{ metricas()?.porSemaforo?.Rojo ?? 0 }}
                  </span>
                </div>
              </div>
            </div>
          }
        </div>

        <!-- Barras Prioridad -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6 flex-1">
          <h3 class="text-base font-bold text-slate-800 dark:text-white mb-4">Por Prioridad</h3>
          @if (cargandoDashboard()) {
            <div class="space-y-3">
              @for (i of [1,2,3]; track i) {
                <div class="h-8 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse"></div>
              }
            </div>
          } @else {
            <div class="flex flex-col gap-3">

              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-medium">
                  <span class="text-red-600 dark:text-red-400">Alta</span>
                  <span class="text-slate-600 dark:text-slate-300 tabular-nums">{{ metricas()?.porPrioridad?.Alta ?? 0 }}</span>
                </div>
                <div class="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
                       [style.width.%]="pctPrioridad(metricas()?.porPrioridad?.Alta ?? 0)">
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-medium">
                  <span class="text-amber-600 dark:text-amber-400">Media</span>
                  <span class="text-slate-600 dark:text-slate-300 tabular-nums">{{ metricas()?.porPrioridad?.Media ?? 0 }}</span>
                </div>
                <div class="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-700"
                       [style.width.%]="pctPrioridad(metricas()?.porPrioridad?.Media ?? 0)">
                  </div>
                </div>
              </div>

              <div class="flex flex-col gap-1">
                <div class="flex justify-between text-xs font-medium">
                  <span class="text-emerald-600 dark:text-emerald-400">Baja</span>
                  <span class="text-slate-600 dark:text-slate-300 tabular-nums">{{ metricas()?.porPrioridad?.Baja ?? 0 }}</span>
                </div>
                <div class="w-full h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div class="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700"
                       [style.width.%]="pctPrioridad(metricas()?.porPrioridad?.Baja ?? 0)">
                  </div>
                </div>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- ─── POLÍTICAS ACTIVAS TABLE ────────────────────────────────── -->
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h3 class="text-lg font-bold text-slate-800 dark:text-white">Políticas de Negocio</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Flujos de trabajo configurados en la plataforma</p>
        </div>
        <button (click)="irAPoliticas()"
          class="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">add</span>
          Nueva política
        </button>
      </div>

      @if (cargandoDashboard()) {
        <div class="p-6 space-y-3">
          @for (i of [1,2,3]; track i) {
            <div class="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse"></div>
          }
        </div>
      } @else if (politicas().length === 0) {
        <div class="p-12 text-center text-slate-400">
          <span class="material-symbols-outlined text-5xl block mb-2">policy</span>
          <p class="text-sm">No hay políticas registradas aún</p>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="w-full min-w-[600px] text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-700/50">
                <th class="px-6 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-500">Nombre</th>
                <th class="px-6 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-500">Tipo</th>
                <th class="px-6 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-500">SLA</th>
                <th class="px-6 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-500">Estado</th>
                <th class="px-6 py-3 text-left text-[11px] uppercase tracking-wider font-bold text-slate-500">Activación</th>
                <th class="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
              @for (p of politicas(); track p.id) {
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[16px]">account_tree</span>
                      </div>
                      <span class="font-semibold text-slate-800 dark:text-white">{{ p.nombre }}</span>
                    </div>
                  </td>
                  <td class="px-6 py-4 text-slate-500 dark:text-slate-400">{{ p.tipo_flujo || '—' }}</td>
                  <td class="px-6 py-4">
                    @if (p.duracion_estandar_dias) {
                      <span class="text-slate-600 dark:text-slate-300 font-medium">{{ p.duracion_estandar_dias }}d</span>
                    } @else {
                      <span class="text-slate-400">—</span>
                    }
                  </td>
                  <td class="px-6 py-4">
                    @if (p.esta_activa) {
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Activa
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block"></span> Inactiva
                      </span>
                    }
                  </td>
                  <td class="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                    {{ p.fecha_activacion ? (p.fecha_activacion | date:'dd/MM/yyyy') : '—' }}
                  </td>
                  <td class="px-6 py-4">
                    @if (p.id) {
                      <button (click)="irAEditor(p.id)"
                        class="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1">
                        <span class="material-symbols-outlined text-[14px]">edit</span>
                        Editar flujo
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- ─── DEPARTAMENTOS ──────────────────────────────────────────── -->
    <div id="departamentos">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-xl font-bold text-slate-800 dark:text-white">Departamentos</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Unidades organizacionales de la empresa</p>
        </div>
        <button (click)="goToGestionPersonal()"
          class="text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px]">settings</span>
          Gestionar
        </button>
      </div>

      @if (isLoading()) {
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (i of [1,2,3,4,5,6]; track i) {
            <div class="h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
          }
        </div>
      } @else if (unidades().length === 0) {
        <div class="text-center py-12 text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <span class="material-symbols-outlined text-5xl block mb-2">corporate_fare</span>
          <p class="text-sm">No hay departamentos registrados</p>
        </div>
      } @else {
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          @for (u of unidades(); track u.id) {
            <div (click)="abrirDept(u)"
              class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-5 cursor-pointer hover:border-violet-400 hover:shadow-md transition-all group"
              [class.border-l-4]="u.esta_activa"
              [class.border-l-violet-500]="u.esta_activa">
              <div class="flex items-start justify-between mb-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                  [class.bg-violet-500]="u.esta_activa"
                  [class.bg-slate-400]="!u.esta_activa">
                  {{ (u.sigla || u.nombre || '?').slice(0, 2).toUpperCase() }}
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  [class.bg-emerald-100]="u.esta_activa"
                  [class.text-emerald-700]="u.esta_activa"
                  [class.bg-slate-100]="!u.esta_activa"
                  [class.text-slate-500]="!u.esta_activa">
                  {{ u.esta_activa ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
              <p class="text-sm font-bold text-slate-800 dark:text-white leading-snug group-hover:text-violet-600 transition-colors">
                {{ u.nombre }}
              </p>
              @if (u.sigla) {
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{{ u.sigla }}</p>
              }
              <div class="mt-3 flex items-center gap-1 text-[11px] text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <span class="material-symbols-outlined text-[14px]">info</span>
                Ver detalle
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- ─── MODAL DEPARTAMENTO ─────────────────────────────────────── -->
    @if (departamentoSeleccionado()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
           (click)="cerrarDept()">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
        <div class="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
             (click)="$event.stopPropagation()">

          <!-- Header modal -->
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center text-base font-bold text-white"
                [class.bg-violet-500]="departamentoSeleccionado().esta_activa"
                [class.bg-slate-400]="!departamentoSeleccionado().esta_activa">
                {{ (departamentoSeleccionado().sigla || departamentoSeleccionado().nombre || '?').slice(0, 2).toUpperCase() }}
              </div>
              <div>
                <h3 class="text-lg font-bold text-slate-800 dark:text-white">{{ departamentoSeleccionado().nombre }}</h3>
                @if (departamentoSeleccionado().sigla) {
                  <p class="text-sm text-slate-500 dark:text-slate-400">{{ departamentoSeleccionado().sigla }}</p>
                }
              </div>
            </div>
            <button (click)="cerrarDept()"
              class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span class="material-symbols-outlined text-slate-500 text-[20px]">close</span>
            </button>
          </div>

          <!-- Body modal -->
          <div class="p-6 flex flex-col gap-4">

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">Estado</p>
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full inline-block"
                    [class.bg-emerald-500]="departamentoSeleccionado().esta_activa"
                    [class.bg-slate-400]="!departamentoSeleccionado().esta_activa"></span>
                  <span class="text-sm font-bold text-slate-700 dark:text-white">
                    {{ departamentoSeleccionado().esta_activa ? 'Operativo' : 'Inactivo' }}
                  </span>
                </div>
              </div>

              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">Sigla</p>
                <p class="text-sm font-bold text-slate-700 dark:text-white">
                  {{ departamentoSeleccionado().sigla || '—' }}
                </p>
              </div>
            </div>

            @if (departamentoSeleccionado().padre_id) {
              <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">Unidad Padre</p>
                <p class="text-sm text-slate-700 dark:text-white">{{ deptPadreNombre() }}</p>
              </div>
            }

            <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                Trámites activos en este departamento
              </p>
              <div class="flex items-center gap-3">
                <div class="flex-1 h-2.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                  <div class="h-full bg-violet-500 rounded-full" [style.width.%]="pctDeptTramites()"></div>
                </div>
                <span class="text-sm font-bold text-slate-700 dark:text-white tabular-nums">
                  {{ tramitesDept() }}
                </span>
              </div>
              <p class="text-[11px] text-slate-400 mt-1.5">de {{ metricas()?.enProgreso ?? 0 }} en progreso en total</p>
            </div>

            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p class="text-[11px] uppercase tracking-wider text-blue-500 font-bold mb-1">Cuellos de botella</p>
              @if (cuellosBotellaDept().length > 0) {
                @for (cb of cuellosBotellaDept(); track $index) {
                  <div class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span class="material-symbols-outlined text-[16px]"
                      [class.text-red-500]="cb.severidad === 'CRITICO'"
                      [class.text-orange-500]="cb.severidad === 'ALTO'"
                      [class.text-amber-500]="cb.severidad === 'MEDIO'">warning</span>
                    {{ cb.nodoNombre || cb.nodoId }} — <strong>{{ cb.tiempoPromedioHoras | number:'1.1-1' }}h</strong>
                  </div>
                }
              } @else {
                <p class="text-sm text-blue-600 dark:text-blue-300 font-medium flex items-center gap-1">
                  <span class="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                  Sin cuellos detectados
                </p>
              }
            </div>
          </div>

          <!-- Footer modal -->
          <div class="px-6 pb-6 flex justify-end gap-3">
            <button (click)="cerrarDept()"
              class="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
              Cerrar
            </button>
            <button (click)="goToGestionPersonal()"
              class="px-4 py-2 text-sm font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">manage_accounts</span>
              Gestionar Dept.
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ─── CU-19: ANÁLISIS IA ─────────────────────────────────────── -->
    <div id="ia-analytics" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl p-6">

      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
            <span class="material-symbols-outlined text-violet-600 dark:text-violet-400 text-[22px]">psychology</span>
          </div>
          <div>
            <h3 class="text-lg font-bold text-slate-800 dark:text-white">
              Análisis IA — Cuellos de Botella
              @if (alertas().length > 0) {
                <span class="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {{ alertas().length > 9 ? '9+' : alertas().length }}
                </span>
              }
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Detección automática de nodos lentos y empleados saturados</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="escalar()" [disabled]="escalando()"
            class="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            @if (escalando()) {
              <div class="w-3 h-3 border border-red-500 border-t-transparent rounded-full animate-spin"></div>
            } @else {
              <span class="material-symbols-outlined text-[16px]">warning</span>
            }
            Escalar Vencidos
          </button>
          <button (click)="recargarIA()" [disabled]="cargandoIA()"
            class="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            <span class="material-symbols-outlined text-[16px]" [class.animate-spin]="cargandoIA()">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      @if (mensajeAccion()) {
        <div class="mb-4 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2"
          [class.bg-emerald-50]="!mensajeAccion()!.startsWith('Error')"
          [class.text-emerald-700]="!mensajeAccion()!.startsWith('Error')"
          [class.bg-red-50]="mensajeAccion()!.startsWith('Error')"
          [class.text-red-700]="mensajeAccion()!.startsWith('Error')">
          <span class="material-symbols-outlined text-[18px]">
            {{ mensajeAccion()!.startsWith('Error') ? 'error' : 'check_circle' }}
          </span>
          {{ mensajeAccion() }}
        </div>
      }

      @if (cargandoIA()) {
        <div class="flex items-center justify-center py-10 gap-3">
          <div class="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-sm text-slate-500">Analizando procesos con IA...</span>
        </div>
      } @else if (cuellosBotella().length === 0 && sugerenciasIA().length === 0 && alertas().length === 0) {
        <div class="text-center py-10">
          <span class="material-symbols-outlined text-5xl text-emerald-400 block mb-2">check_circle</span>
          <p class="text-sm font-semibold text-emerald-700 dark:text-emerald-400">¡Sin cuellos de botella detectados!</p>
          <p class="text-xs text-slate-400 mt-1">Todos los procesos funcionan dentro de los tiempos esperados.</p>
        </div>
      } @else {
        <div class="flex flex-col gap-6">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

            @if (cuellosBotella().length > 0) {
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Nodos con Demora <span class="text-slate-400 font-normal normal-case">({{ cuellosBotella().length }})</span>
                </h4>
                <div class="space-y-3">
                  @for (cb of cuellosBotella(); track $index) {
                    <div class="border rounded-xl p-4"
                      [class.border-red-200]="cb.severidad === 'CRITICO'"
                      [class.bg-red-50]="cb.severidad === 'CRITICO'"
                      [class.border-orange-200]="cb.severidad === 'ALTO'"
                      [class.bg-orange-50]="cb.severidad === 'ALTO'"
                      [class.border-amber-200]="cb.severidad === 'MEDIO'"
                      [class.bg-amber-50]="cb.severidad === 'MEDIO'"
                      [class.dark:bg-slate-700]="true"
                      [class.dark:border-slate-600]="true">
                      <div class="flex items-start gap-3">
                        <div class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          [class.bg-red-500]="cb.severidad === 'CRITICO'"
                          [class.bg-orange-500]="cb.severidad === 'ALTO'"
                          [class.bg-amber-400]="cb.severidad === 'MEDIO'">
                          {{ cb.severidad === 'CRITICO' ? '!' : cb.severidad === 'ALTO' ? '↑' : '~' }}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-sm font-semibold text-slate-800 dark:text-white truncate">{{ cb.nodoNombre || cb.nodoId || 'Nodo' }}</p>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              [class.bg-red-100]="cb.severidad === 'CRITICO'"
                              [class.text-red-700]="cb.severidad === 'CRITICO'"
                              [class.bg-orange-100]="cb.severidad === 'ALTO'"
                              [class.text-orange-700]="cb.severidad === 'ALTO'"
                              [class.bg-amber-100]="cb.severidad === 'MEDIO'"
                              [class.text-amber-700]="cb.severidad === 'MEDIO'">
                              {{ cb.severidad }}
                            </span>
                          </div>
                          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Tiempo promedio: <strong>{{ cb.tiempoPromedioHoras | number:'1.1-1' }}h</strong>
                            @if (cb.cantidad) { · {{ cb.cantidad }} trámites }
                          </p>
                        </div>
                      </div>
                      @if (cb.severidad === 'CRITICO' || cb.severidad === 'ALTO') {
                        <div class="mt-3 pt-3 border-t flex justify-end"
                          [class.border-red-200]="cb.severidad === 'CRITICO'"
                          [class.border-orange-200]="cb.severidad === 'ALTO'">
                          <button (click)="reasignar(cb)" [disabled]="reasignando()"
                            class="flex items-center gap-1 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                            [class.bg-red-100]="cb.severidad === 'CRITICO'"
                            [class.text-red-700]="cb.severidad === 'CRITICO'"
                            [class.hover:bg-red-200]="cb.severidad === 'CRITICO'"
                            [class.bg-orange-100]="cb.severidad === 'ALTO'"
                            [class.text-orange-700]="cb.severidad === 'ALTO'"
                            [class.hover:bg-orange-200]="cb.severidad === 'ALTO'">
                            @if (reasignando()) {
                              <div class="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                            } @else {
                              <span class="material-symbols-outlined text-[14px]">swap_horiz</span>
                            }
                            Reasignar Tareas
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            @if (sugerenciasIA().length > 0) {
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Sugerencias de Mejora IA</h4>
                <div class="space-y-3">
                  @for (sug of sugerenciasIA(); track $index) {
                    <div class="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 flex items-start gap-3">
                      <span class="material-symbols-outlined text-violet-500 text-[20px] shrink-0 mt-0.5">auto_fix_high</span>
                      <div>
                        <p class="text-sm font-semibold text-violet-800 dark:text-violet-300">{{ sug.titulo || sug.tipo || 'Recomendación' }}</p>
                        <p class="text-xs text-violet-600 dark:text-violet-400 mt-1 leading-relaxed">{{ sug.descripcion || sug.recomendacion || sug.mensaje || (sug | json) }}</p>
                        @if (sug.accionAutomatica) {
                          <span class="inline-block mt-2 text-[10px] font-bold bg-violet-200 text-violet-800 px-2 py-0.5 rounded-full">Acción automática disponible</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          @if (alertas().length > 0) {
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"></span>
                Alertas Activas <span class="text-slate-400 font-normal normal-case">({{ alertas().length }})</span>
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                @for (alerta of alertas(); track $index) {
                  <div class="border rounded-xl p-3 flex items-start gap-3"
                    [class.border-red-200]="alerta.tipo === 'CUELLO_BOTELLA'"
                    [class.bg-red-50]="alerta.tipo === 'CUELLO_BOTELLA'"
                    [class.border-amber-200]="alerta.tipo === 'VENCIMIENTO_PROXIMO'"
                    [class.bg-amber-50]="alerta.tipo === 'VENCIMIENTO_PROXIMO'"
                    [class.border-orange-200]="alerta.tipo === 'FUNCIONARIO_SATURADO'"
                    [class.bg-orange-50]="alerta.tipo === 'FUNCIONARIO_SATURADO'">
                    <span class="material-symbols-outlined text-[18px] shrink-0 mt-0.5"
                      [class.text-red-500]="alerta.tipo === 'CUELLO_BOTELLA'"
                      [class.text-amber-500]="alerta.tipo === 'VENCIMIENTO_PROXIMO'"
                      [class.text-orange-500]="alerta.tipo === 'FUNCIONARIO_SATURADO'">
                      {{ alerta.tipo === 'VENCIMIENTO_PROXIMO' ? 'schedule' : alerta.tipo === 'FUNCIONARIO_SATURADO' ? 'person_alert' : 'warning' }}
                    </span>
                    <div class="min-w-0">
                      <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {{ alerta.tipo === 'CUELLO_BOTELLA' ? 'Cuello de Botella' :
                           alerta.tipo === 'FUNCIONARIO_SATURADO' ? 'Funcionario Saturado' :
                           alerta.tipo === 'VENCIMIENTO_PROXIMO' ? 'Vencimiento Próximo' :
                           alerta.tipo || 'Alerta' }}
                      </p>
                      <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">{{ alerta.mensaje || alerta.descripcion || alerta.nodoId || alerta.tramiteId || '' }}</p>
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>

  </div>
  `
})
export class AdminComponent implements OnInit, AfterViewInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private usuarioService = inject(UsuarioService);
  private unidadService = inject(UnidadService);
  private iaSvc = inject(IaAssistantService);
  private authSvc = inject(AuthService);
  private dashboardSvc = inject(DashboardService);
  private politicaSvc = inject(PoliticaService);

  // ── Señales de estado ────────────────────────────────────────
  metricas = signal<any>(null);
  politicas = signal<any[]>([]);
  unidades = signal<any[]>([]);
  totalUsuarios = signal<number>(0);
  isLoading = signal<boolean>(true);
  cargandoDashboard = signal<boolean>(true);
  departamentoSeleccionado = signal<any>(null);

  // CU-19
  cargandoIA = signal<boolean>(false);
  cuellosBotella = signal<any[]>([]);
  sugerenciasIA = signal<any[]>([]);
  alertas = signal<any[]>([]);
  reasignando = signal<boolean>(false);
  escalando = signal<boolean>(false);
  mensajeAccion = signal<string | null>(null);

  // ── Computed ─────────────────────────────────────────────────
  unidadesActivas = computed(() => this.unidades().filter(u => u.esta_activa).length);

  donutGradient = computed(() => {
    const m = this.metricas();
    const total = Math.max(m?.totalTramites || 0, 1);
    if (!m || !m.porSemaforo) return 'conic-gradient(#e2e8f0 0% 100%)';
    const v = ((m.porSemaforo.Verde || 0) / total) * 100;
    const a = v + ((m.porSemaforo.Amarillo || 0) / total) * 100;
    return `conic-gradient(#22c55e 0% ${v.toFixed(1)}%, #f59e0b ${v.toFixed(1)}% ${a.toFixed(1)}%, #ef4444 ${a.toFixed(1)}% 100%)`;
  });

  maxEstado = computed(() => {
    const m = this.metricas();
    if (!m) return 1;
    return Math.max(m.pendientes || 0, m.enProgreso || 0, m.finalizados || 0, 1);
  });

  maxPrioridad = computed(() => {
    const m = this.metricas();
    if (!m?.porPrioridad) return 1;
    return Math.max(m.porPrioridad.Alta || 0, m.porPrioridad.Media || 0, m.porPrioridad.Baja || 0, 1);
  });

  cuellosBotellaDept = computed(() => {
    const dept = this.departamentoSeleccionado();
    if (!dept) return [];
    const nombre = (dept.nombre || '').toLowerCase();
    const sigla = (dept.sigla || '').toLowerCase();
    return this.cuellosBotella().filter(cb => {
      const nodo = (cb.nodoNombre || cb.nodoId || '').toLowerCase();
      return nodo.includes(nombre) || nodo.includes(sigla) || nombre.includes(nodo);
    });
  });

  tramitesDept = computed(() => {
    const m = this.metricas();
    if (!m) return 0;
    const total = Math.max(this.unidadesActivas(), 1);
    return Math.round((m.enProgreso || 0) / total);
  });

  pctDeptTramites = computed(() => {
    const t = this.tramitesDept();
    const m = this.metricas();
    const total = Math.max(m?.enProgreso || 1, 1);
    return Math.min(Math.round((t / total) * 100), 100);
  });

  deptPadreNombre = computed(() => {
    const dept = this.departamentoSeleccionado();
    if (!dept?.padre_id) return '';
    const padre = this.unidades().find(u => u.id === dept.padre_id);
    return padre?.nombre ?? dept.padre_id;
  });

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit() {
    const usuario = this.authSvc.getUsuario();
    const empresaId = (usuario as any)?.empresa_id ?? (usuario as any)?.empresa ?? '';

    this.usuarioService.obtenerTodosLosUsuarios().subscribe({
      next: (res) => this.totalUsuarios.set(res.length),
      error: () => {}
    });

    this.unidadService.obtenerTodasLasUnidades().subscribe({
      next: (res) => {
        this.unidades.set(res ?? []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    if (empresaId) {
      forkJoin({
        metricas: this.dashboardSvc.getMetricas(empresaId),
        politicas: this.politicaSvc.obtenerPoliticasPorEmpresa(empresaId).pipe(catchError(() => of([])))
      }).subscribe({
        next: ({ metricas, politicas }) => {
          this.metricas.set(metricas);
          this.politicas.set((politicas as any[]) ?? []);
          this.cargandoDashboard.set(false);
        },
        error: () => this.cargandoDashboard.set(false)
      });
    } else {
      this.politicaSvc.obtenerTodasLasPoliticas().subscribe({
        next: (p) => this.politicas.set(p ?? []),
        error: () => {}
      });
      this.cargandoDashboard.set(false);
    }

    this.recargarIA();
  }

  // ── Helpers de chart ─────────────────────────────────────────
  pctEstado(val: number): number {
    const max = this.maxEstado();
    return Math.round((val / max) * 100);
  }

  pctPrioridad(val: number): number {
    const max = this.maxPrioridad();
    return Math.round((val / max) * 100);
  }

  contarEstado(estado: string): number {
    const m = this.metricas();
    if (!m) return 0;
    const estados = m.porEstado ?? {};
    return estados[estado] ?? 0;
  }

  // ── Acciones UI ───────────────────────────────────────────────
  sincronizar(): void {
    const usuario = this.authSvc.getUsuario();
    const empresaId = (usuario as any)?.empresa_id ?? (usuario as any)?.empresa ?? '';
    if (!empresaId) return;
    this.cargandoDashboard.set(true);
    forkJoin({
      metricas: this.dashboardSvc.getMetricas(empresaId),
      politicas: this.politicaSvc.obtenerPoliticasPorEmpresa(empresaId).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ metricas, politicas }) => {
        this.metricas.set(metricas);
        this.politicas.set((politicas as any[]) ?? []);
        this.cargandoDashboard.set(false);
      },
      error: () => this.cargandoDashboard.set(false)
    });
    this.recargarIA();
  }

  exportarInforme(): void {
    const m = this.metricas();
    if (!m) { alert('No hay datos para exportar.'); return; }
    const lineas = [
      'INFORME DE DASHBOARD — NexusFlow AI',
      '=====================================',
      `Fecha: ${new Date().toLocaleString('es-BO')}`,
      '',
      'MÉTRICAS GENERALES',
      `Total Trámites:   ${m.totalTramites ?? 0}`,
      `Pendientes:       ${m.pendientes ?? 0}`,
      `En Progreso:      ${m.enProgreso ?? 0}`,
      `Finalizados:      ${m.finalizados ?? 0}`,
      `Usuarios Activos: ${m.usuariosActivos ?? this.totalUsuarios()}`,
      `Políticas Activas:${m.politicasActivas ?? this.politicas().length}`,
      '',
      'SEMÁFORO',
      `Verde:    ${m.porSemaforo?.Verde ?? 0}`,
      `Amarillo: ${m.porSemaforo?.Amarillo ?? 0}`,
      `Rojo:     ${m.porSemaforo?.Rojo ?? 0}`,
      '',
      'PRIORIDAD',
      `Alta:  ${m.porPrioridad?.Alta ?? 0}`,
      `Media: ${m.porPrioridad?.Media ?? 0}`,
      `Baja:  ${m.porPrioridad?.Baja ?? 0}`,
    ];
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexusflow-informe-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  abrirDept(unidad: any): void { this.departamentoSeleccionado.set(unidad); }
  cerrarDept(): void { this.departamentoSeleccionado.set(null); }
  scrollToDepts(): void { document.getElementById('departamentos')?.scrollIntoView({ behavior: 'smooth' }); }
  irAEditor(politicaId: string): void { this.router.navigate(['/designer/flow-editor', politicaId]); }
  irAPoliticas(): void { this.router.navigate(['/admin/politicas']); }
  goToGestionPersonal(): void {
    this.departamentoSeleccionado.set(null);
    this.router.navigate(['/admin/gestion-personal']);
  }

  ngAfterViewInit(): void {
    this.route.fragment.subscribe(frag => {
      if (frag === 'ia-analytics') {
        setTimeout(() => {
          document.getElementById('ia-analytics')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 400);
      }
    });
  }

  // ── CU-19: Análisis IA ────────────────────────────────────────
  recargarIA(): void {
    const usuario = this.authSvc.getUsuario();
    const empresaId = (usuario as any)?.empresa_id ?? (usuario as any)?.empresa ?? '';
    if (!empresaId) return;

    this.cargandoIA.set(true);
    this.mensajeAccion.set(null);

    forkJoin({
      cuellos: this.iaSvc.getCuellosBotella(empresaId),
      sugerencias: this.iaSvc.getSugerencias(empresaId),
      alertas: this.iaSvc.getAlertas(empresaId)
    }).subscribe({
      next: ({ cuellos, sugerencias, alertas }) => {
        this.cuellosBotella.set(cuellos ?? []);
        this.sugerenciasIA.set(sugerencias ?? []);
        this.alertas.set(alertas ?? []);
        this.cargandoIA.set(false);
      },
      error: () => {
        this.cuellosBotella.set([]);
        this.sugerenciasIA.set([]);
        this.alertas.set([]);
        this.cargandoIA.set(false);
      }
    });
  }

  reasignar(cuello: any): void {
    const nodoId = cuello.nodoId ?? cuello.nodo_id ?? '';
    const funcionarioId = cuello.funcionarioId ?? cuello.funcionario_asignado_id ?? '';
    if (!nodoId) return;
    this.reasignando.set(true);
    this.mensajeAccion.set(null);
    this.iaSvc.reasignarTareas(nodoId, 3, funcionarioId).subscribe({
      next: (res) => {
        this.reasignando.set(false);
        this.mensajeAccion.set(res?.error ? 'Error al reasignar tareas.' : 'Reasignación ejecutada correctamente.');
        this.mostrarMensajeTemporalmente();
        this.recargarIA();
      },
      error: () => {
        this.reasignando.set(false);
        this.mensajeAccion.set('Error al reasignar tareas.');
        this.mostrarMensajeTemporalmente();
      }
    });
  }

  escalar(): void {
    const usuario = this.authSvc.getUsuario();
    const adminId = (usuario as any)?.id ?? '';
    this.escalando.set(true);
    this.mensajeAccion.set(null);
    this.iaSvc.escalarVencidos(adminId).subscribe({
      next: (res) => {
        this.escalando.set(false);
        this.mensajeAccion.set(res?.error ? 'Error al escalar trámites.' : 'Escalamiento ejecutado. Trámites vencidos actualizados.');
        this.mostrarMensajeTemporalmente();
        this.recargarIA();
      },
      error: () => {
        this.escalando.set(false);
        this.mensajeAccion.set('Error al escalar trámites.');
        this.mostrarMensajeTemporalmente();
      }
    });
  }

  private mostrarMensajeTemporalmente(): void {
    setTimeout(() => this.mensajeAccion.set(null), 4000);
  }
}
