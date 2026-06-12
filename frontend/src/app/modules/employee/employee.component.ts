import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TramiteBandejaResponseDTO, TramiteService } from '../../core/services/tramite.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { Unidad, UnidadService } from '../../core/services/unidad.service';
import { TramiteTiempoSimuladorService } from '../../core/services/tramite-tiempo-simulador.service';
import { TramiteResumenDTO } from '../../core/models/tramite.models';
import { RealtimeService } from '../../core/services/realtime.service';
import { LayoutService } from '../../core/services/layout.service';
import { EstadoTramiteMessage } from '../../core/models/realtime.models';
import { NotificacionDTO, NotificacionService } from '../../core/services/notificacion.service';
import { EditorColaborativoComponent } from '../client/editor-colaborativo.component';

@Component({
  selector: 'app-employee',
  standalone: true,
  imports: [CommonModule, FormsModule, EditorColaborativoComponent],
  template: `
    @if (toast().visible) {
      <div class="fixed top-20 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm"
        [class.bg-emerald-50]="toast().type === 'success'"
        [class.border-emerald-200]="toast().type === 'success'"
        [class.text-emerald-800]="toast().type === 'success'"
        [class.bg-amber-50]="toast().type === 'warning'"
        [class.border-amber-200]="toast().type === 'warning'"
        [class.text-amber-800]="toast().type === 'warning'"
        [class.bg-red-50]="toast().type === 'error'"
        [class.border-red-200]="toast().type === 'error'"
        [class.text-red-800]="toast().type === 'error'"
        [class.bg-blue-50]="toast().type === 'info'"
        [class.border-blue-200]="toast().type === 'info'"
        [class.text-blue-800]="toast().type === 'info'">
        <div class="flex items-start gap-3">
          <span class="material-symbols-outlined text-[18px] mt-0.5">
            {{ toastIcono() }}
          </span>
          <div class="flex-1">
            <p class="text-xs font-bold uppercase tracking-[0.08em]">Notificación</p>
            <p class="text-sm font-semibold mt-0.5">{{ toast().message }}</p>
          </div>
          <button type="button" class="text-xs font-bold opacity-70 hover:opacity-100" (click)="cerrarToast()">X</button>
        </div>
      </div>
    }

    <div class="flex flex-col sm:flex-row sm:flex-wrap sm:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
      <div>
        <h2 class="text-2xl sm:text-[2.75rem] leading-none font-headline font-semibold text-slate-800 tracking-[-0.02em]">Mi Bandeja</h2>
        <p class="text-slate-500 mt-2 font-body text-base">
          {{ vistaBandeja() === 'unidad' ? 'Trámites de tu unidad con semaforización en tiempo real.' : 'Solo los trámites asignados a ti.' }}
        </p>
        @if (unidadId()) {
          <p class="mt-2 text-sm font-semibold tracking-[0.04em] text-slate-500">Departamento / Unidad asignada: {{ unidadNombre() || 'Cargando nombre...' }}</p>
        }
      </div>
      <div class="flex gap-3 sm:gap-4 w-full sm:w-auto">
        <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 sm:p-4 flex-1 sm:min-w-[140px] flex flex-col justify-center">
          <span class="font-label text-xs uppercase tracking-[0.05em] text-slate-500 mb-1">Total</span>
          <div class="flex items-baseline gap-2">
            <span class="text-xl sm:text-2xl font-bold text-blue-600">{{ filtrada().length }}</span>
            <span class="text-xs text-slate-500 font-medium">Trámites</span>
          </div>
        </div>
        <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 sm:p-4 flex-1 sm:min-w-[140px] flex flex-col justify-center">
          <span class="font-label text-xs uppercase tracking-[0.05em] text-slate-500 mb-1">Rojos</span>
          <div class="flex items-baseline gap-2">
            <span class="text-xl sm:text-2xl font-bold text-red-500">{{ resumenSemaforo().rojo }}</span>
            <span class="text-xs text-red-500 animate-pulse">● Riesgo</span>
          </div>
        </div>
        <div class="bg-white border border-slate-200 shadow-sm rounded-xl p-3 sm:p-4 flex-1 sm:min-w-[140px] flex flex-col justify-center">
          <span class="font-label text-xs uppercase tracking-[0.05em] text-slate-500 mb-1">En cola</span>
          <div class="flex items-baseline gap-2">
            <span class="text-xl sm:text-2xl font-bold text-amber-500">{{ resumenSemaforo().amarillo }}</span>
            <span class="text-xs text-amber-500">● Atención</span>
          </div>
        </div>
      </div>
    </div>

    <div class="mb-6">
      <div class="rounded-2xl border border-slate-200 bg-white shadow-sm p-3">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Simulador de tiempo</p>
            <p class="text-sm text-slate-500 mt-1">Acelera el tiempo visual para probar cuándo un trámite pasa a amarillo o rojo.</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm text-slate-600 mr-2">Offset: <strong>+{{ horasSimuladas() }} h</strong></span>
            <button (click)="simuladorAbierto.set(!simuladorAbierto())" class="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
              {{ simuladorAbierto() ? 'Ocultar' : 'Abrir simulador' }}
            </button>
          </div>
        </div>

        @if (simuladorAbierto()) {
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" (click)="simularHoras(24)" class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">+24 h</button>
            <button type="button" (click)="simularHoras(48)" class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">+48 h</button>
            <button type="button" (click)="simularHoras(72)" class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors">+72 h</button>
            <button type="button" (click)="simularHoras(100)" class="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors">+100 h</button>
            <button type="button" (click)="resetSimulacion()" [disabled]="horasSimuladas() === 0" class="px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-50">Reset</button>
          </div>
        }
      </div>
    </div>

    @if (error()) {
      <div class="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ error() }}
      </div>
    }

    @if (cargando()) {
      <div class="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
        Cargando bandeja...
      </div>
    }

    @if (!unidadId() && !cargando()) {
      <div class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm">
        No se pudo resolver la unidad del funcionario. Verifica el perfil autenticado.
      </div>
    }

    <div class="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        (click)="cambiarVistaBandeja('unidad')"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        [class.bg-slate-900]="vistaBandeja() === 'unidad'"
        [class.text-white]="vistaBandeja() === 'unidad'"
        [class.text-slate-600]="vistaBandeja() !== 'unidad'">
        Vista unidad
      </button>
      <button
        type="button"
        (click)="cambiarVistaBandeja('asignados')"
        class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        [class.bg-slate-900]="vistaBandeja() === 'asignados'"
        [class.text-white]="vistaBandeja() === 'asignados'"
        [class.text-slate-600]="vistaBandeja() !== 'asignados'">
        Mis trámites
      </button>
    </div>

    <div class="mb-6 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <span class="material-symbols-outlined text-[16px]">notifications_active</span>
      Notificaciones automáticas: solo para trámites asignados a ti.
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-220px)] min-h-[600px]">
      <!-- Panel izquierdo: Cola de trabajo -->
      <div class="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
        <div class="p-4 border-b border-slate-100 flex flex-col items-start gap-3">
          <h3 class="font-headline text-sm font-semibold text-slate-800">Cola de Trabajo</h3>
          <div class="flex items-center gap-2 overflow-x-auto w-full pb-1">
            <input placeholder="Buscar cliente..." [ngModel]="busquedaCliente()" (ngModelChange)="busquedaCliente.set($event)" class="px-3 py-2 border rounded-lg text-sm outline-none shrink-0" />
            <input type="date" [ngModel]="fechaDesde()" (ngModelChange)="fechaDesde.set($event)" class="px-2 py-1 border rounded-lg text-xs shrink-0" />
            <input type="date" [ngModel]="fechaHasta()" (ngModelChange)="fechaHasta.set($event)" class="px-2 py-1 border rounded-lg text-xs shrink-0" />
            <button (click)="limpiarFiltros()" class="px-3 py-1 rounded-lg text-xs bg-slate-100 shrink-0">Limpiar</button>
            <button title="Ordenar por tiempo restante" (click)="ordenTiempo.set(ordenTiempo() === 'asc' ? 'desc' : ordenTiempo() === 'desc' ? null : 'asc')"
              class="px-3 py-1 rounded-lg text-xs border bg-white">
              @if (ordenTiempo() === 'asc') { <span class="material-symbols-outlined">arrow_upward</span> <span class="text-xs font-semibold">Tiempo ↑</span> }
              @else if (ordenTiempo() === 'desc') { <span class="material-symbols-outlined">arrow_downward</span> <span class="text-xs font-semibold">Tiempo ↓</span> }
              @else { <span class="material-symbols-outlined">swap_vert</span> <span class="text-xs font-semibold">Orden</span> }
            </button>
            <button (click)="recargar()" class="text-blue-600 hover:bg-slate-50 p-1.5 rounded-md transition-colors" [disabled]="cargando()">
              <span class="material-symbols-outlined text-[18px]">refresh</span>
            </button>
          </div>
        </div>
        <div class="px-4 pt-4 pb-2 flex flex-wrap gap-2 border-b border-slate-100">
          <button (click)="filtroSemaforo.set('todos')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-slate-900]="filtroSemaforo() === 'todos'" [class.text-white]="filtroSemaforo() === 'todos'" [class.bg-slate-100]="filtroSemaforo() !== 'todos'" [class.text-slate-600]="filtroSemaforo() !== 'todos'">Todos</button>
          <button (click)="filtroSemaforo.set('Rojo')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-red-600]="filtroSemaforo() === 'Rojo'" [class.text-white]="filtroSemaforo() === 'Rojo'" [class.bg-red-50]="filtroSemaforo() !== 'Rojo'" [class.text-red-700]="filtroSemaforo() !== 'Rojo'">Rojo</button>
          <button (click)="filtroSemaforo.set('Amarillo')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-amber-500]="filtroSemaforo() === 'Amarillo'" [class.text-white]="filtroSemaforo() === 'Amarillo'" [class.bg-amber-50]="filtroSemaforo() !== 'Amarillo'" [class.text-amber-700]="filtroSemaforo() !== 'Amarillo'">Amarillo</button>
          <button (click)="filtroSemaforo.set('Verde')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-emerald-600]="filtroSemaforo() === 'Verde'" [class.text-white]="filtroSemaforo() === 'Verde'" [class.bg-emerald-50]="filtroSemaforo() !== 'Verde'" [class.text-emerald-700]="filtroSemaforo() !== 'Verde'">Verde</button>
        </div>
        <div class="px-4 pt-3 pb-2 flex flex-wrap gap-2 border-b border-slate-100">
          <button (click)="filtroEstado.set('todos')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-slate-900]="filtroEstado() === 'todos'" [class.text-white]="filtroEstado() === 'todos'" [class.bg-slate-100]="filtroEstado() !== 'todos'" [class.text-slate-600]="filtroEstado() !== 'todos'">Todos</button>
          <button (click)="filtroEstado.set('urgente')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-red-600]="filtroEstado() === 'urgente'" [class.text-white]="filtroEstado() === 'urgente'" [class.bg-red-50]="filtroEstado() !== 'urgente'" [class.text-red-700]="filtroEstado() !== 'urgente'">Urgente</button>
          <button (click)="filtroEstado.set('prioritario')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-amber-500]="filtroEstado() === 'prioritario'" [class.text-white]="filtroEstado() === 'prioritario'" [class.bg-amber-50]="filtroEstado() !== 'prioritario'" [class.text-amber-700]="filtroEstado() !== 'prioritario'">Prioritario</button>
          <button (click)="filtroEstado.set('normal')" class="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors" [class.bg-blue-600]="filtroEstado() === 'normal'" [class.text-white]="filtroEstado() === 'normal'" [class.bg-blue-50]="filtroEstado() !== 'normal'" [class.text-blue-700]="filtroEstado() !== 'normal'">Normal</button>
        </div>
        <div class="flex-1 overflow-y-auto p-2 space-y-1">
          @for (t of filtrada(); track t.id) {
            <div
              (click)="seleccionarTramite(t)"
              [class.bg-slate-100]="seleccionado()?.id === t.id"
              class="p-3 rounded-lg hover:bg-slate-50 cursor-pointer relative group border border-transparent"
              [class.border-blue-200]="seleccionado()?.id === t.id">

              @if (seleccionado()?.id === t.id) {
                <div class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full"></div>
              }

              <div class="flex justify-between items-start mb-2 pl-2">
                <span
                  class="text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider"
                  [ngClass]="prioridadClass(t.prioridad)">
                  {{ t.prioridad }}
                </span>
                <span class="text-sm text-slate-500 font-medium">{{ venceEnVisual(t) }}</span>
              </div>
              
              @if (confirmarRechazoVisible()) {
                <div class="fixed inset-0 z-50 flex items-center justify-center"> 
                  <div class="absolute inset-0 bg-black/50" (click)="cerrarConfirmRechazo()"></div>
                  <div class="bg-white rounded-xl p-6 w-full max-w-md z-60">
                    <h3 class="text-lg font-bold mb-2">Confirmar rechazo</h3>
                    <p class="text-sm text-slate-600 mb-3">¿Estás seguro de rechazar este trámite? Esta acción notificará al cliente.</p>
                    <label class="text-xs font-semibold text-slate-600 mb-1 block">Motivo (opcional)</label>
                    <textarea rows="3" [ngModel]="motivoRechazo()" (ngModelChange)="motivoRechazo.set($event)"
                      class="w-full px-3 py-2 border rounded-lg text-sm mb-4"></textarea>
                    <div class="flex gap-3 justify-end">
                      <button type="button" (click)="cerrarConfirmRechazo()" class="px-3 py-2 rounded-lg border">Cancelar</button>
                      <button type="button" (click)="confirmarRechazo()" class="px-3 py-2 rounded-lg bg-red-600 text-white">Confirmar rechazo</button>
                    </div>
                  </div>
                </div>
              }
              <h4 class="text-sm font-semibold text-slate-800 pl-2 mb-1">{{ t.politicaNombre }}</h4>
              <div class="flex justify-between items-center pl-2">
                <p class="text-sm text-slate-600 truncate">Cliente: {{ t.clienteNombre }}</p>
                <span class="text-sm font-semibold px-3 py-1 rounded-full" [ngClass]="semaforoBadgeClass(semaforoVisual(t))">{{ semaforoVisual(t) || t.semaforizacion || 'Sin color' }}</span>
              </div>
            </div>
          } @empty {
            <div class="p-8 text-center text-slate-400 italic text-sm">
              No hay trámites para los filtros seleccionados.
            </div>
          }
        </div>
      </div>

      <!-- Panel derecho: Detalle + Firma + Acciones -->
      <div class="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200 shadow-sm rounded-xl flex flex-col overflow-hidden relative">
        @if (seleccionado()) {
          <div class="p-6 pb-4 border-b border-slate-100 relative z-10">
            <div class="flex justify-between items-start mb-4">
              <div>
                <h2 class="text-xl font-headline font-bold text-slate-800 mb-1">{{ seleccionado()?.politicaNombre }}</h2>
                <p class="text-sm text-slate-500">ID: #{{ (seleccionado()?.id || '').substring(0,8).toUpperCase() }} • Paso: {{ seleccionado()?.pasoActualNombre }}</p>
              </div>
              <div class="flex gap-2">
                <span class="px-3 py-1 text-xs font-bold rounded-full border" [ngClass]="prioridadBadgeClass(seleccionado()?.prioridad)">
                  {{ seleccionado()?.prioridad }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-4 relative z-10">
            <!-- Datos del trámite -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-[0.05em] text-slate-500 font-bold mb-1">Cliente</p>
                <p class="font-semibold text-slate-800">{{ seleccionado()?.clienteNombre }}</p>
                <p class="text-sm text-slate-500">{{ seleccionado()?.clienteEmail || 'Sin correo disponible' }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-[0.05em] text-slate-500 font-bold mb-1">Semáforo</p>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 rounded-full"
                    [class.bg-emerald-500]="semaforoVisual(seleccionado()) === 'Verde'"
                    [class.bg-amber-400]="semaforoVisual(seleccionado()) === 'Amarillo'"
                    [class.bg-red-500]="semaforoVisual(seleccionado()) === 'Rojo'">
                  </div>
                  <p class="font-semibold" [ngClass]="semaforoTextClass(semaforoVisual(seleccionado()))">{{ semaforoVisual(seleccionado()) || seleccionado()?.semaforizacion || 'Sin color' }}</p>
                </div>
                <p class="text-sm text-slate-500 mt-1">{{ venceEnVisual(seleccionado()) }}</p>
                <p class="text-xs text-slate-400 mt-1">Fecha límite: {{ formatearFecha(seleccionado()?.fechaLimite) }}</p>
                <p class="text-xs text-slate-400">Tiempo restante: {{ tiempoRestanteVisual(seleccionado()) }}</p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-[0.05em] text-slate-500 font-bold mb-1">Estado</p>
                <p class="font-semibold text-slate-800">{{ seleccionado()?.estado }}</p>
                <p class="text-sm text-slate-500">Progreso estimado: {{ seleccionado()?.progreso }}%</p>
              </div>
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p class="text-xs uppercase tracking-[0.05em] text-slate-500 font-bold mb-1">Responsable</p>
                <p class="font-semibold text-slate-800">{{ seleccionado()?.funcionarioAsignadoNombre || 'Sin asignación' }}</p>
                <p class="text-sm text-slate-500">Paso actual: {{ seleccionado()?.pasoActualNombre }}</p>
              </div>
            </div>

            <!-- Datos llenados por el cliente -->
            @if (pasosClienteConDatos().length > 0) {
              <div class="rounded-xl border border-slate-200 overflow-hidden">
                <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                  <span class="material-symbols-outlined text-slate-500 text-[16px]">description</span>
                  <p class="text-xs font-bold text-slate-600 uppercase tracking-wider">Datos llenados por el cliente</p>
                </div>
                <div class="p-4 space-y-4 bg-white">
                  @for (paso of pasosClienteConDatos(); track paso.nodoId) {
                    <div>
                      <p class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                        {{ paso.nodoNombre || ('Paso ' + (paso.index + 1)) }}
                      </p>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        @for (entrada of paso.entradas; track entrada[0]) {
                          <div class="bg-slate-50 rounded-lg border border-slate-100 p-3">
                            <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                              {{ labelCampoDetalle(paso.nodoId, entrada[0]) }}
                            </p>
                            @if (esArchivo(entrada[1])) {
                              <div class="flex items-center gap-2">
                                <span class="text-sm">{{ iconoArchivo(entrada[1]) }}</span>
                                <p class="text-xs text-blue-600 font-medium truncate">{{ entrada[1] }}</p>
                              </div>
                            } @else {
                              <p class="text-sm font-semibold text-slate-800 break-words">
                                {{ formatValorDetalle(entrada[1]) }}
                              </p>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Repositorio de documentos del trámite -->
            @if (cargandoDocsFuncionario()) {
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-2 text-sm text-slate-500">
                <div class="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                Cargando documentos...
              </div>
            }
            @if (!cargandoDocsFuncionario() && documentosFuncionario().length > 0) {
              <div class="rounded-xl border border-indigo-200 overflow-hidden">
                <div class="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                  <span class="material-symbols-outlined text-indigo-600 text-[16px]">folder_open</span>
                  <p class="text-xs font-bold text-indigo-800 uppercase tracking-wider">Documentos del Cliente</p>
                  <span class="ml-auto text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{{ documentosFuncionario().length }}</span>
                </div>
                <div class="p-3 space-y-2 bg-white">
                  @for (doc of documentosFuncionario(); track $index) {
                    <div class="flex items-center gap-3 p-2 border border-slate-100 rounded-lg hover:bg-slate-50">
                      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        [class.bg-red-100]="doc.content_type?.includes('pdf')"
                        [class.bg-blue-100]="doc.nombre?.endsWith('.docx')"
                        [class.bg-green-100]="doc.nombre?.endsWith('.xlsx')"
                        [class.bg-slate-100]="doc.content_type?.includes('image')">
                        <span class="material-symbols-outlined text-[16px]"
                          [class.text-red-600]="doc.content_type?.includes('pdf')"
                          [class.text-blue-600]="doc.nombre?.endsWith('.docx')"
                          [class.text-green-600]="doc.nombre?.endsWith('.xlsx')"
                          [class.text-slate-500]="doc.content_type?.includes('image')">
                          {{ doc.content_type?.includes('pdf') ? 'picture_as_pdf' : doc.content_type?.includes('image') ? 'image' : doc.nombre?.endsWith('.xlsx') ? 'table_chart' : 'description' }}
                        </span>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-slate-800 truncate">{{ doc.nombre }}</p>
                        <p class="text-[10px] text-slate-400">{{ formatBytesFuncionario(doc.tamanio_bytes) }}</p>
                      </div>
                      <div class="flex items-center gap-1 shrink-0">
                        @if (doc.nombre?.endsWith('.docx') || doc.nombre?.endsWith('.xlsx') || doc.nombre?.endsWith('.txt')) {
                          <button (click)="abrirEditorFuncionario(doc)"
                            class="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-colors">
                            <span class="material-symbols-outlined text-[12px]">group</span>
                            Colaborar
                          </button>
                        }
                        <a [href]="proxyUrlDoc(doc)" target="_blank"
                          class="flex items-center gap-1 px-2 py-1 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition-colors">
                          <span class="material-symbols-outlined text-[12px]">{{ doc.content_type?.includes('pdf') ? 'visibility' : 'download' }}</span>
                          {{ doc.content_type?.includes('pdf') ? 'Ver' : 'Descargar' }}
                        </a>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Formulario del paso actual del funcionario -->
            @if (cargandoFormulario()) {
              <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-2 text-sm text-slate-500">
                <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                Cargando campos del paso actual...
              </div>
            }

            @if (!cargandoFormulario() && camposFormularioFuncionario().length > 0) {
              <div class="rounded-xl border border-blue-200 overflow-hidden">
                <div class="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                  <span class="material-symbols-outlined text-blue-600 text-[16px]">edit_note</span>
                  <p class="text-xs font-bold text-blue-800 uppercase tracking-wider">Completar formulario del paso actual</p>
                </div>
                <div style="width:760px;padding:16px 0 8px;box-sizing:border-box;" class="space-y-3 bg-white overflow-x-auto">
                  @for (filaRow of filasLayoutFuncionario(); track $index) {
                    <div class="flex items-start">
                    @for (campo of filaRow; track campo.id; let j = $index) {
                    <div class="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-1.5 flex-shrink-0"
                         [style.width.px]="campo.largoCampo || 240"
                         [style.margin-left.px]="margenIzquierdoFuncionario(filaRow, j)">
                      <label class="block text-sm font-semibold text-slate-700">
                        {{ campo.titulo || campo.nombre || campo.id }}
                        @if (campo.obligatorio) { <span class="text-red-500 ml-0.5">*</span> }
                      </label>
                      @if (campo.tipo === 'si_no' || campo.tipo === 'si/no') {
                        <div class="flex gap-4">
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" [name]="'emp-' + campo.id" [value]="true"
                              [checked]="valoresCamposFuncionario()[campo.id] === true"
                              (change)="setCampoFuncionario(campo.id, true)"
                              class="accent-blue-600 w-4 h-4">
                            <span class="text-sm font-medium">Sí</span>
                          </label>
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input type="radio" [name]="'emp-' + campo.id" [value]="false"
                              [checked]="valoresCamposFuncionario()[campo.id] === false"
                              (change)="setCampoFuncionario(campo.id, false)"
                              class="accent-blue-600 w-4 h-4">
                            <span class="text-sm font-medium">No</span>
                          </label>
                        </div>
                      } @else if (campo.tipo === 'lista') {
                        <select [ngModel]="valoresCamposFuncionario()[campo.id]"
                          (ngModelChange)="setCampoFuncionario(campo.id, $event)"
                          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400">
                          <option value="">Selecciona una opción...</option>
                          @for (opc of (campo.opciones ?? []); track $index) {
                            <option [ngValue]="opc.valor ?? opc">{{ opc.label ?? opc }}</option>
                          }
                        </select>
                      } @else if (campo.tipo === 'numero') {
                        <input type="number"
                          [ngModel]="valoresCamposFuncionario()[campo.id]"
                          (ngModelChange)="setCampoFuncionario(campo.id, $event)"
                          [placeholder]="campo.placeholder || ''"
                          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                      } @else if (campo.tipo === 'fecha') {
                        <input type="date"
                          [ngModel]="valoresCamposFuncionario()[campo.id]"
                          (ngModelChange)="setCampoFuncionario(campo.id, $event)"
                          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                      } @else if (campo.tipo === 'parrafo') {
                        <textarea rows="3"
                          [ngModel]="valoresCamposFuncionario()[campo.id] ?? ''"
                          (ngModelChange)="setCampoFuncionario(campo.id, $event)"
                          [placeholder]="campo.placeholder || ''"
                          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none"></textarea>
                      } @else if (campo.tipo === 'archivo') {
                        <div class="border-2 border-dashed border-slate-300 rounded-lg px-3 py-2 hover:border-blue-400 transition-colors cursor-pointer">
                          <input
                            type="file"
                            [id]="'emp-file-' + campo.id"
                            [accept]="campo.formatos || '*'"
                            [multiple]="(campo.cantidadMaxima || 1) > 1"
                            (change)="onFileFuncionarioChange($event, campo.id)"
                            class="hidden" />
                          <label [for]="'emp-file-' + campo.id" class="cursor-pointer flex items-center gap-2">
                            <span class="text-base text-slate-400">📎</span>
                            <div class="min-w-0">
                              <span class="text-sm text-slate-600 font-medium">Adjuntar archivo</span>
                              @if (campo.formatos) { <span class="text-xs text-slate-400 block truncate">{{ campo.formatos }}</span> }
                            </div>
                          </label>
                          @if (archivosNombresFuncionario()[campo.id]) {
                            <p class="mt-1 text-xs text-emerald-600 font-medium truncate">✅ {{ archivosNombresFuncionario()[campo.id] }}</p>
                          }
                        </div>
                      } @else if (campo.tipo === 'grid') {
                        <div class="overflow-x-auto rounded-lg border border-slate-200">
                          <table class="w-full text-sm border-collapse">
                            <thead class="bg-slate-50">
                              <tr>
                                @for (col of campo.tablaColumnas; track col.id) {
                                  <th class="px-3 py-2 border border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">{{ col.titulo }}</th>
                                }
                              </tr>
                            </thead>
                            <tbody>
                              @for (fila of campo.tablaFilas; track fila.id) {
                                <tr>
                                  <td class="px-3 py-2 border border-slate-200 bg-slate-50 font-medium text-slate-700">{{ fila.etiqueta }}</td>
                                  @for (col of (campo.tablaColumnas ?? []).slice(1); track col.id) {
                                    <td class="border border-slate-200 p-1">
                                      <input
                                        [type]="col.tipo === 'numero' ? 'number' : 'text'"
                                        [ngModel]="getValorTablaFuncionario(campo.id, fila.id, col.id)"
                                        (ngModelChange)="setCampoTablaFuncionario(campo.id, fila.id, col.id, $event)"
                                        class="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                                    </td>
                                  }
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                        @if ((campo.tablaColumnas?.length ?? 0) === 0 || (campo.tablaFilas?.length ?? 0) === 0) {
                          <p class="text-xs text-slate-400 italic">Esta tabla aún no tiene columnas o filas configuradas.</p>
                        }
                      } @else {
                        <input type="text"
                          [ngModel]="valoresCamposFuncionario()[campo.id] ?? ''"
                          (ngModelChange)="setCampoFuncionario(campo.id, $event)"
                          [placeholder]="campo.placeholder || ''"
                          class="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                      }
                    </div>
                    }
                  </div>
                  }
                </div>
              </div>
            }

            <!-- Firma del funcionario (si el paso la requiere) -->

            @if (!cargandoFormulario() && camposFirmaFuncionario().length > 0) {
              <div class="rounded-xl border-2 border-blue-100 bg-blue-50 p-4">
                <div class="flex items-center gap-2 mb-3">
                  <span class="material-symbols-outlined text-blue-600 text-[20px]">draw</span>
                  <p class="text-sm font-bold text-blue-800">Tu firma es requerida para aprobar</p>
                </div>
                @for (campo of camposFirmaFuncionario(); track campo.id) {
                  <div class="mb-4">
                    <p class="text-xs font-semibold text-slate-700 mb-1">
                      {{ campo.titulo }}
                      <span class="text-[10px] text-slate-400 ml-1">({{ campo.rolFirma }})</span>
                      @if (campo.obligatorio) { <span class="text-red-500 ml-0.5">*</span> }
                    </p>
                    <div class="rounded-lg overflow-hidden border-2 transition-colors"
                      [class.border-blue-300]="!firmasEmpleado()[campo.id]"
                      [class.border-emerald-400]="firmasEmpleado()[campo.id]">
                      <canvas
                        [id]="'emp-canvas-' + campo.id"
                        width="480" height="130"
                        class="w-full touch-none cursor-crosshair block bg-white"
                        (mousedown)="empStartDraw($event, campo.id)"
                        (mousemove)="empDraw($event, campo.id)"
                        (mouseup)="empStopDraw(campo.id)"
                        (mouseleave)="empStopDraw(campo.id)"
                        (touchstart)="empStartDrawTouch($event, campo.id)"
                        (touchmove)="empDrawTouch($event, campo.id)"
                        (touchend)="empStopDrawTouch(campo.id)"
                        (touchcancel)="empStopDrawTouch(campo.id)">
                      </canvas>
                    </div>
                    <div class="flex items-center justify-between mt-1.5">
                      <button type="button" (click)="empLimpiarFirma(campo.id)"
                        class="text-xs text-red-500 hover:text-red-700 font-medium transition-colors">
                        Limpiar
                      </button>
                      @if (firmasEmpleado()[campo.id]) {
                        <span class="text-xs text-emerald-600 font-bold flex items-center gap-1">
                          <span class="material-symbols-outlined text-[14px]">check_circle</span>
                          Firmado
                        </span>
                      } @else {
                        <span class="text-xs text-slate-400">Dibuja tu firma en el recuadro</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }

            <!-- Feedback -->
            @if (exito()) {
              <div class="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 font-medium flex items-center gap-2">
                <span class="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                {{ exito() }}
              </div>
            }
            @if (errorAccion()) {
              <div class="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <span class="material-symbols-outlined text-red-500 text-[18px]">error</span>
                {{ errorAccion() }}
              </div>
            }

            <!-- Botones de acción CU-14 -->
            <div class="flex gap-3 pt-2">
              <button (click)="ejecutarAccion('APROBAR')" [disabled]="ejecutando()"
                class="flex-1 py-3 bg-slate-900 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                @if (ejecutando()) {
                  <span class="animate-spin material-symbols-outlined text-base">progress_activity</span>
                } @else {
                  <span class="material-symbols-outlined text-base">check_circle</span>
                }
                Aprobar / Avanzar
              </button>
              <button (click)="abrirConfirmRechazo()" [disabled]="ejecutando()"
                class="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-base">block</span>
                Rechazar
              </button>
              <button (click)="ejecutarAccion('OBSERVAR')" [disabled]="ejecutando()"
                class="flex-1 py-3 border-2 border-amber-400 text-amber-700 rounded-xl text-sm font-bold uppercase tracking-wider hover:bg-amber-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <span class="material-symbols-outlined text-base">visibility</span>
                Observar
              </button>
            </div>
          </div>
        } @else {
          <div class="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <div class="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mb-6">
              <span class="material-symbols-outlined text-[48px] text-slate-300">fact_check</span>
            </div>
            <h3 class="text-lg font-bold text-slate-800 mb-2">Selecciona un trámite</h3>
            <p class="max-w-xs mx-auto">Elige un registro de la bandeja para ver su semáforo, prioridad y datos principales.</p>
          </div>
        }
      </div>
    </div>

    <!-- Modal editor colaborativo funcionario — pantalla casi completa (igual al cliente) -->
    @if (mostrarEditorFuncionario() && docEnEdicionFuncionario()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
        <div class="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
             style="width: min(98vw, 1400px); height: calc(100vh - 24px);">

          <!-- Barra superior — igual al cliente -->
          <div class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
            <button (click)="cerrarEditorFuncionario()"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 font-semibold text-sm">
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
              Volver
            </button>
            <div class="flex-1 min-w-0">
              <span class="text-sm font-bold text-slate-700">Editor Colaborativo</span>
              <span class="text-xs text-slate-400 ml-2">{{ docEnEdicionFuncionario()?.nombre }}</span>
            </div>
            <button (click)="cerrarEditorFuncionario()"
              class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors text-slate-400">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="flex-1 overflow-hidden">
            <app-editor-colaborativo
              [documentoKey]="docEnEdicionFuncionario()?.key ?? ''"
              [nombreDoc]="docEnEdicionFuncionario()?.nombre ?? ''"
              [tramiteId]="seleccionado()?.id ?? tramiteIdColab()">
            </app-editor-colaborativo>
          </div>
        </div>
      </div>
    }
  `,
  styles: []
})
export class EmployeeComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private tramiteSvc = inject(TramiteService);
  private usuarioSvc = inject(UsuarioService);
  private realtime = inject(RealtimeService);
  private simulador = inject(TramiteTiempoSimuladorService);
  private notificacionSvc = inject(NotificacionService);
  private unidadSvc = inject(UnidadService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private layoutSvc = inject(LayoutService);

  unidadId = signal<string | null>(null);
  unidadNombre = signal<string | null>(null);
  funcionarioId = signal<string | null>(null);
  vistaBandeja = signal<'unidad' | 'asignados'>('unidad');
  simuladorAbierto = signal<boolean>(true);
  busquedaCliente = signal<string>('');
  fechaDesde = signal<string | null>(null);
  fechaHasta = signal<string | null>(null);
  bandeja = signal<TramiteResumenDTO[]>([]);
  ordenTiempo = signal<'asc' | 'desc' | null>(null);
  resumenBandeja = signal<TramiteBandejaResponseDTO | null>(null);
  seleccionado = signal<TramiteResumenDTO | null>(null);
  filtroSemaforo = signal<'todos' | 'Verde' | 'Amarillo' | 'Rojo'>('todos');
  filtroEstado = signal<'todos' | 'urgente' | 'prioritario' | 'normal'>('todos');
  cargando = signal(false);
  error = signal<string | null>(null);
  ejecutando = signal(false);
  exito = signal<string | null>(null);
  errorAccion = signal<string | null>(null);
  cargandoFormulario = signal(false);
  formularioActual = signal<any>(null);
  pasoActualFuncionario = signal<any>(null);
  detalleSeleccionado = signal<any>(null);
  firmasEmpleado = signal<Record<string, string>>({});
  valoresCamposFuncionario = signal<Record<string, any>>({});
  archivosNombresFuncionario = signal<Record<string, string>>({});
  confirmarRechazoVisible = signal(false);
  motivoRechazo = signal<string | null>(null);

  // ── Repositorio documentos ─────────────────────────────────
  documentosFuncionario = signal<any[]>([]);
  cargandoDocsFuncionario = signal(false);
  mostrarEditorFuncionario = signal(false);
  docEnEdicionFuncionario = signal<any | null>(null);
  // tramiteId para el editor cuando se abre directo desde la campana (sin trámite seleccionado)
  tramiteIdColab = signal<string>('');

  private http = inject(HttpClient);

  private empDrawingState = new Map<string, boolean>();
  private tramitesSuscritos = new Set<string>();
  private estadoToastPorTramite = new Map<string, string>();
  private notificacionesMostradas = new Set<string>();
  private notificacionesPollingId: number | null = null;
  private toastTimeoutId: number | null = null;
  private bandejaSub: import('rxjs').Subscription | null = null;

  toast = signal<{ visible: boolean; message: string; type: 'success' | 'warning' | 'error' | 'info' }>({
    visible: false,
    message: '',
    type: 'info'
  });

  toastIcono = computed(() => {
    const tipo = this.toast().type;
    if (tipo === 'success') return 'check_circle';
    if (tipo === 'warning') return 'warning';
    if (tipo === 'error') return 'error';
    return 'info';
  });

  horasSimuladas = computed(() => this.simulador.horasSimuladas());

  filtrada = computed(() => {
    const itemsBase = this.bandeja().filter(t => {
      if (this.vistaBandeja() === 'asignados') {
        const idFuncionario = this.funcionarioId();
        return !!idFuncionario && t.funcionarioAsignadoId === idFuncionario;
      }
      return true;
    });

    const texto = (this.busquedaCliente() || '').trim().toLowerCase();
    const desde = this.fechaDesde() ? new Date(this.fechaDesde() as string) : null;
    const hasta = this.fechaHasta() ? new Date(this.fechaHasta() as string) : null;

    let filtered = itemsBase.filter(t => {
      const coincideSemaforo = this.filtroSemaforo() === 'todos' || this.semaforoVisual(t) === this.filtroSemaforo();
      const filtroPri = this.filtroEstado();
      const prioridadItem = (t.prioridad || '').toString().trim().toLowerCase();
      const coincidePri = filtroPri === 'todos' || prioridadItem === filtroPri;

      if (!coincideSemaforo || !coincidePri) return false;

      if (texto) {
        const nombre = (t.clienteNombre || '').toLowerCase();
        if (!nombre.includes(texto)) return false;
      }

      if (desde || hasta) {
        const fInicio = this.obtenerFechaInicio(t);
        const fLimite = this.obtenerFechaLimite(t);
        const fechaItem = fInicio ?? fLimite;
        if (!fechaItem) return false;
        const fd = new Date(fechaItem);
        if (desde && fd < desde) return false;
        if (hasta) {
          // incluir todo el día
          const hastaFin = new Date(hasta.getTime());
          hastaFin.setHours(23,59,59,999);
          if (fd > hastaFin) return false;
        }
      }

      return true;
    });

    // Ordenar por tiempo restante si se solicitó
    const orden = this.ordenTiempo();
    if (orden) {
      filtered = filtered.slice().sort((a, b) => {
        const limiteA = this.obtenerFechaLimite(a);
        const limiteB = this.obtenerFechaLimite(b);
        const ahora = this.tiempoBaseMs();

        const remA = limiteA === null ? Number.POSITIVE_INFINITY : (limiteA - ahora);
        const remB = limiteB === null ? Number.POSITIVE_INFINITY : (limiteB - ahora);

        if (remA === remB) return 0;
        if (orden === 'asc') return remA - remB; // menor tiempo restante primero
        return remB - remA; // mayor tiempo restante primero
      });
    }

    return filtered;
  });

  resumenSemaforo = computed(() => {
    const items = this.bandeja();
    return {
      verde: items.filter(t => this.semaforoVisual(t) === 'Verde').length,
      amarillo: items.filter(t => this.semaforoVisual(t) === 'Amarillo').length,
      rojo: items.filter(t => this.semaforoVisual(t) === 'Rojo').length
    };
  });

  camposFirmaFuncionario = computed(() => {
    const form = this.formularioActual();
    if (!form) return [];
    const campos = (form.campos ?? form.esquema_campos ?? []) as any[];
    return campos.filter((c: any) =>
      c.tipo === 'firma' && c.rolFirma && !c.rolFirma.toUpperCase().includes('CLIENTE')
    );
  });

  camposFormularioFuncionario = computed(() => {
    const form = this.formularioActual();
    if (!form) return [];
    const campos = (form.campos ?? form.esquema_campos ?? []) as any[];
    return campos.filter((c: any) => c.tipo !== 'firma' && c.tipo !== 'label');
  });

  // Assign posX/posY to campos that lack position (2-column auto-grid), same logic as form-dinamico
  camposConLayoutFuncionario = computed(() => {
    const sorted = [...this.camposFormularioFuncionario()].sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0));
    const tienePosicion = sorted.some((c: any) => c.posX !== undefined && c.posX !== null);
    if (!tienePosicion) {
      return sorted.map((c: any, i: number) => ({
        ...c,
        posX: (i % 2) * 370 + 10,
        posY: Math.floor(i / 2) * 130 + 10,
        largoCampo: c.largoCampo ?? 350,
      }));
    }
    const maxY = sorted.reduce((m: number, c: any) => (c.posY != null ? Math.max(m, c.posY) : m), 0);
    let autoRow = 0, autoCol = 0;
    return sorted.map((c: any) => {
      if (c.posX != null && c.posY != null) return c;
      const out = { ...c, posX: autoCol * 370 + 10, posY: maxY + 150 + autoRow * 130, largoCampo: c.largoCampo ?? 350 };
      if (++autoCol >= 2) { autoCol = 0; autoRow++; }
      return out;
    });
  });

  // Group campos into visual rows by Y proximity (threshold 80px), preserve posX order within each row
  filasLayoutFuncionario = computed(() => {
    const sorted = [...this.camposConLayoutFuncionario()].sort((a: any, b: any) => {
      const dy = (a.posY ?? 0) - (b.posY ?? 0);
      return dy !== 0 ? dy : (a.posX ?? 0) - (b.posX ?? 0);
    });
    const filas: any[][] = [];
    for (const campo of sorted) {
      const y = campo.posY ?? 0;
      const idx = filas.findIndex((f: any[]) => Math.abs((f[0].posY ?? 0) - y) < 80);
      if (idx >= 0) {
        filas[idx].push(campo);
        filas[idx].sort((a: any, b: any) => (a.posX ?? 0) - (b.posX ?? 0));
      } else {
        filas.push([campo]);
      }
    }
    return filas.sort((a: any[], b: any[]) => (a[0].posY ?? 0) - (b[0].posY ?? 0));
  });

  margenIzquierdoFuncionario(fila: any[], idx: number): number {
    const campo = fila[idx];
    if (idx === 0) return campo.posX ?? 0;
    const prev = fila[idx - 1];
    const gap = (campo.posX ?? 0) - ((prev.posX ?? 0) + (prev.largoCampo || 240));
    return Math.max(0, gap);
  }

  ngOnInit() {
    this.realtime.connect();
    this.resolverUnidadYcargar();
    this.iniciarMonitoreoNotificaciones();

    // Auto-abrir editor colaborativo si venimos desde la campana de notificaciones.
    // Limpia los query params inmediatamente para que: (a) un reload no lo re-abra,
    // y (b) el usuario pueda volver a entrar clickeando la misma notificación.
    this.route.queryParamMap.subscribe(params => {
      const abrirDoc = params.get('abrirDoc');
      if (!abrirDoc) return;
      this.tramiteIdColab.set(params.get('tramiteId') ?? '');
      this.abrirEditorFuncionario({
        key: abrirDoc,
        nombre: params.get('docNombre') || (abrirDoc.split('/').pop() ?? 'Documento')
      });
      // Limpiar URL para evitar reapertura al recargar y permitir re-entrada desde notificación
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    });
  }

  ngOnDestroy(): void {
    this.layoutSvc.editorColabAbierto.set(false);
    this.limpiarSuscripcionesTiempoReal();
    const unidad = this.unidadId();
    if (unidad) this.realtime.unsubscribe(`/topic/bandeja/${unidad}`);
    this.bandejaSub?.unsubscribe();
    this.bandejaSub = null;
    if (this.notificacionesPollingId !== null) {
      window.clearInterval(this.notificacionesPollingId);
    }
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }
  }

  private resolverUnidadYcargar() {
    const usuario = this.authService.getUsuario();
    this.funcionarioId.set(usuario?.id ?? null);
    if (usuario?.unidadId) {
      this.unidadId.set(usuario.unidadId);
      this.cargarBandeja(usuario.unidadId);
      this.resolverNombreUnidad(usuario.unidadId);
      this.suscribirBandeja(usuario.unidadId);
      return;
    }

    if (usuario?.email) {
      this.usuarioSvc.obtenerMiPerfil().pipe(
        catchError(() => of(null))
      ).subscribe(perfil => {
        const unidad = perfil?.unidad_id || null;
        this.unidadId.set(unidad);
        if (unidad) {
          this.cargarBandeja(unidad);
          this.resolverNombreUnidad(unidad);
          this.suscribirBandeja(unidad);
        } else {
          this.error.set('El usuario autenticado no tiene una unidad asignada.');
        }
      });
      return;
    }

    this.error.set('No fue posible resolver la sesión del funcionario.');
  }

  private suscribirBandeja(unidadId: string): void {
    this.bandejaSub?.unsubscribe();
    this.realtime.unsubscribe(`/topic/bandeja/${unidadId}`);
    this.bandejaSub = this.realtime.bandejaUnidad(unidadId).subscribe(() => {
      this.cargarBandeja(unidadId);
    });
  }

  private resolverNombreUnidad(unidadId: string | null): void {
    if (!unidadId) {
      this.unidadNombre.set(null);
      return;
    }

    this.unidadSvc.obtenerTodasLasUnidades().pipe(
      catchError(() => of([] as Unidad[]))
    ).subscribe((unidades) => {
      const encontrada = (unidades || []).find(u => String(u.id) === String(unidadId));
      this.unidadNombre.set(encontrada?.nombre || encontrada?.sigla || null);
    });
  }

  recargar() {
    const unidad = this.unidadId();
    if (unidad) this.cargarBandeja(unidad);
  }

  cambiarVistaBandeja(vista: 'unidad' | 'asignados'): void {
    this.vistaBandeja.set(vista);

    const visible = this.filtrada();
    if (visible.length > 0) {
      this.seleccionarTramite(visible[0]);
      return;
    }

    this.seleccionado.set(null);
  }

  cargarBandeja(unidadId: string) {
    this.cargando.set(true);
    this.error.set(null);

    const seleccionadoActualId = this.seleccionado()?.id ?? null;

    this.tramiteSvc.listarBandeja(unidadId).pipe(
      catchError(() => of([] as TramiteResumenDTO[]))
    ).subscribe((lista: TramiteResumenDTO[]) => {
      const tramites = lista ?? [];
      this.sincronizarSuscripcionesTramites(tramites);
      const resumen = {
        total: tramites.length,
        paginaActual: 1,
        totalPaginas: 1,
        pendientes: tramites.filter(t => t.estado === 'pendiente').length,
        enProgreso: tramites.filter(t => t.estado === 'en_progreso').length,
        observados: tramites.filter(t => t.estado === 'observado').length,
        finalizados: tramites.filter(t => t.estado === 'finalizado').length,
        semaforizacion: {
          verde: tramites.filter(t => t.semaforizacion === 'Verde').length,
          amarillo: tramites.filter(t => t.semaforizacion === 'Amarillo').length,
          rojo: tramites.filter(t => t.semaforizacion === 'Rojo').length
        },
        tramites
      };
      this.resumenBandeja.set(resumen);
      this.bandeja.set(tramites);
      this.cargando.set(false);

      if (this.vistaBandeja() === 'asignados' && this.filtrada().length === 0) {
        this.error.set('No tienes trámites asignados en esta unidad para la vista actual.');
      }

      if (seleccionadoActualId) {
        const actualizado = tramites.find(t => t.id === seleccionadoActualId);
        if (actualizado) {
          this.seleccionarTramite(actualizado);
          return;
        }
      }

      if (!this.seleccionado() && tramites.length > 0) {
        this.seleccionarTramite(tramites[0]);
      }
    });
  }

  private sincronizarSuscripcionesTramites(tramites: TramiteResumenDTO[]): void {
    const idsActuales = new Set((tramites ?? []).map(t => t?.id).filter(Boolean));

    for (const id of Array.from(this.tramitesSuscritos)) {
      if (!idsActuales.has(id)) {
        this.realtime.unsubscribe(`/topic/tramite/${id}/estado`);
        this.tramitesSuscritos.delete(id);
      }
    }

    for (const id of idsActuales) {
      if (this.tramitesSuscritos.has(id)) {
        continue;
      }

      this.tramitesSuscritos.add(id);
      this.realtime.estadoTramite(id).subscribe((msg: EstadoTramiteMessage) => {
        this.notificarCambioEstado(msg);
        const unidad = this.unidadId();
        if (unidad) {
          this.cargarBandeja(unidad);
        }
      });
    }
  }

  private limpiarSuscripcionesTiempoReal(): void {
    for (const id of Array.from(this.tramitesSuscritos)) {
      this.realtime.unsubscribe(`/topic/tramite/${id}/estado`);
    }
    this.tramitesSuscritos.clear();
  }

  private iniciarMonitoreoNotificaciones(): void {
    this.revisarNotificacionesSemaforo();
    this.notificacionesPollingId = window.setInterval(() => {
      this.revisarNotificacionesSemaforo();
    }, 30000);
  }

  private revisarNotificacionesSemaforo(): void {
    this.notificacionSvc.obtenerNoLeidas().pipe(
      catchError(() => of([] as NotificacionDTO[]))
    ).subscribe((notificaciones) => {
      for (const n of notificaciones ?? []) {
        if (!n?.id || this.notificacionesMostradas.has(n.id)) {
          continue;
        }

        const tipo = (n.tipo || '').toUpperCase();
        if (tipo !== 'SEMAFORO_ROJO') {
          continue;
        }

        if (!this.esTramiteAsignadoAFuncionario(n.tramiteId)) {
          continue;
        }

        this.notificacionesMostradas.add(n.id);
        this.showToast(n.mensaje || n.titulo || 'Trámite próximo a vencerse', 'error');

        this.notificacionSvc.marcarComoLeida(n.id).pipe(
          catchError(() => of(null))
        ).subscribe();
      }
    });
  }

  private notificarCambioEstado(msg?: EstadoTramiteMessage): void {
    const tramiteId = msg?.tramiteId;
    const estadoNuevo = this.normalizarEstado(msg?.estadoNuevo);

    if (!tramiteId || !estadoNuevo) {
      return;
    }

    if (!this.esTramiteAsignadoAFuncionario(tramiteId)) {
      return;
    }

    const estadoPrevio = this.estadoToastPorTramite.get(tramiteId);
    if (estadoPrevio === estadoNuevo) {
      return;
    }

    this.estadoToastPorTramite.set(tramiteId, estadoNuevo);
    const idCorto = tramiteId.substring(0, 8).toUpperCase();
    this.showToast(`Trámite #${idCorto} cambió a estado ${estadoNuevo}.`, 'info');
  }

  private normalizarEstado(estado?: string): string | null {
    if (!estado) return null;
    const e = estado.trim().toLowerCase();
    if (e === 'en_revision') return 'En revisión';
    if (e === 'en_progreso' || e === 'en_proceso') return 'En progreso';
    if (e === 'observado') return 'Observado';
    if (e === 'finalizado') return 'Finalizado';
    if (e === 'pendiente') return 'Pendiente';
    return estado;
  }

  private esTramiteAsignadoAFuncionario(tramiteId?: string): boolean {
    if (!tramiteId) {
      return false;
    }

    const funcionario = this.funcionarioId();
    if (!funcionario) {
      return false;
    }

    const tramite = this.bandeja().find(t => t.id === tramiteId);
    if (!tramite) {
      return false;
    }

    return tramite.funcionarioAsignadoId === funcionario;
  }

  private showToast(message: string, type: 'success' | 'warning' | 'error' | 'info'): void {
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }

    this.toast.set({ visible: true, message, type });
    this.toastTimeoutId = window.setTimeout(() => {
      this.toast.set({ ...this.toast(), visible: false });
    }, 4500);
  }

  cerrarToast(): void {
    this.toast.set({ ...this.toast(), visible: false });
  }

  seleccionarTramite(resumen: TramiteResumenDTO) {
    this.seleccionado.set(resumen);
    this.exito.set(null);
    this.errorAccion.set(null);
    this.firmasEmpleado.set({});
    this.formularioActual.set(null);
    this.pasoActualFuncionario.set(null);
    this.valoresCamposFuncionario.set({});
    this.detalleSeleccionado.set(null);
    this.empDrawingState.clear();

    if (resumen.id) {
      this.cargandoFormulario.set(true);
      // Carga detalle (historial + respuestas del cliente) y formulario actual en paralelo
      this.tramiteSvc.obtenerDetalle(resumen.id).pipe(
        catchError(() => of(null))
      ).subscribe(detalle => {
        this.detalleSeleccionado.set(detalle);
        this.documentosFuncionario.set([]);
        if (detalle) this.cargarDocsFuncionario(detalle);
      });

      this.tramiteSvc.obtenerFormularioActual(resumen.id).pipe(
        catchError(() => of(null))
      ).subscribe(data => {
        this.formularioActual.set(data?.formulario ?? null);
        this.pasoActualFuncionario.set(data?.pasoActual ?? null);
        this.cargandoFormulario.set(false);
      });
    }
  }

  private cargarDocsFuncionario(tramite: any): void {
    if (!tramite) return;
    const empresaId = tramite.empresa_id || tramite.empresaId || 'EMP-DEFAULT';
    const politicaId = tramite.politica_id || tramite.politicaId || 'sin-politica';
    const tramiteId = tramite.id;
    this.cargandoDocsFuncionario.set(true);
    this.http.get<any>(`/ai/documentos/${empresaId}/${politicaId}/${tramiteId}`)
      .subscribe({
        next: (res) => {
          const docs = (res.documentos ?? []).filter((d: any) =>
            !d.key?.endsWith('.edited.html') && !d.nombre?.endsWith('.edited.html')
          );
          this.documentosFuncionario.set(docs);
          this.cargandoDocsFuncionario.set(false);
        },
        error: () => this.cargandoDocsFuncionario.set(false)
      });
  }

  proxyUrlDoc(doc: any): string {
    return `/ai/documentos/proxy/${doc.key ?? ''}`;
  }

  abrirEditorFuncionario(doc: any): void {
    this.docEnEdicionFuncionario.set(doc);
    this.mostrarEditorFuncionario.set(true);
    this.layoutSvc.editorColabAbierto.set(true);
  }

  cerrarEditorFuncionario(): void {
    this.mostrarEditorFuncionario.set(false);
    this.layoutSvc.editorColabAbierto.set(false);
    setTimeout(() => this.docEnEdicionFuncionario.set(null), 300);
  }

  formatBytesFuncionario(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  setCampoFuncionario(id: string, value: any): void {
    this.valoresCamposFuncionario.set({ ...this.valoresCamposFuncionario(), [id]: value });
  }

  getValorTablaFuncionario(campoId: string, filaId: string, columnaId: string): any {
    return this.valoresCamposFuncionario()[campoId]?.[filaId]?.[columnaId] ?? '';
  }

  setCampoTablaFuncionario(campoId: string, filaId: string, columnaId: string, value: any): void {
    const actual = this.valoresCamposFuncionario();
    const tabla = { ...(actual[campoId] ?? {}) };
    tabla[filaId] = { ...(tabla[filaId] ?? {}), [columnaId]: value };
    this.valoresCamposFuncionario.set({ ...actual, [campoId]: tabla });
  }

  ejecutarAccion(accion: 'APROBAR' | 'OBSERVAR' | 'RECHAZAR') {
    const id = this.seleccionado()?.id;
    if (!id) return;

    const nodoId = this.pasoActualFuncionario()?.id;
    const firmas = this.firmasEmpleado();
    const camposFirma = this.camposFirmaFuncionario();
    const firmasObligatorias = camposFirma.filter((c: any) => c.obligatorio);

    if (accion === 'APROBAR' && firmasObligatorias.some((c: any) => !firmas[c.id])) {
      this.errorAccion.set('Por favor, coloca tu firma antes de aprobar.');
      return;
    }

    this.ejecutando.set(true);
    this.exito.set(null);
    this.errorAccion.set(null);

    if (nodoId) {
      // Nuevo flujo: usar /responder-funcionario con todos los datos del paso actual
      const todasLasRespuestas: Record<string, any> = {
        ...this.valoresCamposFuncionario(),
        ...firmas
      };

      // Soportar acciones especiales enviadas por el funcionario
      if (accion === 'RECHAZAR') {
        todasLasRespuestas['__ACCION__'] = 'RECHAZAR';
      } else if (accion === 'OBSERVAR') {
        todasLasRespuestas['__ACCION__'] = 'OBSERVAR';
      }

      // Generar mapa de labels para el comprobante
      const camposTodos = [...this.camposFormularioFuncionario(), ...camposFirma] as any[];
      const labels: Record<string, string> = {};
      for (const c of camposTodos) {
        labels[c.id] = c.titulo || c.nombre || c.id;
      }
      if (Object.keys(labels).length > 0) {
        todasLasRespuestas['__LABELS__'] = labels;
      }

      this.tramiteSvc.responderFuncionario(id, nodoId, todasLasRespuestas).pipe(
        catchError(err => {
          this.errorAccion.set(typeof err?.error === 'string' ? err.error : 'Error al procesar. Intenta nuevamente.');
          this.ejecutando.set(false);
          return of(null);
        })
      ).subscribe(resultado => {
        if (resultado) {
          if (resultado.completado) {
            this.exito.set('Trámite completado y finalizado exitosamente.');
          } else if (resultado.enRevision) {
            this.exito.set('Trámite avanzado al siguiente departamento.');
          } else if (resultado.enProceso) {
            this.exito.set('Trámite devuelto al cliente para continuar.');
          } else if (resultado.observado) {
            this.exito.set('Observación enviada al cliente. Esperando correcciones.');
          } else if (resultado.rechazado) {
            this.exito.set('Trámite rechazado. El cliente fue notificado.');
          } else {
            this.exito.set('Trámite procesado correctamente.');
          }
          this.seleccionado.set(null);
          this.formularioActual.set(null);
          this.pasoActualFuncionario.set(null);
          this.valoresCamposFuncionario.set({});
          this.firmasEmpleado.set({});
          const unidad = this.unidadId();
          if (unidad) this.cargarBandeja(unidad);
        }
        this.ejecutando.set(false);
      });
    } else {
      // Fallback: si no hay nodoId guardado, usar el flujo anterior con /transicion
      const ejecutarTransicion = () => {
        this.tramiteSvc.avanzar(id, { accion }).pipe(
          catchError(err => {
            this.errorAccion.set(typeof err?.error === 'string' ? err.error : 'Error al ejecutar la acción. Intenta nuevamente.');
            this.ejecutando.set(false);
            return of(null);
          })
        ).subscribe(resultado => {
          if (resultado) {
            this.exito.set(accion === 'APROBAR' ? 'Trámite aprobado y avanzado correctamente.' : 'Trámite marcado como observado.');
            this.seleccionado.set(null);
            this.formularioActual.set(null);
            const unidad = this.unidadId();
            if (unidad) this.cargarBandeja(unidad);
          }
          this.ejecutando.set(false);
        });
      };

      const hayFirmas = Object.keys(firmas).length > 0;
      if (hayFirmas) {
        this.tramiteSvc.guardarDatos(id, firmas).pipe(
          catchError(() => of(null))
        ).subscribe(() => ejecutarTransicion());
      } else {
        ejecutarTransicion();
      }
    }
  }

  // ── Canvas de firma del funcionario ──────────────────────────────────────

  empStartDraw(event: MouseEvent, campoId: string): void {
    this.empDrawingState.set(campoId, true);
    const canvas = document.getElementById(`emp-canvas-${campoId}`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(
      (event.clientX - rect.left) * (canvas.width / rect.width),
      (event.clientY - rect.top) * (canvas.height / rect.height)
    );
  }

  empDraw(event: MouseEvent, campoId: string): void {
    if (!this.empDrawingState.get(campoId)) return;
    const canvas = document.getElementById(`emp-canvas-${campoId}`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineTo(
      (event.clientX - rect.left) * (canvas.width / rect.width),
      (event.clientY - rect.top) * (canvas.height / rect.height)
    );
    ctx.stroke();
  }

  empStopDraw(campoId: string): void {
    if (!this.empDrawingState.get(campoId)) return;
    this.empDrawingState.set(campoId, false);
    const canvas = document.getElementById(`emp-canvas-${campoId}`) as HTMLCanvasElement;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    this.firmasEmpleado.set({ ...this.firmasEmpleado(), [campoId]: dataUrl });
  }

  empLimpiarFirma(campoId: string): void {
    const canvas = document.getElementById(`emp-canvas-${campoId}`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    const firmas = { ...this.firmasEmpleado() };
    delete firmas[campoId];
    this.firmasEmpleado.set(firmas);
  }

  // Touch support for mobile signature
  empStartDrawTouch(event: TouchEvent, campoId: string): void {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    // synthesize a MouseEvent-like object
    const simulated: any = { clientX: touch.clientX, clientY: touch.clientY };
    this.empStartDraw(simulated as unknown as MouseEvent, campoId);
  }

  empDrawTouch(event: TouchEvent, campoId: string): void {
    if (!event.touches || event.touches.length === 0) return;
    const touch = event.touches[0];
    const simulated: any = { clientX: touch.clientX, clientY: touch.clientY };
    this.empDraw(simulated as unknown as MouseEvent, campoId);
    event.preventDefault();
  }

  empStopDrawTouch(campoId: string): void {
    this.empStopDraw(campoId);
  }

  onFileFuncionarioChange(event: Event, campoId: string): void {
    const input = event.target as HTMLInputElement;
    if (!input || !input.files) return;
    const nombres = Array.from(input.files).map(f => f.name).join(', ');
    this.archivosNombresFuncionario.set({ ...this.archivosNombresFuncionario(), [campoId]: nombres });
    // Guardar el nombre en los valores para enviar al backend (backend puede esperar nombres o IDs)
    this.valoresCamposFuncionario.set({ ...this.valoresCamposFuncionario(), [campoId]: nombres });
  }

  abrirConfirmRechazo(): void {
    this.motivoRechazo.set(null);
    this.confirmarRechazoVisible.set(true);
  }

  cerrarConfirmRechazo(): void {
    this.confirmarRechazoVisible.set(false);
  }

  confirmarRechazo(): void {
    this.confirmarRechazoVisible.set(false);
    // Si el usuario ingresó un motivo, guardarlo en los campos para enviar al backend
    const motivo = this.motivoRechazo();
    if (motivo) {
      // Guardar el motivo en valoresCamposFuncionario para que se incluya en respuestas
      this.valoresCamposFuncionario.set({ ...this.valoresCamposFuncionario(), '__motivo_rechazo': motivo });
    }
    // Ejecutar la acción RECHAZAR
    this.ejecutarAccion('RECHAZAR');
  }

  // ── Datos del cliente (para revisión) ─────────────────────────────────────

  pasosClienteConDatos = computed(() => {
    const t = this.detalleSeleccionado();
    if (!t?.historial) return [];
    return (t.historial as any[])
      .map((h: any, i: number) => {
        const nodoRespuestas = t.respuestas_por_nodo?.[h.nodoId] ?? {};
        const entradas: [string, any][] = Object.entries(nodoRespuestas).filter(
          ([k, v]) => !k.startsWith('__') && !(typeof v === 'string' && (v as string).startsWith('data:image'))
        );
        return { ...h, index: i, entradas };
      })
      .filter((h: any) => h.entradas.length > 0);
  });

  labelCampoDetalle(nodoId: string, key: string): string {
    const t = this.detalleSeleccionado();
    return t?.labels_por_nodo?.[nodoId]?.[key]
      ?? t?.labels_por_nodo?.[nodoId]?.[key.toUpperCase()]
      ?? t?.respuestas_por_nodo?.[nodoId]?.['__LABELS__']?.[key]
      ?? t?.respuestas_por_nodo?.[nodoId]?.['__labels__']?.[key]
      ?? humanizarClaveCampo(key);
  }

  formatValorDetalle(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }

  esArchivo(val: any): boolean {
    if (typeof val !== 'string') return false;
    return /\.(jpg|jpeg|png|pdf|docx|xlsx|gif|webp|doc|xls)$/i.test(val);
  }

  iconoArchivo(nombre: string): string {
    const ext = (nombre ?? '').split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext ?? '')) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext ?? '')) return '📝';
    if (['xls','xlsx'].includes(ext ?? '')) return '📊';
    return '📎';
  }

  // ── Clases de estilos ─────────────────────────────────────────────────────

  prioridadClass(prioridad?: string): string {
    switch ((prioridad || '').toLowerCase()) {
      case 'urgente': return 'bg-red-100 text-red-700';
      case 'prioritario': return 'bg-amber-100 text-amber-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  }

  prioridadBadgeClass(prioridad?: string): string {
    switch ((prioridad || '').toLowerCase()) {
      case 'urgente': return 'bg-red-50 text-red-700 border-red-200';
      case 'prioritario': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  }

  semaforoTextClass(semaforo?: string): string {
    switch (semaforo) {
      case 'Rojo': return 'text-red-700';
      case 'Amarillo': return 'text-amber-700';
      case 'Verde': return 'text-emerald-700';
      default: return 'text-slate-600';
    }
  }

  semaforoBadgeClass(semaforo?: string): string {
    switch (semaforo) {
      case 'Rojo': return 'bg-red-600 text-white';
      case 'Amarillo': return 'bg-amber-400 text-white';
      case 'Verde': return 'bg-emerald-600 text-white';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  formatearFecha(fecha?: string | null): string {
    if (!fecha) return '—';
    try {
      return new Date(fecha).toLocaleString('es-BO');
    } catch {
      return fecha;
    }
  }

  simularHoras(horas: number): void {
    this.simulador.sumarHoras(horas);
  }

  resetSimulacion(): void {
    this.simulador.reset();
  }

  limpiarFiltros(): void {
    this.busquedaCliente.set('');
    this.fechaDesde.set(null);
    this.fechaHasta.set(null);
    this.filtroSemaforo.set('todos');
    this.filtroEstado.set('todos');
  }

  private tiempoBaseMs(): number {
    return this.simulador.ahoraMs();
  }

  private obtenerFechaInicio(item: any): number | null {
    const fecha = item?.fechaInicio ?? item?.fecha_inicio;
    if (!fecha) return null;
    const valor = new Date(fecha).getTime();
    return Number.isNaN(valor) ? null : valor;
  }

  private obtenerFechaLimite(item: any): number | null {
    const fecha = item?.fechaLimite ?? item?.fecha_limite;
    if (!fecha) return null;
    const valor = new Date(fecha).getTime();
    return Number.isNaN(valor) ? null : valor;
  }

  semaforoVisual(item: any): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    if (!item) return undefined;

    const inicio = this.obtenerFechaInicio(item);
    const limite = this.obtenerFechaLimite(item);
    if (inicio === null || limite === null) {
      return this.normalizarSemaforo(item?.semaforizacion);
    }

    const ahora = this.tiempoBaseMs();
    if (ahora > limite) return 'Rojo';

    const tiempoTotal = limite - inicio;
    if (tiempoTotal <= 0) return 'Rojo';

    const porcentaje = (ahora - inicio) / tiempoTotal;
    if (porcentaje >= 0.75) return 'Rojo';
    if (porcentaje >= 0.40) return 'Amarillo';
    return 'Verde';
  }

  tiempoRestanteVisual(item: any): string {
    if (!item) return '—';
    const limite = this.obtenerFechaLimite(item);
    if (limite === null) return '—';

    const diferenciaMs = limite - this.tiempoBaseMs();
    if (diferenciaMs <= 0) return 'Vencido';

    const horas = Math.floor(diferenciaMs / 3600000);
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    return dias > 0 ? `${dias} d ${horasRestantes} h` : `${horas} h`;
  }

  venceEnVisual(item: any): string {
    const texto = this.tiempoRestanteVisual(item);
    if (texto === '—') return texto;
    if (texto === 'Vencido') return 'Vencido';
    return `Vence en ${texto}`;
  }

  private normalizarSemaforo(valor?: string): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    const normalizado = (valor || '').trim().toLowerCase();
    if (normalizado === 'rojo') return 'Rojo';
    if (normalizado === 'amarillo') return 'Amarillo';
    if (normalizado === 'verde') return 'Verde';
    return undefined;
  }
}

function humanizarClaveCampo(key: string): string {
  return (key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, letra => letra.toUpperCase()) || key;
}
