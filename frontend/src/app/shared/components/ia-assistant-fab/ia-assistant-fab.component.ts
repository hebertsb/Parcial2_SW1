import { Component, inject, OnInit, OnDestroy, signal, effect, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { IaAssistantService } from '../../../core/services/ia-assistant.service';
import { AuthService } from '../../../core/services/auth.service';
import { TramiteService } from '../../../core/services/tramite.service';
import { NotificacionService, NotificacionDTO } from '../../../core/services/notificacion.service';
import { LayoutService } from '../../../core/services/layout.service';

interface Mensaje {
  rol: 'user' | 'agent';
  texto: string;
  politica?: { nombre: string; descripcion: string; requisitos: string[] } | null;
  candidatas?: { nombre: string; score: number }[];
  timestamp: Date;
  escribiendo?: boolean;
  puedeIniciar?: boolean;
  politicaMongoId?: string;
  iniciando?: boolean;
  esNotificacion?: boolean;
  metodo?: string;
  puedeVerTramite?: boolean;
  tramiteId?: string;
}

@Component({
  selector: 'app-ia-assistant-fab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── FAB BUTTON ─────────────────────────────────────── -->
    <!-- Oculto mientras el editor colaborativo está abierto -->
    @if (!layoutSvc.editorColabAbierto()) {
    <button
      (click)="toggleChat()"
      class="ia-fab fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center border-4 border-white shadow-xl transition-all hover:scale-110 hover:bg-blue-700 active:scale-95 z-50"
      title="Asistente NexusFlow">
      <div class="flex flex-col items-center justify-center">
        @if (abierto()) {
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        } @else {
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span class="text-[7px] font-bold uppercase mt-0.5 tracking-wide">IA</span>
        }
      </div>
      @if (!abierto() && mensajesNuevos() > 0) {
        <div class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></div>
      }
    </button>
    }

    <!-- ── CHAT PANEL ─────────────────────────────────────── -->
    @if (abierto() && !layoutSvc.editorColabAbierto()) {
      <div class="fixed bottom-28 right-8 w-[380px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden"
           style="height: 520px;">

        <!-- Header -->
        <div class="bg-blue-600 px-4 py-3 flex items-center gap-3 shrink-0">
          <div class="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-white font-bold text-sm">NexusBot</p>
            <p class="text-blue-200 text-[11px]">Asistente especializado en trámites</p>
          </div>
          <!-- Botón limpiar -->
          <button (click)="limpiarChat()" title="Nueva conversación"
            class="text-blue-200 hover:text-white transition-colors p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>

        <!-- Mensajes -->
        <div #mensajesDiv class="flex-1 overflow-y-auto px-4 py-3 space-y-3">

          @for (msg of mensajes(); track msg.timestamp) {

            <!-- Mensaje del agente -->
            @if (msg.rol === 'agent') {
              <div class="flex gap-2">
                <div class="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </div>
                <div class="flex-1 min-w-0">
                  @if (msg.escribiendo) {
                    <div class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3">
                      <div class="flex gap-1">
                        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
                        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
                        <span class="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
                      </div>
                    </div>
                  } @else if (msg.esNotificacion) {
                    <div class="bg-amber-50 border border-amber-200 rounded-2xl rounded-tl-none px-4 py-3">
                      <p class="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Actualización de trámite</p>
                      <p class="text-sm text-slate-700 whitespace-pre-line">{{ msg.texto }}</p>
                    </div>
                  } @else {
                    <div class="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3">
                      <p class="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line">{{ msg.texto }}</p>
                    </div>

                    <!-- Política recomendada -->
                    @if (msg.politica) {
                      <div class="mt-2 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2.5">
                        <p class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Trámite recomendado</p>
                        <p class="text-sm font-bold text-slate-800 dark:text-white">{{ msg.politica.nombre }}</p>
                        @if (msg.politica.descripcion) {
                          <p class="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{{ msg.politica.descripcion }}</p>
                        }
                        @if (msg.politica.requisitos.length) {
                          <div class="mt-2">
                            <p class="text-[10px] font-semibold text-slate-500 mb-1">Documentos requeridos:</p>
                            <div class="flex flex-wrap gap-1">
                              @for (req of msg.politica.requisitos; track req) {
                                <span class="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                                  {{ req }}
                                </span>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    }

                    <!-- Botón Ver Trámite -->
                    @if (msg.puedeVerTramite && msg.tramiteId) {
                      <div class="mt-3">
                        <button (click)="verTramiteDesdeBot(msg)"
                          class="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                          </svg>
                          Ver Trámite en Panel
                        </button>
                        <p class="text-[10px] text-slate-400 text-center mt-1">
                          Abre el detalle completo del trámite
                        </p>
                      </div>
                    }

                    <!-- Botón Iniciar Trámite -->
                    @if (msg.puedeIniciar && msg.politicaMongoId) {
                      <div class="mt-3">
                        <button (click)="iniciarDesdeBot(msg)"
                          [disabled]="msg.iniciando"
                          class="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all shadow-md">
                          @if (msg.iniciando) {
                            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Iniciando...
                          } @else {
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            Iniciar Trámite Ahora
                          }
                        </button>
                        <p class="text-[10px] text-slate-400 text-center mt-1">
                          Se abrirá el formulario directamente
                        </p>
                      </div>
                    }

                    <!-- Otras opciones -->
                    @if (msg.candidatas && msg.candidatas.length > 1) {
                      <div class="mt-1.5 space-y-1">
                        <p class="text-[10px] text-slate-400 px-1">Otras opciones:</p>
                        @for (c of msg.candidatas.slice(1, 3); track c.nombre) {
                          <div class="bg-slate-50 dark:bg-slate-800/60 rounded-lg px-3 py-1.5 flex items-center justify-between">
                            <p class="text-xs text-slate-600 dark:text-slate-300 truncate">{{ c.nombre }}</p>
                            <span class="text-[10px] text-slate-400 shrink-0 ml-2">{{ (c.score * 100).toFixed(0) }}%</span>
                          </div>
                        }
                      </div>
                    }
                  }
                </div>
              </div>
            }

            <!-- Mensaje del usuario -->
            @if (msg.rol === 'user') {
              <div class="flex justify-end">
                <div class="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5">
                  <p class="text-sm">{{ msg.texto }}</p>
                </div>
              </div>
            }
          }
        </div>

        <!-- Sugerencias rápidas (solo al inicio) -->
        @if (mensajes().length <= 1) {
          <div class="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
            @for (sug of sugerencias; track sug) {
              <button (click)="enviarSugerencia(sug)"
                class="text-[11px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors">
                {{ sug }}
              </button>
            }
          </div>
        }

        <!-- Input -->
        <div class="px-4 pb-4 pt-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <div class="flex gap-2">
            <!-- Botón de voz -->
            <button (click)="toggleVoz()" [title]="grabando() ? 'Detener grabación' : 'Hablar'"
              [class]="grabando()
                ? 'w-10 h-10 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 animate-pulse'
                : 'w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 hover:bg-slate-200 transition-colors'">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
              </svg>
            </button>

            <textarea #inputRef
              [(ngModel)]="inputTexto"
              (keydown.enter)="$event.preventDefault(); enviar()"
              [disabled]="respondiendo()"
              rows="1"
              placeholder="{{ grabando() ? 'Escuchando...' : 'Describí tu situación...' }}"
              class="flex-1 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60"
              style="min-height:40px; max-height:100px;">
            </textarea>

            <button (click)="enviar()" [disabled]="!inputTexto.trim() || respondiendo()"
              class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 hover:bg-blue-700 transition-colors disabled:opacity-50">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    }
  `
})
export class IaAssistantFabComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('mensajesDiv') mensajesDiv!: ElementRef;
  @ViewChild('inputRef') inputRef!: ElementRef;

  alertCount = signal<number>(0);
  /** Dot badge: nuevos mensajes de notificación en el chat mientras estaba cerrado */
  mensajesNuevos = signal(0);
  abierto = signal(false);
  mensajes = signal<Mensaje[]>([]);
  inputTexto = '';
  respondiendo = signal(false);
  grabando = signal(false);
  /** Nombre de la política discutida en el turno anterior (multi-turn context) */
  private politicaEnContexto = signal('');
  /** Índice del último paso mostrado al cliente (-1=ninguno, 0=paso1, 1=paso2...) */
  private pasoActual = signal(-1);
  /** Lista de trámites activos mostrada al cliente para selección conversacional */
  private tramitesEnContexto = signal<Array<{nombre: string; tramite_id: string}>>([]);
  /** _id del trámite mostrado en el turno anterior (para "ver historial") */
  private tramiteIdEnContexto = signal('');
  private notifIdsVistos = new Set<string>();
  private _primeraNotifRun = true;

  private router = inject(Router);
  private http = inject(HttpClient);
  private iaSvc = inject(IaAssistantService);
  private auth = inject(AuthService);
  private tramiteSvc = inject(TramiteService);
  private notifSvc = inject(NotificacionService);
  layoutSvc = inject(LayoutService);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private deberiaScroll = false;

  readonly sugerencias = [
    '¿Qué trámites tienen disponibles?',
    'Necesito renovar mi licencia',
    '¿Cómo va mi trámite activo?',
    'Quiero iniciar una solicitud',
  ];

  constructor() {
    effect(() => {
      const notifs = this.notifSvc.notificaciones();
      if (this.auth.getRol() === 'ROL-CLIENTE') {
        this._inyectarNuevasNotifs(notifs);
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    const rol = this.auth.getRol();
    if (rol === 'ROL-CLIENTE') {
      this.notifSvc.iniciarPolling();
    } else {
      this.cargarConteoAlertas();
    }
  }

  ngOnDestroy(): void {
    this.notifSvc.detenerPolling();
  }

  ngAfterViewChecked(): void {
    if (this.deberiaScroll) {
      this.scrollAbajo();
      this.deberiaScroll = false;
    }
  }

  toggleChat(): void {
    this.abierto.set(!this.abierto());
    if (this.abierto()) {
      this.mensajesNuevos.set(0);
      if (this.mensajes().length === 0) {
        this.agregarMensajeAgente(this.saludoInicial());
      }
    }
  }

  limpiarChat(): void {
    this.mensajes.set([]);
    this.politicaEnContexto.set('');
    this.pasoActual.set(-1);
    this.tramitesEnContexto.set([]);
    this.tramiteIdEnContexto.set('');
    this.agregarMensajeAgente(this.saludoInicial());
  }

  enviarSugerencia(texto: string): void {
    this.inputTexto = texto;
    this.enviar();
  }

  enviar(): void {
    const texto = this.inputTexto.trim();
    if (!texto || this.respondiendo()) return;

    this.inputTexto = '';
    this.agregarMensajeUsuario(texto);
    this.responder(texto);
  }

  // ── Voz ──────────────────────────────────────────────────────

  toggleVoz(): void {
    if (this.grabando()) {
      this.detenerGrabacion();
    } else {
      this.iniciarGrabacion();
    }
  }

  private iniciarGrabacion(): void {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Tu navegador no soporta grabación de audio.');
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.audioChunks = [];
      // Forzar audio/webm para Chrome (evita video/webm que Whisper no soporta bien)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      this.mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.audioChunks.push(e.data); };
      this.mediaRecorder.onstop = () => this.procesarAudio(stream);
      this.mediaRecorder.start();
      this.grabando.set(true);
    }).catch(() => {
      alert('No se pudo acceder al micrófono.');
    });
  }

  private detenerGrabacion(): void {
    this.mediaRecorder?.stop();
    this.grabando.set(false);
  }

  private procesarAudio(stream: MediaStream): void {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      this.http.post<{ texto: string }>('/ai/voz/transcribir', {
        audioBase64: base64,
        formato: 'webm',
      }).subscribe({
        next: (r) => {
          if (r.texto?.trim()) {
            this.inputTexto = r.texto;
            this.enviar();
          } else {
            this.agregarMensajeAgente('No escuché nada. Intentá hablar un poco más fuerte o por más tiempo, luego presioná el micrófono de nuevo.');
          }
        },
        error: () => {
          this.agregarMensajeAgente('No pude transcribir el audio. Escribí tu consulta.');
        }
      });
    };
    reader.readAsDataURL(blob);
  }

  // ── Lógica del agente ─────────────────────────────────────────

  private responder(texto: string): void {
    const rol = this.auth.getRol();
    this.respondiendo.set(true);

    const idx = this.mensajes().length;
    this.mensajes.update(m => [...m, {
      rol: 'agent', texto: '', timestamp: new Date(), escribiendo: true
    }]);
    this.deberiaScroll = true;

    const usuario = this.auth.getUsuario();
    const empresa = usuario?.empresa ?? '';
    const clienteId = (usuario as any)?.id ?? (usuario as any)?._id ?? '';

    if (rol === 'ROL-CLIENTE' || !rol) {
      // Construir historial multi-turn (últimos 4 mensajes reales, sin el typing indicator)
      const historial = this.mensajes()
        .slice(0, idx)
        .filter(m => !m.escribiendo && m.texto)
        .slice(-4)
        .map(m => ({ rol: m.rol, texto: m.texto }));

      this.http.post<any>('/ai/agente/clasificar', {
        descripcion: texto,
        empresa_id: empresa,
        cliente_id: clienteId,
        politica_contexto: this.politicaEnContexto(),
        historial,
        paso_actual: this.pasoActual(),
        tramite_lista_contexto: this.tramitesEnContexto(),
        tramite_id_contexto: this.tramiteIdEnContexto(),
      }).subscribe({
        next: (r) => {
          const metodo = r.metodo ?? '';
          const politicaNombre = r.politica_recomendada?.nombre ?? '';

          // Solo actualizar contexto en clasificaciones genuinas (evita envenenamiento)
          const _ctxMethods = ['ia_openai', 'keyword_matching', 'menciona_politica', 'quiere_iniciar'];
          const debeActualizar = _ctxMethods.includes(metodo) || metodo.startsWith('tramite_numero');
          if (debeActualizar && politicaNombre) {
            if (politicaNombre !== this.politicaEnContexto()) {
              this.pasoActual.set(-1);
            }
            this.politicaEnContexto.set(politicaNombre);
          }
          if (metodo === 'listado' || metodo === 'estado_tramite') {
            this.politicaEnContexto.set('');
            this.pasoActual.set(-1);
          }

          // Actualizar lista de trámites para selección conversacional
          if (metodo === 'estado_tramite' && r.tramites_contexto?.length) {
            this.tramitesEnContexto.set(r.tramites_contexto);
          } else if (metodo === 'tramite_seleccionado') {
            if (r.tramites_contexto?.length) {
              this.tramitesEnContexto.set(r.tramites_contexto);
            }
          } else if (metodo !== 'estado_tramite' && metodo !== 'ver_historial_tramite') {
            this.tramitesEnContexto.set([]);
          }

          // Actualizar tramite_id en contexto para "ver historial"
          if (r.tramite_id) {
            this.tramiteIdEnContexto.set(r.tramite_id);
          } else if (metodo !== 'tramite_seleccionado' && metodo !== 'tramite_mas_antiguo'
                     && metodo !== 'ver_historial_tramite') {
            this.tramiteIdEnContexto.set('');
          }

          // Actualizar paso secuencial
          if (r.metodo === 'primer_paso') {
            this.pasoActual.set(0);
          } else if (r.metodo === 'siguiente_paso' && r.paso_siguiente != null) {
            this.pasoActual.set(r.paso_siguiente);
          }

          // Tarjeta de recomendación solo en clasificación genuina,
          // no en seguimiento/menciona_politica/primer_paso/etc.
          const mostrarPolitica = metodo === 'ia_openai' || metodo === 'keyword_matching';

          this.mensajes.update(msgs => {
            const copia = [...msgs];
            copia[idx] = {
              rol: 'agent',
              texto: r.respuesta_agente,
              politica: mostrarPolitica ? (r.politica_recomendada ?? null) : null,
              candidatas: mostrarPolitica ? (r.politicas_candidatas ?? []) : [],
              timestamp: new Date(),
              puedeIniciar: r.puede_iniciar ?? false,
              politicaMongoId: r.politica_mongo_id ?? '',
              metodo,
              puedeVerTramite: !!r.tramite_id,
              tramiteId: r.tramite_id ?? '',
            };
            return copia;
          });
          this.respondiendo.set(false);
          this.deberiaScroll = true;
        },
        error: () => this.responderConError(idx),
      });
    } else {
      // Admin/Funcionario/Diseñador → asistente general
      this.http.post<any>('/ai/asistente/ayuda', {
        mensaje: texto,
        rolUsuario: rol?.replace('ROL-', '').toLowerCase() ?? 'usuario',
        contextoActual: 'chat-fab',
      }).subscribe({
        next: (r) => {
          this.mensajes.update(msgs => {
            const copia = [...msgs];
            copia[idx] = {
              rol: 'agent',
              texto: r.respuesta ?? r.message ?? 'Listo.',
              timestamp: new Date(),
            };
            return copia;
          });
          this.respondiendo.set(false);
          this.deberiaScroll = true;
        },
        error: () => this.responderConError(idx),
      });
    }
  }

  private responderConError(idx: number): void {
    this.mensajes.update(msgs => {
      const copia = [...msgs];
      copia[idx] = {
        rol: 'agent',
        texto: 'No pude conectarme al servidor. Verificá tu conexión e intentá de nuevo.',
        timestamp: new Date(),
      };
      return copia;
    });
    this.respondiendo.set(false);
    this.deberiaScroll = true;
  }

  private saludoInicial(): string {
    const rol = this.auth.getRol();
    const nombre = this.auth.getUsuario()?.nombre ?? '';
    if (rol === 'ROL-CLIENTE') {
      return `Hola${nombre ? ' ' + nombre : ''}! 👋 Soy NexusBot, tu asistente especializado en trámites.\n\nContame tu situación con tus propias palabras y te diré exactamente qué trámite necesitás, qué documentos debés llevar y cómo iniciarlo.`;
    }
    return `Hola${nombre ? ' ' + nombre : ''}! Soy NexusBot. ¿En qué te puedo ayudar hoy?`;
  }

  private agregarMensajeAgente(texto: string): void {
    this.mensajes.update(m => [...m, { rol: 'agent', texto, timestamp: new Date() }]);
    this.deberiaScroll = true;
  }

  private agregarMensajeUsuario(texto: string): void {
    this.mensajes.update(m => [...m, { rol: 'user', texto, timestamp: new Date() }]);
    this.deberiaScroll = true;
  }

  private scrollAbajo(): void {
    try {
      const el = this.mensajesDiv?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  verTramiteDesdeBot(msg: Mensaje): void {
    if (!msg.tramiteId) return;
    this.abierto.set(false);
    this.router.navigate(['/tramites', msg.tramiteId, 'detalle']);
  }

  iniciarDesdeBot(msg: Mensaje): void {
    if (!msg.politicaMongoId || msg.iniciando) return;
    msg.iniciando = true;
    this.tramiteSvc.iniciar(msg.politicaMongoId).subscribe({
      next: (creado: any) => {
        this.abierto.set(false);
        this.router.navigate(['/tramites', creado.id, 'ejecutar']);
      },
      error: () => {
        msg.iniciando = false;
        this.agregarMensajeAgente('No pude iniciar el trámite en este momento. Intentá desde el botón "Nueva Solicitud" en tu panel.');
      },
    });
  }

  private _inyectarNuevasNotifs(notifs: NotificacionDTO[]): void {
    if (this._primeraNotifRun) {
      notifs.forEach(n => this.notifIdsVistos.add(n.id));
      this._primeraNotifRun = false;
      return;
    }

    const nuevas = notifs.filter(n => !this.notifIdsVistos.has(n.id) && !n.leida);
    if (nuevas.length === 0) return;

    for (const n of nuevas) {
      this.notifIdsVistos.add(n.id);

      if (this.mensajes().length === 0) {
        this.mensajes.set([{ rol: 'agent', texto: this.saludoInicial(), timestamp: new Date() }]);
      }

      // Solicitudes de edición de documento → solo puntear a la campana, no mostrar contenido completo en chat
      if (n.tipo === 'EDICION_SOLICITADA') {
        this.mensajes.update(msgs => [...msgs, {
          rol: 'agent',
          texto: `🔔 Tienes una nueva notificación.\nRevisa la campana (🔔) en la esquina superior para ver el detalle y acceder al documento.`,
          timestamp: new Date(n.fechaCreacion ?? Date.now()),
          esNotificacion: true,
        }]);
      } else {
        const icono = this._iconoNotifChat(n);
        this.mensajes.update(msgs => [...msgs, {
          rol: 'agent',
          texto: `${icono} ${n.titulo ?? 'Notificación'}\n${n.mensaje ?? ''}`,
          timestamp: new Date(n.fechaCreacion ?? Date.now()),
          esNotificacion: true,
        }]);
      }

      if (!this.abierto()) {
        this.mensajesNuevos.update(c => c + 1);
      }
    }

    this.deberiaScroll = true;
  }

  private _iconoNotifChat(n: NotificacionDTO): string {
    const tipo = (n.tipo ?? '').toLowerCase();
    if (tipo.includes('iniciado') || tipo.includes('inicio')) return '🚀';
    if (tipo.includes('finalizado') || tipo.includes('completado')) return '🎉';
    if (tipo.includes('nodo') || tipo.includes('avanzado')) return '📋';
    if (tipo.includes('verificado') || tipo.includes('aprobado')) return '✅';
    if (tipo.includes('rechazado')) return '❌';
    if (tipo.includes('observado')) return '⚠️';
    return '🔔';
  }

  private cargarConteoAlertas(): void {
    const usuario = this.auth.getUsuario();
    const empresaId = (usuario as any)?.empresa_id ?? (usuario as any)?.empresa ?? '';
    if (!empresaId) return;
    this.iaSvc.getAlertas(empresaId).subscribe({
      next: (alertas) => this.alertCount.set(alertas?.length ?? 0),
      error: () => this.alertCount.set(0),
    });
  }
}
