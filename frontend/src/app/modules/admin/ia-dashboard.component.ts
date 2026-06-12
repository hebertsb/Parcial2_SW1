import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface TfEstado {
  tensorflow_disponible: boolean;
  tensorflow_version: string | null;
  modelos: { lstm_route: boolean; dense_risk: boolean; autoencoder_anomaly: boolean };
  ultimo_entrenamiento: string | null;
  total_registros_entrenamiento: number;
  metricas: { lstm_accuracy: number | null; anomaly_threshold: number | null };
}

interface EntrenarResult {
  estado: string;
  total_registros: number;
  metricas: Record<string, number>;
  timestamp: string;
}

interface RutaResult {
  siguiente_accion: string;
  confianza: number;
  distribucion: Record<string, number>;
  error?: string;
}

interface RiesgoResult {
  probabilidad_demora: number;
  nivel_riesgo: string;
  recomendacion: string;
  error?: string;
}

interface AnomaliaResult {
  es_anomalia: boolean;
  score_anomalia: number;
  umbral: number;
  nivel: string;
  descripcion: string;
  error?: string;
}

interface ModoIAEstado {
  modo_ia: 'local' | 'api';
  is_api_mode: boolean;
  openai_api_key_configurada: boolean;
  modelo: string;
  motores: Record<string, string>;
}

