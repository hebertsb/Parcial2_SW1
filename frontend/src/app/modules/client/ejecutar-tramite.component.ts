import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TramiteService } from '../../core/services/tramite.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { AuthService } from '../../core/services/auth.service';
import { FormDinamicoComponent, TramiteCtx } from '../shared-workflow/form-dinamico.component';
import { CampoFormulario } from '../../core/models/flujo.models';

type EstadoVista = 'cargando' | 'formulario' | 'completado' | 'en_revision' | 'error';

@Component({
  selector: 'app-ejecutar-tramite',
  standalone: true,
  imports: [CommonModule, RouterModule, FormDinamicoComponent],
  template: `
    <div class="min-h-screen bg-slate-50">

      <!-- Header fijo -->
      <div class="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div class="max-w-4xl mx-auto flex items-center gap-4">
          <a routerLink="/client/dashboard"
            class="text-slate-400 hover:text-slate-600 transition-colors">
            <span class="material-symbols-outlined text-[22px]">arrow_back</span>
          </a>
          <div class="flex-1">
            <h1 class="font-semibold text-slate-800 text-lg">{{ tramite()?.nombre_tramite || 'Ejecutando trámite' }}</h1>
            @if (pasoActual()) {
              <p class="text-xs text-slate-500">
                Paso {{ pasoIndex() + 1 }} de {{ todosPasos().length }} — {{ pasoActual()?.nombre }}
              </p>
            }
          </div>
          @if (tramite()?.estado === 'en_proceso') {
            <span class="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-700 uppercase">En progreso</span>
          }
        </div>
      </div>

      <div class="max-w-4xl mx-auto px-4 py-8 space-y-6">

        <!-- ── CARGANDO ── -->
        @if (estado() === 'cargando') {
          <div class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-slate-500 text-sm">Cargando formulario...</p>
          </div>
        }

        <!-- ── ERROR ── -->
        @if (estado() === 'error') {
          <div class="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <span class="material-symbols-outlined text-5xl text-red-400 mb-3 block">error</span>
            <h2 class="text-lg font-bold text-red-700 mb-1">No se pudo cargar el formulario</h2>
            <p class="text-sm text-red-600 mb-4">{{ mensajeError() }}</p>
            <button (click)="cargar()" class="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold">
              Reintentar
            </button>
          </div>
        }

        <!-- ── FORMULARIO ── -->
        @if (estado() === 'formulario') {

          <!-- Stepper horizontal -->
          @if (todosPasos().length > 1) {
            <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <!-- Indicador de paso actual en móvil -->
              <p class="text-xs text-slate-500 mb-3 sm:hidden">
                Paso <span class="font-bold text-blue-600">{{ pasoIndex() + 1 }}</span> de {{ todosPasos().length }} — <span class="font-medium">{{ pasoActual()?.nombre }}</span>
              </p>

              <!-- Stepper scrollable -->
              <div class="overflow-x-auto -mx-1 px-1">
                <div class="flex items-center gap-1 min-w-max">
                  @for (paso of todosPasos(); track paso.id; let i = $index) {
                    <div class="flex items-center gap-1">
                      <div class="flex flex-col items-center gap-1">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
                          [class.bg-emerald-500]="i < pasoIndex()"
                          [class.text-white]="i <= pasoIndex()"
                          [class.bg-blue-600]="i === pasoIndex()"
                          [class.bg-slate-200]="i > pasoIndex()"
                          [class.text-slate-500]="i > pasoIndex()">
                          @if (i < pasoIndex()) { ✓ } @else { {{ i + 1 }} }
                        </div>
                        <p class="text-[9px] text-center text-slate-500 w-14 truncate leading-tight">{{ paso.nombre }}</p>
                      </div>
                      @if (i < todosPasos().length - 1) {
                        <div class="w-8 h-0.5 mb-4 shrink-0 transition-colors"
                          [class.bg-emerald-400]="i < pasoIndex()"
                          [class.bg-slate-200]="i >= pasoIndex()">
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Barra de progreso -->
              <div class="mt-3 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-blue-500 transition-all duration-500 rounded-full"
                  [style.width.%]="progreso()">
                </div>
              </div>
              <p class="text-xs text-slate-500 mt-1 text-right">{{ progreso() | number:'1.0-0' }}% completado</p>
            </div>
          }

          <!-- Notificación: el diseñador actualizó el formulario -->
          @if (formularioCambioNotificado()) {
            <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-blue-700">
              <span class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block flex-shrink-0"></span>
              El diseñador actualizó el formulario — recargando...
            </div>
          }

          <!-- Formulario del paso -->
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
            <div>
              @if (mostrarFormulario()) {
                <app-form-dinamico
                  [campos]="campos()"
                  [respuestasPrevias]="respuestasPrevias()"
                  [mostrarAnterior]="false"
                  [esUltimoStep]="esUltimoPaso()"
                  [cargando]="enviando()"
                  [tramiteCtx]="tramiteCtx()"
                  [nombrePaso]="pasoActual()?.nombre || ''"
                  [nombrePolitica]="tramite()?.nombre_tramite || ''"
                  (formularioEnviado)="onEnviar($event)">
                </app-form-dinamico>
              } @else {
                <!-- Paso sin formulario: avance/finalización manual -->
                <div class="text-center px-6 py-8">
                  <span class="material-symbols-outlined text-5xl text-slate-300 mb-3 block">info</span>
                  <p class="text-slate-500 text-sm mb-4">
                    @if (esUltimoPaso()) {
                      Este es el paso final del trámite.
                    } @else {
                      Este paso no requiere llenar un formulario.
                    }
                  </p>
                  <button (click)="avanzarSinFormulario()" [disabled]="enviando()"
                    class="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {{ esUltimoPaso() ? 'Finalizar trámite ✓' : 'Continuar →' }}
                  </button>
                </div>
              }
            </div>
          </div>
        }

        <!-- ── EN REVISIÓN ── -->
        @if (estado() === 'en_revision') {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div class="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span class="material-symbols-outlined text-5xl text-violet-500">hourglass_empty</span>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-2">¡Trámite enviado al encargado!</h2>
            <p class="text-slate-500 mb-2">
              Has completado tu parte del trámite «<strong>{{ tramite()?.nombre_tramite }}</strong>».
            </p>
            <p class="text-sm text-slate-400 mb-8">El comprobante final estará disponible una vez que el funcionario o encargado del departamento apruebe y firme el trámite.</p>

            <div class="flex gap-3 justify-center">
              <a routerLink="/client/dashboard"
                class="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                Ir a Mis Trámites
              </a>
              <a [routerLink]="['/tramites', tramiteId(), 'detalle']"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                Ver Detalle
              </a>
            </div>
          </div>
        }
        @if (estado() === 'completado') {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center">
            <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span class="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
            </div>
            <h2 class="text-2xl font-bold text-slate-800 mb-2">¡Trámite completado!</h2>
            <p class="text-slate-500 mb-2">
              Has completado exitosamente «<strong>{{ tramite()?.nombre_tramite }}</strong>».
            </p>
            <p class="text-sm text-slate-400 mb-8">Tu solicitud será procesada por el equipo correspondiente.</p>

            <div class="grid grid-cols-2 gap-4 max-w-xs mx-auto mb-8">
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500 mb-1">Estado</p>
                <p class="font-bold text-emerald-600 text-sm">Finalizado</p>
              </div>
              <div class="bg-slate-50 rounded-xl p-4 text-center">
                <p class="text-xs text-slate-500 mb-1">Pasos completados</p>
                <p class="font-bold text-slate-800 text-sm">{{ todosPasos().length }}</p>
              </div>
            </div>

            <div class="flex gap-3 justify-center">
              <a routerLink="/client/dashboard"
                class="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors">
                Ir a Mis Trámites
              </a>
              <a [routerLink]="['/tramites', tramiteId(), 'detalle']"
                class="px-6 py-3 border border-slate-200 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-50 transition-colors">
                Ver Detalle
              </a>
            </div>
          </div>
        }

      </div>
    </div>
  `
})
export class EjecutarTramiteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tramiteSvc = inject(TramiteService);
  private realtime = inject(RealtimeService);
  private authSvc = inject(AuthService);

  estado = signal<EstadoVista>('cargando');
  tramite = signal<any>(null);
  pasoActual = signal<any>(null);
  todosPasos = signal<any[]>([]);
  formulario = signal<any>(null);
  respuestasPrevias = signal<Record<string, any>>({});
  enviando = signal(false);
  mensajeError = signal('');

  tramiteId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');

  tramiteCtx = computed<TramiteCtx | undefined>(() => {
    const t = this.tramite();
    if (!t) return undefined;
    const u = this.authSvc.getUsuario() as any;
    return {
      empresaId: t.empresa_id || t.empresaId || u?.empresa_id || u?.empresa || 'EMP-DEFAULT',
      politicaId: t.politica_id || t.politicaId || 'sin-politica',
      tramiteId: t.id,
      subidoPor: u?.nombre || u?.email || 'cliente'
    };
  });

  pasoIndex = computed(() => {
    const id = this.pasoActual()?.id;
    const idx = this.todosPasos().findIndex(p => p.id === id);
    // Si pasoActual es un nodo de control (INICIO/GATEWAY), devolver 0 como fallback
    return idx >= 0 ? idx : 0;
  });

  progreso = computed(() => {
    const total = this.todosPasos().length;
    if (total === 0) return 0;
    return Math.round((this.pasoIndex() / total) * 100);
  });

  campos = computed<CampoFormulario[]>(() => {
    const form = this.formulario();
    if (!form) return [];
    const all = (form.campos ?? form.esquema_campos ?? []) as CampoFormulario[];
    // Ocultar campos de firma que correspondan a otro rol (funcionario, gerente, etc.)
    // El cliente solo ve sus propios campos de firma (rolFirma vacío o que contenga "CLIENTE")
    return all.filter(c => {
      if (c.tipo === 'firma' && c.rolFirma) {
        return c.rolFirma.toUpperCase().includes('CLIENTE');
      }
      return true;
    });
  });

  esUltimoPaso = computed(() => Boolean(this.pasoActual()?.esUltimo));
  // Prioridad: si hay campos, mostrar el formulario SIN IMPORTA si es el último paso
  mostrarFormulario = computed(() => this.campos().length > 0);
  private realtimeSub: Subscription | null = null;
  private formularioCambio$ = new Subject<void>();
  private formularioSub: Subscription | null = null;
  private destroy$ = new Subject<void>();
  formularioCambioNotificado = signal(false);

  ngOnInit(): void {
    this.realtime.connect();
    // Debounce: al recibir cambios del diseñador, recargar 1.5s después del último cambio
    this.formularioCambio$
      .pipe(debounceTime(1500), takeUntil(this.destroy$))
      .subscribe(() => {
        this.formularioCambioNotificado.set(false);
        this.cargar();
      });
    this.cargar();
    const id = this.tramiteId();
    if (id) {
      this.realtimeSub = this.realtime.estadoTramite(id).subscribe(() => {
        this.cargar();
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    const id = this.tramiteId();
    if (id) {
      this.realtime.unsubscribe(`/topic/tramite/${id}/estado`);
    }
    if (this.realtimeSub) {
      this.realtimeSub.unsubscribe();
      this.realtimeSub = null;
    }
    if (this.formularioSub) {
      this.formularioSub.unsubscribe();
      this.formularioSub = null;
    }
  }

  cargar(): void {
    const id = this.tramiteId();
    if (!id) {
      this.estado.set('error');
      this.mensajeError.set('ID de trámite no válido.');
      return;
    }
    this.estado.set('cargando');
    this.tramiteSvc.obtenerFormularioActual(id).subscribe({
      next: (data) => {
        this.tramite.set(data.tramite);
        this.pasoActual.set(data.pasoActual);
        this.todosPasos.set(data.todosPasos ?? []);
        this.formulario.set(data.formulario ?? null);
        this.respuestasPrevias.set(data.respuestasPrevias ?? {});

        // Suscribirse a cambios del diseñador en el formulario actual
        const formularioId: string | undefined = data.formulario?.id;
        if (formularioId) {
          if (this.formularioSub) {
            this.formularioSub.unsubscribe();
            this.formularioSub = null;
          }
          this.formularioSub = this.realtime.camposFormulario(formularioId).subscribe(() => {
            this.formularioCambioNotificado.set(true);
            this.formularioCambio$.next();
          });
        }

        const estadoTramite = data.tramite?.estado;
        if (estadoTramite === 'finalizado') {
          this.estado.set('completado');
        } else if (estadoTramite === 'en_revision' || estadoTramite === 'rechazado') {
          this.estado.set('en_revision');
        } else {
          this.estado.set('formulario');
        }
      },
      error: (err) => {
        this.estado.set('error');
        this.mensajeError.set(err?.error ?? 'Error al cargar el formulario.');
      }
    });
  }

  onEnviar(respuestas: Record<string, any>): void {
    this.enviarRespuestas(respuestas);
  }

  avanzarSinFormulario(): void {
    this.enviarRespuestas({});
  }

  private enviarRespuestas(respuestas: Record<string, any>): void {
    const id = this.tramiteId();
    const nodoId = this.pasoActual()?.id;
    if (!nodoId) return;

    this.enviando.set(true);
    this.tramiteSvc.responder(id, nodoId, respuestas).subscribe({
      next: (resultado) => {
        this.enviando.set(false);
        this.tramite.set(resultado.tramite);

        // ✅ Trámite completado por FUNCIONARIO: ir a pantalla de éxito
        if (resultado.completado) {
          this.estado.set('completado');
          return;
        }

        // ⏳ Trámite enviado a revisión: mostrar pantalla de espera y NO recargar
        if (resultado.enRevision) {
          this.estado.set('en_revision');
          return;
        }

        // ➡️ Hay un paso siguiente para el cliente: avanzar
        if (resultado.siguientePaso) {
          // Si el siguiente paso es el nodo final (esUltimo) y no viene formulario, considerarlo completado
          if (resultado.siguientePaso.esUltimo && !resultado.siguienteFormulario) {
            this.estado.set('completado');
            return;
          }
          this.pasoActual.set(resultado.siguientePaso);
        }
        if (resultado.siguienteFormulario) {
          this.formulario.set(resultado.siguienteFormulario);
          this.estado.set('formulario');
        } else if (resultado.siguientePaso) {
          // Siguiente paso sin formulario inline: recargamos para obtenerlo del backend
          this.cargar();
          return;
        } else {
          // Sin siguiente paso ni formulario: ir a revisión por seguridad
          this.estado.set('en_revision');
          return;
        }
        this.respuestasPrevias.set({});
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.enviando.set(false);
        alert('Error al enviar: ' + (err?.error ?? 'Error de conexión'));
      }
    });
  }
}
