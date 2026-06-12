import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { TramiteService } from '../../core/services/tramite.service';
import { PoliticaService } from '../../core/services/politica.service';
import { AuthService } from '../../core/services/auth.service';
import { catchError, of } from 'rxjs';
import { RealtimeService } from '../../core/services/realtime.service';

@Component({
  selector: 'app-client',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="flex flex-col gap-6 max-w-4xl mx-auto w-full">

      <!-- Header con bienvenida -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Mis Trámites</h1>
          <p class="text-sm text-slate-500 mt-1">Seguí el estado de tus solicitudes y gestioná tus documentos.</p>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <button (click)="mostrarModalNuevo.set(true)"
            class="flex items-center justify-center gap-2 flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow transition-colors shrink-0">
            <span class="material-symbols-outlined text-[18px]">add</span>
            Nueva Solicitud
          </button>
        </div>
      </div>

      <!-- Métricas -->
      <div class="grid grid-cols-3 gap-2 sm:gap-4">
        <!-- En proceso -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-center sm:text-left">
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[18px] sm:text-[24px]">pending_actions</span>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">En proceso</p>
            <p class="text-xl sm:text-2xl font-bold text-blue-600 tabular-nums">{{ enProgreso() }}</p>
          </div>
        </div>
        <!-- Completados -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-center sm:text-left">
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[18px] sm:text-[24px]">task_alt</span>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">Completos</p>
            <p class="text-xl sm:text-2xl font-bold text-emerald-600 tabular-nums">{{ completados() }}</p>
          </div>
        </div>
        <!-- Total -->
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-1 sm:gap-4 text-center sm:text-left">
          <div class="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-slate-600 dark:text-slate-300 text-[18px] sm:text-[24px]">folder</span>
          </div>
          <div class="min-w-0">
            <p class="text-[9px] sm:text-[11px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">Total</p>
            <p class="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white tabular-nums">{{ tramites().length }}</p>
          </div>
        </div>
      </div>

      <!-- Filtros -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 flex flex-col sm:flex-row gap-3">
        <!-- Buscador por nombre -->
        <div class="flex items-center gap-2 flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
          <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Buscar por nombre de trámite..."
            [value]="filtroTexto()"
            (input)="filtroTexto.set($any($event.target).value)"
            class="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none">
          @if (filtroTexto()) {
            <button (click)="filtroTexto.set('')" class="text-slate-400 hover:text-slate-600">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          }
        </div>

        <!-- Filtro por estado -->
        <select [value]="filtroEstado()" (change)="filtroEstado.set($any($event.target).value)"
          class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="">Todos los estados</option>
          <option value="en_proceso">En proceso</option>
          <option value="en_revision">En revisión</option>
          <option value="observado">Observado</option>
          <option value="rechazado">Rechazado</option>
          <option value="finalizado">Finalizado</option>
        </select>

        <!-- Ordenar -->
        <select [value]="filtroOrden()" (change)="filtroOrden.set($any($event.target).value)"
          class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
          <option value="reciente">Más recientes</option>
          <option value="antiguo">Más antiguos</option>
          <option value="nombre">Por nombre A-Z</option>
        </select>

        <!-- Contador de resultados -->
        @if (filtroTexto() || filtroEstado()) {
          <div class="flex items-center gap-2 text-xs text-slate-500 shrink-0 px-1">
            <span class="font-semibold text-blue-600">{{ tramitesFiltrados().length }}</span> resultado{{ tramitesFiltrados().length !== 1 ? 's' : '' }}
            <button (click)="limpiarFiltros()" class="text-slate-400 hover:text-red-500 transition-colors ml-1">
              <span class="material-symbols-outlined text-[16px]">filter_alt_off</span>
            </button>
          </div>
        }
      </div>

      <!-- Lista de trámites -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 class="text-base font-bold text-slate-800 dark:text-white">Mis Solicitudes</h2>
          <span class="text-xs text-slate-400">{{ tramitesFiltrados().length }} de {{ tramites().length }}</span>
        </div>

        <div class="divide-y divide-slate-100 dark:divide-slate-700">
          @for (t of tramitesFiltrados(); track t.id) {
            <div class="px-4 py-4 sm:px-6 sm:py-5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <div class="flex flex-col gap-3">

                <!-- Fila superior: icono + info -->
                <div class="flex items-start gap-3">
                  <!-- Icono de estado -->
                  <div class="shrink-0 mt-0.5">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center"
                      [class.bg-blue-100]="esTramiteEnProceso(t)"
                      [class.bg-amber-100]="esTramiteEnRevision(t) || esTramiteObservado(t)"
                      [class.bg-red-100]="esTramiteRechazado(t)"
                      [class.bg-emerald-100]="esTramiteFinalizado(t)"
                      [class.bg-slate-100]="!esTramiteEnProceso(t) && !esTramiteEnRevision(t) && !esTramiteObservado(t) && !esTramiteRechazado(t) && !esTramiteFinalizado(t)">
                      <span class="material-symbols-outlined text-[18px] sm:text-[20px]"
                        [class.text-blue-600]="esTramiteEnProceso(t)"
                        [class.text-amber-600]="esTramiteEnRevision(t) || esTramiteObservado(t)"
                        [class.text-red-500]="esTramiteRechazado(t)"
                        [class.text-emerald-600]="esTramiteFinalizado(t)"
                        [class.text-slate-400]="!esTramiteEnProceso(t) && !esTramiteEnRevision(t) && !esTramiteObservado(t) && !esTramiteRechazado(t) && !esTramiteFinalizado(t)">
                        {{ esTramiteFinalizado(t) ? 'check_circle' : esTramiteRechazado(t) ? 'cancel' : esTramiteObservado(t) ? 'warning' : esTramiteEnRevision(t) ? 'hourglass_empty' : 'pending_actions' }}
                      </span>
                    </div>
                  </div>

                  <!-- Info principal -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <h3 class="font-semibold text-slate-800 dark:text-white text-sm leading-snug">
                        {{ t.nombre_tramite || t.politicaNombre || 'Trámite' }}
                      </h3>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                        [class.bg-blue-100]="esTramiteEnProceso(t)"  [class.text-blue-700]="esTramiteEnProceso(t)"
                        [class.bg-amber-100]="esTramiteEnRevision(t) || esTramiteObservado(t)" [class.text-amber-700]="esTramiteEnRevision(t) || esTramiteObservado(t)"
                        [class.bg-red-100]="esTramiteRechazado(t)" [class.text-red-600]="esTramiteRechazado(t)"
                        [class.bg-emerald-100]="esTramiteFinalizado(t)" [class.text-emerald-700]="esTramiteFinalizado(t)"
                        [class.bg-slate-100]="!esTramiteEnProceso(t) && !esTramiteEnRevision(t) && !esTramiteObservado(t) && !esTramiteRechazado(t) && !esTramiteFinalizado(t)"
                        [class.text-slate-500]="!esTramiteEnProceso(t) && !esTramiteEnRevision(t) && !esTramiteObservado(t) && !esTramiteRechazado(t) && !esTramiteFinalizado(t)">
                        {{ etiquetaEstado(t) }}
                      </span>
                    </div>
                    <p class="text-[10px] text-slate-400 mt-0.5 font-mono truncate">{{ t.id }}</p>
                    @if (esTramiteEnRevision(t)) {
                      <p class="text-xs text-amber-600 mt-1">⏳ Esperando revisión del funcionario</p>
                    }
                    @if (esTramiteObservado(t)) {
                      <p class="text-xs text-amber-700 mt-1">⚠️ Se solicitaron correcciones</p>
                    }
                    @if (esTramiteRechazado(t)) {
                      <p class="text-xs text-red-500 mt-1">✕ Solicitud rechazada</p>
                    }
                    @if (esTramiteFinalizado(t)) {
                      <p class="text-xs text-emerald-600 mt-1">✓ Proceso completado</p>
                    }
                  </div>
                </div>

                <!-- Acciones — fila separada en móvil -->
                <div class="flex items-center gap-2 flex-wrap pl-12 sm:pl-0">
                  @if (esTramiteEnProceso(t)) {
                    <a [routerLink]="['/tramites', t.id, 'ejecutar']"
                      class="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">play_arrow</span>
                      Continuar
                    </a>
                  }
                  <a [routerLink]="['/tramites', t.id, 'detalle']"
                    class="px-3 py-1.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px]">visibility</span>
                    Ver
                  </a>
                  @if (esTramiteFinalizado(t)) {
                    <a [routerLink]="['/tramites', t.id, 'comprobante']"
                      class="px-3 py-1.5 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-50 transition-colors flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]">download</span>
                      Comprobante
                    </a>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="py-16 text-center">
              <div class="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span class="material-symbols-outlined text-4xl text-blue-400">folder_open</span>
              </div>
              <h3 class="text-base font-semibold text-slate-700 dark:text-white mb-1">Sin solicitudes aún</h3>
              <p class="text-sm text-slate-500 mb-5">Iniciá tu primera solicitud haciendo clic en "Nueva Solicitud".</p>
              <button (click)="mostrarModalNuevo.set(true)"
                class="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">add</span>
                Iniciar mi primera solicitud
              </button>
            </div>
          }
        </div>
      </div>

      <!-- MODAL NUEVO TRÁMITE -->
      @if (mostrarModalNuevo()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div class="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 class="text-xl font-bold text-slate-800">Iniciar Nuevo Trámite</h2>
              <button (click)="mostrarModalNuevo.set(false)" class="text-slate-400 hover:text-slate-600">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>

            <div class="p-6 space-y-4">
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-2">Seleccione el Proceso</label>
                <select
                  [(ngModel)]="politicaSeleccionada"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccione una opción...</option>
                  @for (p of politicas(); track p.id) {
                    <option [value]="p.id">{{ p.nombre }}</option>
                  }
                </select>
              </div>

              @if (politicaSeleccionadaInfo()) {
                <div class="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <p class="text-xs font-semibold uppercase tracking-wide text-blue-700">Duración estimada del proceso</p>
                  <p class="text-sm font-bold text-blue-900 mt-1">
                    {{ politicaSeleccionadaInfo()?.duracion_estandar_dias ?? 5 }} días hábiles
                  </p>
                  <p class="text-xs text-blue-700 mt-1">Este valor viene de la política de negocio y no se edita al iniciar el trámite.</p>
                </div>
              }

              @if (errorInicio()) {
                <div class="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {{ errorInicio() }}
                </div>
              }
            </div>

            <div class="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                (click)="mostrarModalNuevo.set(false)"
                class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-white transition-colors">
                Cancelar
              </button>
              <button
                (click)="iniciarTramite()"
                [disabled]="!politicaSeleccionada || iniciando()"
                class="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                @if (iniciando()) {
                  <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                }
                Confirmar e Iniciar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class ClientComponent implements OnInit, OnDestroy {
  private tramiteSvc = inject(TramiteService);
  private politicaSvc = inject(PoliticaService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private realtime = inject(RealtimeService);

  tramites = signal<any[]>([]);
  politicas = signal<any[]>([]);
  enProgreso = signal(0);
  completados = signal(0);
  mostrarModalNuevo = signal(false);
  iniciando = signal(false);
  errorInicio = signal('');
  politicaSeleccionada = '';
  private tramitesSuscritos = new Set<string>();

  // Filtros
  filtroTexto = signal('');
  filtroEstado = signal('');
  filtroOrden = signal('reciente');

  tramitesFiltrados = computed(() => {
    let lista = this.tramites();
    const texto = this.filtroTexto().toLowerCase().trim();
    const estado = this.filtroEstado();
    if (texto) {
      lista = lista.filter((t: any) =>
        (t.nombre_tramite ?? t.tipo_tramite ?? t.id ?? '').toLowerCase().includes(texto)
      );
    }
    if (estado) {
      lista = lista.filter((t: any) => t.estado === estado);
    }
    const orden = this.filtroOrden();
    if (orden === 'reciente') {
      lista = [...lista].sort((a, b) => new Date(b.fecha_inicio ?? 0).getTime() - new Date(a.fecha_inicio ?? 0).getTime());
    } else if (orden === 'antiguo') {
      lista = [...lista].sort((a, b) => new Date(a.fecha_inicio ?? 0).getTime() - new Date(b.fecha_inicio ?? 0).getTime());
    } else if (orden === 'nombre') {
      lista = [...lista].sort((a, b) => (a.nombre_tramite ?? a.tipo_tramite ?? '').localeCompare(b.nombre_tramite ?? b.tipo_tramite ?? ''));
    }
    return lista;
  });

  limpiarFiltros(): void {
    this.filtroTexto.set('');
    this.filtroEstado.set('');
    this.filtroOrden.set('reciente');
  }

  ngOnInit(): void {
    this.realtime.connect();
    this.cargarDatos();
    this.route.queryParamMap.subscribe(params => {
      const politicaId = params.get('politica');
      if (politicaId) {
        this.politicaSeleccionada = politicaId;
        this.mostrarModalNuevo.set(true);
      }
    });
  }

  ngOnDestroy(): void {
    this.limpiarSuscripcionesTiempoReal();
  }

  cargarDatos(): void {
    this.tramiteSvc.listarMisTramites().pipe(catchError(() => of([]))).subscribe(list => {
      this.tramites.set(list);
      this.sincronizarSuscripcionesTramites(list);
      this.enProgreso.set(
        list.filter((t: any) =>
          ['en_proceso', 'en_progreso', 'en_revision', 'observado'].includes(t.estado) && !t.fecha_fin
        ).length
      );
      this.completados.set(list.filter((t: any) => t.estado === 'finalizado' || Boolean(t.fecha_fin)).length);
    });

    const usuario = this.auth.getUsuario();
    const empresaId = (usuario as any)?.empresa_id ?? (usuario as any)?.empresa ?? '';
    const politicas$ = empresaId
      ? this.politicaSvc.obtenerPoliticasPorEmpresa(empresaId)
      : this.politicaSvc.obtenerTodasLasPoliticas();
    politicas$.pipe(catchError(() => of([]))).subscribe(list => {
      const politicasActivas = list.filter((p: any) => p.esta_activa === true);
      this.politicas.set(politicasActivas);
    });
  }

  private sincronizarSuscripcionesTramites(tramites: any[]): void {
    const idsActuales = new Set((tramites ?? []).map((t: any) => t?.id).filter(Boolean));

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
      this.realtime.estadoTramite(id).subscribe(() => {
        this.cargarDatos();
      });
    }
  }

  private limpiarSuscripcionesTiempoReal(): void {
    for (const id of Array.from(this.tramitesSuscritos)) {
      this.realtime.unsubscribe(`/topic/tramite/${id}/estado`);
    }
    this.tramitesSuscritos.clear();
  }

  esTramiteFinalizado(tramite: any): boolean {
    return tramite?.estado === 'finalizado' || Boolean(tramite?.fecha_fin);
  }

  esTramiteEnProceso(tramite: any): boolean {
    return ['en_proceso', 'en_progreso'].includes(tramite?.estado) && !tramite?.fecha_fin;
  }

  esTramiteEnRevision(tramite: any): boolean {
    return tramite?.estado === 'en_revision' && !tramite?.fecha_fin;
  }

  esTramiteObservado(tramite: any): boolean {
    return tramite?.estado === 'observado' && !tramite?.fecha_fin;
  }

  esTramiteRechazado(tramite: any): boolean {
    return tramite?.estado === 'rechazado';
  }

  etiquetaEstado(tramite: any): string {
    const e = tramite?.estado;
    if (tramite?.fecha_fin || e === 'finalizado') return 'Finalizado';
    if (e === 'en_revision') return 'En revisión';
    if (e === 'en_progreso') return 'En progreso';
    if (e === 'en_proceso') return 'En proceso';
    if (e === 'observado') return 'Observado';
    if (e === 'rechazado') return 'Rechazado';
    return e ?? 'Pendiente';
  }

  politicaSeleccionadaInfo(): any {
    return this.politicas().find((p: any) => p.id === this.politicaSeleccionada) ?? null;
  }

  iniciarTramite(): void {
    if (!this.politicaSeleccionada) return;
    this.iniciando.set(true);
    this.errorInicio.set('');

    this.tramiteSvc.iniciar(this.politicaSeleccionada).subscribe({
      next: (creado: any) => {
        this.iniciando.set(false);
        this.mostrarModalNuevo.set(false);
        this.politicaSeleccionada = '';
        this.router.navigate(['/tramites', creado.id, 'ejecutar']);
      },
      error: (err) => {
        this.iniciando.set(false);
        this.errorInicio.set(err?.error ?? 'Error al iniciar. Intente nuevamente.');
      }
    });
  }

}