@Component({
  selector: 'app-ia-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <div class="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto w-full">

    <!-- HEADER -->
    <div class="flex flex-wrap justify-between items-end gap-4">
      <div>
        <h2 class="text-2xl sm:text-4xl font-bold leading-none tracking-tight text-slate-800 dark:text-white mb-1">
          Motor de Deep Learning
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">
          TensorFlow 2.x — 3 modelos entrenados sobre la Bitácora de trámites
        </p>
      </div>
      <button (click)="entrenar()" [disabled]="entrenando()"
        class="bg-violet-600 text-white font-semibold text-sm py-2.5 px-5 rounded-xl shadow hover:bg-violet-700 transition-colors flex items-center gap-2 disabled:opacity-60">
        <span class="material-symbols-outlined text-sm" [class.animate-spin]="entrenando()">model_training</span>
        {{ entrenando() ? 'Entrenando...' : 'Entrenar Modelos' }}
      </button>
    </div>

    <!-- MOTOR DE IA CONVERSACIONAL (LLM) — SWITCH EN CALIENTE -->
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-1">Motor de IA conversacional (LLM)</p>
          <p class="text-xs text-slate-400 dark:text-slate-500 max-w-md">
            Alterna en caliente, sin reiniciar el servicio. Afecta: agente clasificador, reportes, diagramador, asistente, analítica y voz.
          </p>
        </div>
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-full p-1">
          <button (click)="cambiarModoIA('local')" [disabled]="cambiandoModo()"
            class="px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60"
            [class]="modoIA()?.modo_ia === 'local' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 dark:text-slate-300'">
            Local (sin internet)
          </button>
          <button (click)="cambiarModoIA('api')" [disabled]="cambiandoModo()"
            class="px-4 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60"
            [class]="modoIA()?.modo_ia === 'api' ? 'bg-violet-600 text-white shadow' : 'text-slate-500 dark:text-slate-300'">
            API (Groq/OpenAI)
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full" [class]="modoIA()?.is_api_mode ? 'bg-violet-500' : 'bg-emerald-500'"></span>
        <span class="text-sm font-semibold text-slate-700 dark:text-white">
          @if (modoIA()?.is_api_mode) {
            Conectado a {{ modoIA()?.modelo }}
          } @else {
            Funcionando 100% local — sin llamadas a APIs externas
          }
        </span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        @for (m of motorEntries(); track m.key) {
          <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2">
            <span class="text-xs text-slate-500 dark:text-slate-400">{{ m.label }}</span>
            <span class="text-xs font-bold" [class]="m.local ? 'text-emerald-600' : 'text-violet-600'">{{ m.value }}</span>
          </div>
        }
      </div>
    </div>

    <!-- ESTADO GENERAL -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">TensorFlow</p>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" [class]="estado()?.tensorflow_disponible ? 'bg-emerald-500' : 'bg-red-500'"></span>
          <span class="text-sm font-semibold text-slate-700 dark:text-white">
            {{ estado()?.tensorflow_version ?? 'No disponible' }}
          </span>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Modelos</p>
        <div class="flex gap-2">
          <span class="text-xs px-2 py-1 rounded-full font-semibold"
            [class]="estado()?.modelos?.lstm_route ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
            LSTM
          </span>
          <span class="text-xs px-2 py-1 rounded-full font-semibold"
            [class]="estado()?.modelos?.dense_risk ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
            Dense
          </span>
          <span class="text-xs px-2 py-1 rounded-full font-semibold"
            [class]="estado()?.modelos?.autoencoder_anomaly ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'">
            AE
          </span>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Registros entrenados</p>
        <p class="text-2xl font-bold text-slate-800 dark:text-white tabular-nums">
          {{ estado()?.total_registros_entrenamiento ?? 0 }}
        </p>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5">
        <p class="text-[11px] uppercase tracking-wider text-slate-500 font-bold mb-2">Accuracy LSTM</p>
        <p class="text-2xl font-bold text-violet-600 tabular-nums">
          {{ estado()?.metricas?.lstm_accuracy != null ? ((estado()!.metricas.lstm_accuracy! * 100) | number:'1.1-1') + '%' : '—' }}
        </p>
      </div>
    </div>

    <!-- RESULTADO ENTRENAMIENTO -->
    @if (resultadoEntrenamiento()) {
      <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
        <p class="font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-sm">check_circle</span>
          Entrenamiento completado — {{ resultadoEntrenamiento()!.total_registros }} registros de Bitácora
        </p>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          @for (entry of metricaEntries(); track entry.key) {
            <div class="bg-white dark:bg-slate-800 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800">
              <p class="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-1">{{ entry.label }}</p>
              <p class="text-lg font-bold tabular-nums" [class]="entry.color">
                {{ entry.display }}
              </p>
            </div>
          }
        </div>
      </div>
    }

    <!-- 3 PANELES DE PREDICCIÓN -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- MODELO 1: LSTM PREDICTOR DE RUTA -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full" [class]="estado()?.modelos?.lstm_route ? 'bg-emerald-500' : 'bg-slate-300'"></span>
            <h3 class="font-bold text-slate-800 dark:text-white text-sm">Modelo 1 — LSTM</h3>
          </div>
          <p class="text-xs text-slate-500">Predictor de ruta: dada una secuencia de acciones, predice cuál es la siguiente acción más probable en el flujo del trámite.</p>
        </div>

        <div class="flex flex-col gap-2">
          <p class="text-xs font-semibold text-slate-600 dark:text-slate-300">Historial de acciones (seleccioná):</p>
          <div class="flex flex-wrap gap-1.5">
            @for (accion of accionesDisponibles; track accion) {
              <button (click)="toggleAccion(accion)"
                class="text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors"
                [class]="secuenciaSeleccionada().includes(accion)
                  ? 'bg-violet-600 text-white border-violet-600'
                  : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-violet-400'">
                {{ accion }}
              </button>
            }
          </div>
          <p class="text-[10px] text-slate-400">Seleccionado: {{ secuenciaSeleccionada().join(' → ') || '(ninguno)' }}</p>
        </div>

        <button (click)="predecirRuta()" [disabled]="prediciendoRuta() || secuenciaSeleccionada().length === 0"
          class="bg-violet-600 text-white text-xs font-semibold py-2 px-4 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50">
          {{ prediciendoRuta() ? 'Prediciendo...' : 'Predecir siguiente acción' }}
        </button>

        @if (resultadoRuta()) {
          @if (resultadoRuta()!.error) {
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs text-red-600">{{ resultadoRuta()!.error }}</div>
          } @else {
            <div class="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 border border-violet-100 dark:border-violet-800">
              <p class="text-[10px] text-violet-500 uppercase font-bold mb-1">Siguiente acción predicha</p>
              <p class="text-xl font-bold text-violet-700 dark:text-violet-300">{{ resultadoRuta()!.siguiente_accion }}</p>
              <p class="text-xs text-slate-500 mt-1">Confianza: <span class="font-semibold text-violet-600">{{ (resultadoRuta()!.confianza * 100) | number:'1.1-1' }}%</span></p>
              <div class="mt-3 flex flex-col gap-1">
                @for (entry of distribucionEntries(); track entry.key) {
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] w-28 text-slate-500 truncate">{{ entry.key }}</span>
                    <div class="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5">
                      <div class="h-1.5 rounded-full transition-all"
                        [class]="entry.key === resultadoRuta()!.siguiente_accion ? 'bg-violet-500' : 'bg-slate-300'"
                        [style.width.%]="entry.value * 100"></div>
                    </div>
                    <span class="text-[10px] text-slate-400 tabular-nums w-8">{{ (entry.value * 100) | number:'1.0-0' }}%</span>
                  </div>
                }
              </div>
            </div>
          }
        }
      </div>

      <!-- MODELO 2: DENSE RIESGO DE DEMORA -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full" [class]="estado()?.modelos?.dense_risk ? 'bg-emerald-500' : 'bg-slate-300'"></span>
            <h3 class="font-bold text-slate-800 dark:text-white text-sm">Modelo 2 — Red Densa</h3>
          </div>
          <p class="text-xs text-slate-500">Predictor de riesgo: analiza features del trámite actual y predice la probabilidad de demora o cuello de botella.</p>
        </div>

        <div class="flex flex-col gap-3">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] text-slate-500 font-semibold uppercase">Horas en nodo</label>
              <input type="number" [(ngModel)]="riesgoForm.tiempo_en_nodo" min="0"
                class="w-full mt-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            </div>
            <div>
              <label class="text-[10px] text-slate-500 font-semibold uppercase">N° documentos</label>
              <input type="number" [(ngModel)]="riesgoForm.numero_documentos" min="0"
                class="w-full mt-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            </div>
            <div>
              <label class="text-[10px] text-slate-500 font-semibold uppercase">Hora del día</label>
              <input type="number" [(ngModel)]="riesgoForm.hora_dia" min="0" max="23"
                class="w-full mt-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            </div>
            <div>
              <label class="text-[10px] text-slate-500 font-semibold uppercase">Día semana (0=Lun)</label>
              <input type="number" [(ngModel)]="riesgoForm.dia_semana" min="0" max="6"
                class="w-full mt-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            </div>
          </div>
          <div>
            <label class="text-[10px] text-slate-500 font-semibold uppercase">Última acción</label>
            <select [(ngModel)]="riesgoForm.ultima_accion"
              class="w-full mt-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              @for (accion of accionesDisponibles; track accion) {
                <option [value]="accion">{{ accion }}</option>
              }
            </select>
          </div>
        </div>

        <button (click)="predecirRiesgo()" [disabled]="prediciendoRiesgo()"
          class="bg-orange-500 text-white text-xs font-semibold py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50">
          {{ prediciendoRiesgo() ? 'Calculando...' : 'Calcular riesgo de demora' }}
        </button>

        @if (resultadoRiesgo()) {
          @if (resultadoRiesgo()!.error) {
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs text-red-600">{{ resultadoRiesgo()!.error }}</div>
          } @else {
            <div class="rounded-xl p-4 border"
              [class]="nivelRiesgoClass(resultadoRiesgo()!.nivel_riesgo)">
              <p class="text-[10px] uppercase font-bold mb-1 opacity-70">Nivel de riesgo</p>
              <p class="text-2xl font-bold">{{ resultadoRiesgo()!.nivel_riesgo }}</p>
              <div class="mt-2 bg-white/50 dark:bg-black/20 rounded-full h-3 overflow-hidden">
                <div class="h-3 rounded-full transition-all duration-700"
                  [class]="resultadoRiesgo()!.probabilidad_demora > 0.75 ? 'bg-red-500' : resultadoRiesgo()!.probabilidad_demora > 0.5 ? 'bg-orange-500' : resultadoRiesgo()!.probabilidad_demora > 0.25 ? 'bg-yellow-400' : 'bg-emerald-500'"
                  [style.width.%]="resultadoRiesgo()!.probabilidad_demora * 100"></div>
              </div>
              <p class="text-xs mt-1 opacity-80">{{ (resultadoRiesgo()!.probabilidad_demora * 100) | number:'1.1-1' }}% probabilidad de demora</p>
              <p class="text-xs mt-2 italic opacity-70">{{ resultadoRiesgo()!.recomendacion }}</p>
            </div>
          }
        }
      </div>

      <!-- MODELO 3: AUTOENCODER ANOMALÍA -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 flex flex-col gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full" [class]="estado()?.modelos?.autoencoder_anomaly ? 'bg-emerald-500' : 'bg-slate-300'"></span>
            <h3 class="font-bold text-slate-800 dark:text-white text-sm">Modelo 3 — Autoencoder</h3>
          </div>
          <p class="text-xs text-slate-500">Detector de anomalías: compara el patrón del trámite contra lo aprendido. Si el error de reconstrucción supera el umbral, es anómalo.</p>
        </div>

        <div class="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 flex flex-col gap-2">
          <p class="text-[10px] text-slate-500 font-semibold uppercase">Escenario de prueba rápida</p>
          <div class="flex gap-2 flex-wrap">
            <button (click)="setEscenario('normal')"
              class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
              [class]="escenarioActivo() === 'normal' ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'">
              Trámite normal
            </button>
            <button (click)="setEscenario('anomalo')"
              class="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
              [class]="escenarioActivo() === 'anomalo' ? 'bg-red-500 text-white border-red-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'">
              Trámite anómalo
            </button>
          </div>
          <div class="text-[10px] text-slate-400 space-y-0.5">
            <p>Tiempo en nodo: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ anomaliaForm.tiempo_en_nodo }}h</span></p>
            <p>Documentos: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ anomaliaForm.numero_documentos }}</span></p>
            <p>Hora: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ anomaliaForm.hora_dia }}:00</span> | Día: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ anomaliaForm.dia_semana === 5 || anomaliaForm.dia_semana === 6 ? 'Fin de semana' : 'Laboral' }}</span></p>
            <p>Última acción: <span class="font-semibold text-slate-600 dark:text-slate-300">{{ anomaliaForm.ultima_accion }}</span></p>
          </div>
        </div>

        <button (click)="detectarAnomalia()" [disabled]="detectandoAnomalia()"
          class="bg-red-500 text-white text-xs font-semibold py-2 px-4 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
          {{ detectandoAnomalia() ? 'Analizando...' : 'Detectar anomalía' }}
        </button>

        @if (resultadoAnomalia()) {
          @if (resultadoAnomalia()!.error) {
            <div class="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-xs text-red-600">{{ resultadoAnomalia()!.error }}</div>
          } @else {
            <div class="rounded-xl p-4 border"
              [class]="resultadoAnomalia()!.es_anomalia ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'">
              <div class="flex items-center gap-2 mb-2">
                <span class="material-symbols-outlined text-xl">{{ resultadoAnomalia()!.es_anomalia ? 'warning' : 'check_circle' }}</span>
                <p class="text-lg font-bold">{{ resultadoAnomalia()!.nivel }}</p>
              </div>
              <div class="space-y-1 text-xs opacity-80">
                <p>Score de error: <span class="font-bold tabular-nums">{{ resultadoAnomalia()!.score_anomalia | number:'1.4-4' }}</span></p>
                <p>Umbral aprendido: <span class="font-bold tabular-nums">{{ resultadoAnomalia()!.umbral | number:'1.4-4' }}</span></p>
              </div>
              <div class="mt-2 bg-white/50 dark:bg-black/20 rounded-full h-2 overflow-hidden">
                <div class="h-2 rounded-full"
                  [class]="resultadoAnomalia()!.es_anomalia ? 'bg-red-500 w-full' : 'bg-emerald-500'"
                  [style.width.%]="Math.min((resultadoAnomalia()!.score_anomalia / resultadoAnomalia()!.umbral) * 50, 100)"></div>
              </div>
              <p class="text-[10px] mt-2 opacity-70 leading-relaxed">{{ resultadoAnomalia()!.descripcion }}</p>
            </div>
          }
        }
      </div>
    </div>

    <!-- EXPLICACIÓN TÉCNICA -->
    <div class="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
      <h3 class="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-violet-600 text-sm">science</span>
        Arquitectura de los modelos
      </h3>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-400">
        <div class="space-y-1">
          <p class="font-semibold text-violet-600 dark:text-violet-400">LSTM Route Predictor</p>
          <p>Entrada: secuencia de 5 acciones codificadas</p>
          <p>Arquitectura: LSTM(64) → Dropout(0.2) → Dense(32) → Softmax(7)</p>
          <p>Entrenado con: secuencias reales de la Bitácora de MongoDB</p>
          <p>Salida: distribución de probabilidad sobre las 7 acciones posibles</p>
        </div>
        <div class="space-y-1">
          <p class="font-semibold text-orange-500 dark:text-orange-400">Dense Delay Risk</p>
          <p>Entrada: 6 features (tiempo, campos, docs, hora, día, acción)</p>
          <p>Arquitectura: Dense(64)→Dropout→Dense(32)→Dropout→Dense(16)→Sigmoid</p>
          <p>Entrenado con: datos reales + datos sintéticos correlacionados (n=395)</p>
          <p>Salida: probabilidad 0-1 de demora + nivel BAJO/MEDIO/ALTO/CRÍTICO</p>
        </div>
        <div class="space-y-1">
          <p class="font-semibold text-red-500 dark:text-red-400">Autoencoder Anomaly</p>
          <p>Entrada: 6 features normalizadas min-max</p>
          <p>Arquitectura: Encoder(8→4) + Decoder(4→8→6)</p>
          <p>Umbral: media + 2σ del error de reconstrucción en entrenamiento</p>
          <p>Salida: score de error vs umbral → NORMAL / ANÓMALO</p>
        </div>
      </div>
    </div>

  </div>
  `,
})
export class IaDashboardComponent implements OnInit {
  private http = inject(HttpClient);

  readonly Math = Math;

  estado = signal<TfEstado | null>(null);
  entrenando = signal(false);
  resultadoEntrenamiento = signal<EntrenarResult | null>(null);

  prediciendoRuta = signal(false);
  resultadoRuta = signal<RutaResult | null>(null);
  secuenciaSeleccionada = signal<string[]>([]);

  prediciendoRiesgo = signal(false);
  resultadoRiesgo = signal<RiesgoResult | null>(null);

  detectandoAnomalia = signal(false);
  resultadoAnomalia = signal<AnomaliaResult | null>(null);
  escenarioActivo = signal<'normal' | 'anomalo' | null>(null);

  modoIA = signal<ModoIAEstado | null>(null);
  cambiandoModo = signal(false);

  private readonly MOTOR_LABELS: Record<string, string> = {
    agente_clasificador: 'Chatbot / Agente',
    reportes_interpretacion: 'Reportes (NL)',
    diagramador: 'Diagramador IA',
    asistente: 'Asistente',
    analytics_recomendaciones: 'Analítica',
    voz_transcripcion: 'Voz a texto',
  };

  readonly accionesDisponibles = [
    'INICIO_PROCESO', 'LLENADO_FORMULARIO', 'APROBAR',
    'OBSERVAR', 'RECHAZAR', 'ESCALAR', 'COMPLETAR'
  ];

  riesgoForm = {
    tiempo_en_nodo: 72,
    campos_configurados: 2,
    numero_documentos: 0,
    hora_dia: 22,
    dia_semana: 6,
    ultima_accion: 'OBSERVAR'
  };

  anomaliaForm = {
    tiempo_en_nodo: 12,
    campos_configurados: 5,
    numero_documentos: 3,
    hora_dia: 10,
    dia_semana: 1,
    ultima_accion: 'APROBAR'
  };

  ngOnInit(): void {
    this.cargarEstado();
    this.cargarModoIA();
  }

  cargarEstado(): void {
    this.http.get<TfEstado>('/ai/tf/estado').subscribe({
      next: (r) => this.estado.set(r),
      error: () => {}
    });
  }

  cargarModoIA(): void {
    this.http.get<ModoIAEstado>('/ai/sistema/modo-ia').subscribe({
      next: (r) => this.modoIA.set(r),
      error: () => {}
    });
  }

  cambiarModoIA(modo: 'local' | 'api'): void {
    if (this.modoIA()?.modo_ia === modo || this.cambiandoModo()) return;
    this.cambiandoModo.set(true);
    this.http.post<ModoIAEstado>('/ai/sistema/modo-ia', { modo }).subscribe({
      next: (r) => { this.modoIA.set(r); this.cambiandoModo.set(false); },
      error: () => this.cambiandoModo.set(false)
    });
  }

  motorEntries(): { key: string; label: string; value: string; local: boolean }[] {
    const m = this.modoIA()?.motores;
    if (!m) return [];
    return Object.entries(m).map(([key, value]) => ({
      key,
      label: this.MOTOR_LABELS[key] ?? key,
      value: value === 'keyword_matching' || value === 'simulacion_local' ? 'Local' : 'IA (API)',
      local: value === 'keyword_matching' || value === 'simulacion_local',
    }));
  }

  entrenar(): void {
    this.entrenando.set(true);
    this.resultadoEntrenamiento.set(null);
    this.http.post<EntrenarResult>('/ai/tf/entrenar', { forzar: true }).subscribe({
      next: (r) => {
        this.resultadoEntrenamiento.set(r);
        this.entrenando.set(false);
        this.cargarEstado();
      },
      error: () => this.entrenando.set(false)
    });
  }

  private readonly METRICA_LABELS: Record<string, { label: string; color: string; pct: boolean }> = {
    lstm_accuracy:      { label: 'Precisión LSTM (entrenamiento)', color: 'text-violet-600', pct: true },
    lstm_val_accuracy:  { label: 'Precisión LSTM (validación)',    color: 'text-violet-400', pct: true },
    lstm_secuencias:    { label: 'Secuencias LSTM usadas',         color: 'text-slate-800 dark:text-white', pct: false },
    risk_accuracy:      { label: 'Precisión Modelo Riesgo',        color: 'text-orange-500', pct: true },
    risk_val_accuracy:  { label: 'Precisión Riesgo (validación)',  color: 'text-orange-400', pct: true },
    risk_registros:     { label: 'Muestras entrenamiento riesgo',  color: 'text-slate-800 dark:text-white', pct: false },
    ae_val_loss:        { label: 'Error reconstrucción (val.)',    color: 'text-red-500', pct: false },
    ae_umbral:          { label: 'Umbral anomalía aprendido',      color: 'text-red-400', pct: false },
    ae_registros:       { label: 'Registros autoencoder',         color: 'text-slate-800 dark:text-white', pct: false },
  };

  metricaEntries(): { key: string; label: string; display: string; color: string }[] {
    const m = this.resultadoEntrenamiento()?.metricas;
    if (!m) return [];
    return Object.entries(m).map(([key, value]) => {
      const meta = this.METRICA_LABELS[key];
      const v = value as number;
      const display = meta?.pct
        ? (v * 100).toFixed(1) + '%'
        : Number.isInteger(v) ? v.toString() : v.toFixed(4);
      return { key, label: meta?.label ?? key, display, color: meta?.color ?? 'text-slate-800 dark:text-white' };
    });
  }

  toggleAccion(accion: string): void {
    const actual = this.secuenciaSeleccionada();
    if (actual.includes(accion)) {
      this.secuenciaSeleccionada.set(actual.filter(a => a !== accion));
    } else {
      this.secuenciaSeleccionada.set([...actual, accion]);
    }
  }

  predecirRuta(): void {
    this.prediciendoRuta.set(true);
    this.http.post<RutaResult>('/ai/tf/predecir-ruta', {
      secuencia_acciones: this.secuenciaSeleccionada()
    }).subscribe({
      next: (r) => { this.resultadoRuta.set(r); this.prediciendoRuta.set(false); },
      error: () => this.prediciendoRuta.set(false)
    });
  }

  distribucionEntries(): { key: string; value: number }[] {
    const d = this.resultadoRuta()?.distribucion;
    if (!d) return [];
    return Object.entries(d)
      .map(([key, value]) => ({ key, value: value as number }))
      .sort((a, b) => b.value - a.value);
  }

  predecirRiesgo(): void {
    this.prediciendoRiesgo.set(true);
    this.http.post<RiesgoResult>('/ai/tf/riesgo-demora', this.riesgoForm).subscribe({
      next: (r) => { this.resultadoRiesgo.set(r); this.prediciendoRiesgo.set(false); },
      error: () => this.prediciendoRiesgo.set(false)
    });
  }

  nivelRiesgoClass(nivel: string): string {
    const map: Record<string, string> = {
      'CRÍTICO': 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
      'ALTO': 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-200',
      'MEDIO': 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
      'BAJO': 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    };
    return map[nivel] ?? map['BAJO'];
  }

  setEscenario(tipo: 'normal' | 'anomalo'): void {
    this.escenarioActivo.set(tipo);
    if (tipo === 'normal') {
      this.anomaliaForm = { tiempo_en_nodo: 8, campos_configurados: 6, numero_documentos: 3, hora_dia: 10, dia_semana: 2, ultima_accion: 'APROBAR' };
    } else {
      this.anomaliaForm = { tiempo_en_nodo: 150, campos_configurados: 0, numero_documentos: 0, hora_dia: 23, dia_semana: 6, ultima_accion: 'RECHAZAR' };
    }
    this.resultadoAnomalia.set(null);
  }

  detectarAnomalia(): void {
    this.detectandoAnomalia.set(true);
    this.http.post<AnomaliaResult>('/ai/tf/detectar-anomalia', this.anomaliaForm).subscribe({
      next: (r) => { this.resultadoAnomalia.set(r); this.detectandoAnomalia.set(false); },
      error: () => this.detectandoAnomalia.set(false)
    });
  }
}
