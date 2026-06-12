import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TramiteService } from '../../core/services/tramite.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { TramiteTiempoSimuladorService } from '../../core/services/tramite-tiempo-simulador.service';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { EditorColaborativoComponent } from './editor-colaborativo.component';

@Component({
  selector: 'app-detalle-tramite',
  standalone: true,
  imports: [CommonModule, RouterModule, EditorColaborativoComponent],
  template: `
    <div class="flex flex-col gap-6 max-w-4xl mx-auto">

      @if (horasSimuladas() > 0) {
        <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">Simulación activa</p>
            <p class="text-sm text-amber-800">El reloj visual está adelantado +{{ horasSimuladas() }} h para probar la semaforización.</p>
          </div>
          <button type="button" (click)="resetSimulacion()" class="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors">Restablecer</button>
        </div>
      }

      <!-- Header -->
      <div class="flex items-center gap-4">
        <a routerLink="/client/dashboard"
          class="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
          <span class="material-symbols-outlined text-[20px]">arrow_back</span>
        </a>
        <div class="flex-1">
          <h1 class="font-headline text-2xl font-bold text-slate-800">
            {{ tramite()?.nombre_tramite || 'Detalle del Trámite' }}
          </h1>
          <p class="text-xs text-slate-400 font-mono mt-0.5">{{ tramite()?.id }}</p>
        </div>
        @if (tramite()) {
          <span class="text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider"
            [class.bg-blue-100]="tramite().estado === 'en_proceso' || tramite().estado === 'en_progreso'"
            [class.text-blue-700]="tramite().estado === 'en_proceso' || tramite().estado === 'en_progreso'"
            [class.bg-emerald-100]="tramite().estado === 'finalizado'"
            [class.text-emerald-700]="tramite().estado === 'finalizado'"
            [class.bg-amber-100]="tramite().estado === 'observado'"
            [class.text-amber-700]="tramite().estado === 'observado'"
            [class.bg-red-100]="tramite().estado === 'rechazado'"
            [class.text-red-700]="tramite().estado === 'rechazado'"
            [class.bg-slate-100]="tramite().estado === 'pendiente'"
            [class.text-slate-600]="tramite().estado === 'pendiente'"
            [class.bg-violet-100]="tramite().estado === 'en_revision'"
            [class.text-violet-700]="tramite().estado === 'en_revision'">
            {{ tramite().estado === 'en_revision' ? 'En Revisión' : tramite().estado }}
          </span>
        }
      </div>

      <!-- Cargando -->
      @if (cargando()) {
        <div class="flex justify-center py-16">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }

      @if (!cargando() && tramite()) {

        <!-- Info General -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wider">Información General</h2>
          </div>
          <div class="p-4 sm:p-6 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Trámite</p>
              <p class="font-semibold text-slate-800 text-sm">{{ tramite().nombre_tramite || '—' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Fecha inicio</p>
              <p class="font-semibold text-slate-800 text-sm">{{ formatFecha(tramite().fecha_inicio) }}</p>
            </div>
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Último cambio</p>
              <p class="font-semibold text-slate-800 text-sm">{{ formatFecha(tramite().fecha_ultima_actualizacion) }}</p>
            </div>
            @if (tramite().fecha_fin) {
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Fecha finalización</p>
                <p class="font-semibold text-emerald-600 text-sm">{{ formatFecha(tramite().fecha_fin) }}</p>
              </div>
            }
            @if (tramite().semaforizacion) {
              <div>
                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Semáforo</p>
                <div class="flex items-center gap-2">
                  <div class="w-2.5 h-2.5 rounded-full"
                    [class.bg-emerald-500]="semaforoVisual(tramite()) === 'Verde'"
                    [class.bg-amber-400]="semaforoVisual(tramite()) === 'Amarillo'"
                    [class.bg-red-500]="semaforoVisual(tramite()) === 'Rojo'">
                  </div>
                  <p class="font-semibold text-slate-800 text-sm">{{ semaforoVisual(tramite()) || tramite().semaforizacion }}</p>
                </div>
                <p class="text-xs text-slate-500 mt-2">Fecha límite: {{ formatFecha(tramite().fecha_limite) }}</p>
                <p class="text-xs text-slate-500">Tiempo restante: {{ tiempoRestanteTexto(tramite().fecha_limite) }}</p>
              </div>
            }
          </div>
        </div>

        <!-- Timeline / Historial -->
        @if (tramite().historial?.length > 0) {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wider">Historial de Pasos</h2>
            </div>
            <div class="p-6">
              <div class="space-y-0">
                @for (h of tramite().historial; track $index; let last = $last; let i = $index) {
                  <div class="flex gap-4">
                    <!-- Indicador -->
                    <div class="flex flex-col items-center">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                        [class.bg-emerald-500]="!last || tramite().estado === 'finalizado'"
                        [class.bg-blue-500]="last && tramite().estado !== 'finalizado'">
                        @if (!last || tramite().estado === 'finalizado') {
                          <span class="material-symbols-outlined text-white text-[16px]">check</span>
                        } @else {
                          <span class="text-white text-xs font-bold">{{ i + 1 }}</span>
                        }
                      </div>
                      @if (!last) {
                        <div class="w-0.5 flex-1 bg-slate-200 my-1 min-h-[24px]"></div>
                      }
                    </div>

                    <!-- Contenido del paso -->
                    <div class="pb-6 flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p class="font-bold text-slate-800 text-sm">
                            {{ h.nodoNombre || ('Paso ' + (i + 1)) }}
                          </p>
                          <p class="text-xs text-slate-400 mt-0.5">
                            <span class="material-symbols-outlined text-[12px] align-middle mr-1">schedule</span>
                            {{ formatFecha(h.completadoEn) }}
                          </p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 shrink-0">
                          Completado
                        </span>
                      </div>

                      <!-- Respuestas del paso -->
                      @if (entradasVisibles(h.nodoId).length > 0) {
                        <div class="bg-slate-50 rounded-xl border border-slate-100 p-4">
                          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Datos ingresados</p>
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            @for (entrada of entradasVisibles(h.nodoId); track entrada[0]) {
                              <div class="bg-white rounded-lg border border-slate-100 p-3"
                                   [class.md:col-span-2]="esGrid(entrada[1])">
                                <p class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                                  {{ labelCampo(h.nodoId, entrada[0]) }}
                                </p>
                                @if (esFirma(entrada[1])) {
                                  <div class="mt-1">
                                    <img [src]="entrada[1]" alt="Firma" class="max-h-16 border border-slate-200 rounded bg-white">
                                    <p class="text-[10px] text-emerald-600 font-medium mt-1">✓ Firmado digitalmente</p>
                                  </div>
                                } @else if (esArchivo(entrada[1])) {
                                  <div class="flex items-center gap-2 mt-1">
                                    <span class="text-base">{{ iconoArchivo(entrada[1]) }}</span>
                                    <p class="text-xs text-blue-600 font-medium truncate">{{ nombreArchivo(entrada[1]) }}</p>
                                  </div>
                                } @else if (esGrid(entrada[1])) {
                                  <div class="overflow-x-auto rounded-lg border border-slate-200 mt-1">
                                    <table class="w-full text-xs border-collapse">
                                      <thead class="bg-slate-50">
                                        <tr>
                                          <th class="px-3 py-2 border border-slate-200 text-left font-semibold text-slate-500 uppercase text-[10px]">
                                            {{ gridMeta(h.nodoId, entrada[0])?.col0Header || 'Concepto' }}
                                          </th>
                                          @for (colId of gridCols(entrada[1]); track colId) {
                                            <th class="px-3 py-2 border border-slate-200 text-left font-semibold text-slate-500 uppercase text-[10px]">
                                              {{ gridMeta(h.nodoId, entrada[0])?.columnas?.[colId] || colId }}
                                            </th>
                                          }
                                        </tr>
                                      </thead>
                                      <tbody>
                                        @for (filaId of gridFilas(entrada[1]); track filaId) {
                                          <tr>
                                            <td class="px-3 py-2 border border-slate-200 font-medium text-slate-700 bg-slate-50">
                                              {{ gridMeta(h.nodoId, entrada[0])?.filas?.[filaId] || filaId }}
                                            </td>
                                            @for (colId of gridCols(entrada[1]); track colId) {
                                              <td class="px-3 py-2 border border-slate-200 text-slate-600">
                                                {{ gridCellValue(entrada[1], filaId, colId) }}
                                              </td>
                                            }
                                          </tr>
                                        }
                                      </tbody>
                                    </table>
                                  </div>
                                } @else {
                                  <p class="text-sm font-semibold text-slate-800 break-words">
                                    {{ formatValor(entrada[1]) }}
                                  </p>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      } @else if (last && tramite().estado === 'finalizado') {
                        <div class="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center gap-2">
                          <span class="material-symbols-outlined text-emerald-500 text-[18px]">verified</span>
                          <p class="text-sm text-emerald-700 font-medium">Trámite finalizado exitosamente</p>
                        </div>
                      } @else {
                        <div class="bg-slate-50 border border-dashed border-slate-200 rounded-xl px-4 py-3">
                          <p class="text-xs text-slate-500">Este paso no requería ingresar datos.</p>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- Acción si en proceso -->
        @if (tramite().estado === 'en_proceso') {
          <div class="flex justify-end gap-3">
            <a [routerLink]="['/tramites', tramite().id, 'ejecutar']"
              class="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors inline-flex items-center justify-center gap-2 shadow-sm">
              <span class="material-symbols-outlined text-[18px]">play_arrow</span>
              Continuar trámite
            </a>
          </div>
        }

        <!-- En Revisión: banner informativo para el cliente -->
        @if (tramite().estado === 'en_revision') {
          <div class="bg-violet-50 border border-violet-200 rounded-2xl p-5">
            <div class="flex items-start gap-4">
              <div class="w-11 h-11 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm shrink-0">
                <span class="material-symbols-outlined text-white text-[22px]">hourglass_empty</span>
              </div>
              <div class="flex-1">
                <p class="font-bold text-violet-900 text-sm uppercase tracking-wide mb-1">Trámite en Revisión</p>
                <p class="text-sm text-violet-800 leading-relaxed">
                  Su trámite ha sido enviado al encargado del departamento.
                  El certificado final estará disponible una vez sea firmado por la autoridad correspondiente.
                </p>
                <div class="mt-3 flex items-center gap-2 bg-violet-100 rounded-xl px-4 py-2.5">
                  <span class="material-symbols-outlined text-violet-500 text-[16px]">lock</span>
                  <p class="text-xs text-violet-700 font-medium">El comprobante estará disponible cuando el funcionario apruebe y firme el trámite.</p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Finalizado / Aprobado: banner + botón comprobante -->
        @if (tramite().estado === 'finalizado') {
          <div class="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border"
            [class.bg-emerald-50]="tieneFirmaFuncionario()"
            [class.border-emerald-200]="tieneFirmaFuncionario()"
            [class.bg-amber-50]="!tieneFirmaFuncionario()"
            [class.border-amber-200]="!tieneFirmaFuncionario()">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0"
                [class.bg-emerald-500]="tieneFirmaFuncionario()"
                [class.bg-amber-400]="!tieneFirmaFuncionario()">
                <span class="material-symbols-outlined text-white text-[22px]">
                  {{ tieneFirmaFuncionario() ? 'verified' : 'pending_actions' }}
                </span>
              </div>
              <div>
                <p class="font-bold text-sm uppercase tracking-wide"
                  [class.text-emerald-900]="tieneFirmaFuncionario()"
                  [class.text-amber-900]="!tieneFirmaFuncionario()">
                  {{ tieneFirmaFuncionario() ? 'Trámite Aprobado' : 'Trámite Finalizado — Pendiente de firma' }}
                </p>
                <p class="text-xs mt-0.5"
                  [class.text-emerald-700]="tieneFirmaFuncionario()"
                  [class.text-amber-700]="!tieneFirmaFuncionario()">
                  {{ tieneFirmaFuncionario() ? 'Finalizado el ' + formatFecha(tramite().fecha_fin) : 'El funcionario aún no ha firmado el comprobante.' }}
                </p>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (tieneFirmaFuncionario()) {
                <a [routerLink]="['/tramites', tramite().id, 'comprobante']"
                  class="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm">
                  <span class="material-symbols-outlined text-[18px]">description</span>
                  Ver Comprobante
                </a>
                <a [routerLink]="['/tramites', tramite().id, 'comprobante']"
                  class="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                  <span class="material-symbols-outlined text-[18px]">print</span>
                  Imprimir PDF
                </a>
              } @else {
                <div class="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-sm font-bold cursor-not-allowed select-none">
                  <span class="material-symbols-outlined text-[18px]">lock</span>
                  Comprobante bloqueado
                </div>
              }
            </div>
          </div>
        }

        <!-- ─── DOCUMENTOS DEL TRÁMITE ─────────────────────────────── -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <span class="material-symbols-outlined text-blue-600">folder_open</span>
              <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wider">
                Repositorio de Documentos
                @if (documentos().length > 0) {
                  <span class="ml-2 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold">{{ documentos().length }}</span>
                }
              </h2>
            </div>
            @if (requiereDocumentos()) {
              <label class="cursor-pointer flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
                <span class="material-symbols-outlined text-[16px]">upload</span>
                Subir archivo
                <input type="file" class="hidden" (change)="subirDocumento($event)" accept=".pdf,.docx,.xlsx,.jpg,.png,.mp4" [disabled]="subiendoDoc()">
              </label>
            }
          </div>

          @if (subiendoDoc()) {
            <div class="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-sm text-blue-700">
              <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              Subiendo documento a MinIO (S3)...
            </div>
          }
          @if (mensajeDoc()) {
            <div class="px-6 py-3 border-b text-sm font-medium"
              [class.bg-green-50]="mensajeDoc()!.startsWith('✅')"
              [class.text-green-700]="mensajeDoc()!.startsWith('✅')"
              [class.bg-red-50]="mensajeDoc()!.startsWith('❌')"
              [class.text-red-700]="mensajeDoc()!.startsWith('❌')">
              {{ mensajeDoc() }}
            </div>
          }

          <div class="p-4">
            @if (cargandoDocs()) {
              <div class="flex justify-center py-6">
                <div class="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              </div>
            } @else if (documentos().length === 0) {
              <div class="text-center py-8 text-slate-400">
                <span class="material-symbols-outlined text-4xl text-slate-300 block mb-2">folder_off</span>
                <p class="text-sm">No hay documentos subidos aún.</p>
                <p class="text-xs mt-1">Sube los archivos requeridos para tu trámite (PDF, Word, Excel, imagen).</p>
              </div>
            } @else {
              <div class="space-y-3">
                @for (doc of documentos(); track doc.key) {
                  <div class="flex items-center gap-4 p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                    <!-- Ícono por tipo -->
                    <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      [class.bg-red-100]="doc.content_type?.includes('pdf')"
                      [class.bg-blue-100]="doc.content_type?.includes('word') || doc.nombre?.endsWith('.docx')"
                      [class.bg-green-100]="doc.content_type?.includes('excel') || doc.nombre?.endsWith('.xlsx')"
                      [class.bg-slate-100]="doc.content_type?.includes('image')">
                      <span class="material-symbols-outlined text-[18px]"
                        [class.text-red-600]="doc.content_type?.includes('pdf')"
                        [class.text-blue-600]="doc.content_type?.includes('word') || doc.nombre?.endsWith('.docx')"
                        [class.text-green-600]="doc.content_type?.includes('excel') || doc.nombre?.endsWith('.xlsx')"
                        [class.text-slate-600]="doc.content_type?.includes('image')">
                        {{ doc.content_type?.includes('pdf') ? 'picture_as_pdf' :
                           doc.content_type?.includes('image') ? 'image' :
                           doc.nombre?.endsWith('.xlsx') ? 'table_chart' : 'description' }}
                      </span>
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-800 truncate">{{ doc.nombre }}</p>
                      <p class="text-xs text-slate-400">
                        {{ formatBytes(doc.tamanio_bytes) }} · Subido por {{ doc.subido_por }}
                        @if (doc.fecha_subida) { · {{ formatFecha(doc.fecha_subida) }} }
                      </p>
                    </div>

                    <!-- Acciones -->
                    <div class="flex items-center gap-2 shrink-0 flex-wrap">
                      <!-- Colaborar para Word/Excel/txt -->
                      @if (doc.nombre?.endsWith('.docx') || doc.nombre?.endsWith('.xlsx') || doc.nombre?.endsWith('.pptx') || doc.nombre?.endsWith('.txt') || doc.nombre?.endsWith('.html')) {
                        <button (click)="abrirEditorColaborativo(doc)"
                          class="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                          title="Edición colaborativa">
                          <span class="material-symbols-outlined text-[14px]">group</span>
                          Colaborar
                        </button>
                      }
                      <!-- Ver inline para PDF/imágenes -->
                      @if (doc.content_type?.includes('pdf') || doc.content_type?.includes('image')) {
                        <a [href]="proxyUrlDescarga(doc)" target="_blank"
                          class="flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors">
                          <span class="material-symbols-outlined text-[14px]">visibility</span>
                          Ver
                        </a>
                      }
                      <!-- Reemplazar archivo -->
                      <label class="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors cursor-pointer"
                        [class.opacity-60]="reemplazandoDoc() === doc.key"
                        [class.pointer-events-none]="reemplazandoDoc() === doc.key"
                        title="Subir nueva versión del archivo (reemplaza el actual)">
                        @if (reemplazandoDoc() === doc.key) {
                          <div class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        } @else {
                          <span class="material-symbols-outlined text-[14px]">swap_horiz</span>
                        }
                        Reemplazar
                        <input type="file" class="hidden"
                          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.mp4,.txt"
                          (change)="reemplazarDocumento(doc, $event)"
                          [disabled]="reemplazandoDoc() === doc.key">
                      </label>
                      <!-- Descargar -->
                      <a [href]="proxyUrlDescarga(doc)" target="_blank" download
                        class="flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors">
                        <span class="material-symbols-outlined text-[14px]">download</span>
                        Descargar
                      </a>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>


      }

      @if (!cargando() && !tramite()) {
        <div class="text-center py-16 text-slate-400">
          <span class="material-symbols-outlined text-5xl text-slate-300 mb-3 block">search_off</span>
          Trámite no encontrado.
        </div>
      }

      <!-- Modal Editor Colaborativo TipTap — pantalla casi completa -->
      @if (mostrarEditorColaborativo() && documentoEnEdicion()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
          <div class="bg-white rounded-xl shadow-2xl flex flex-col"
               style="width: min(98vw, 1400px); height: calc(100vh - 24px);">

            <!-- Barra superior compacta -->
            <div class="flex items-center gap-3 px-4 py-2.5 border-b border-slate-200 bg-slate-50 rounded-t-xl shrink-0">
              <!-- Botón volver -->
              <button (click)="cerrarEditorColaborativo()"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-slate-600 font-semibold text-sm">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                Volver
              </button>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-bold text-slate-700 truncate">Editor Colaborativo</span>
                <span class="text-xs text-slate-400 ml-2">{{ documentoEnEdicion()?.nombre }}</span>
              </div>
              <a [href]="proxyUrlDescarga(documentoEnEdicion()!)" target="_blank" download
                class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                <span class="material-symbols-outlined text-[16px]">download</span>
                Descargar
              </a>
              <button (click)="cerrarEditorColaborativo()"
                class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors text-slate-400">
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <!-- Editor ocupa todo el espacio restante -->
            <div class="flex-1 overflow-hidden">
              <app-editor-colaborativo
                [documentoKey]="documentoEnEdicion()?.key ?? ''"
                [nombreDoc]="documentoEnEdicion()?.nombre ?? ''"
                [tramiteId]="tramite()?.id ?? ''"
                (contenidoGuardado)="contenidoEditor.set($event)">
              </app-editor-colaborativo>
            </div>

            <!-- Pie eliminado — acciones ya están en la barra superior -->
            <div class="hidden">
              <a [href]="proxyUrlDescarga(documentoEnEdicion()!)" target="_blank" download>
                Descargar
              </a>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class DetalleTramiteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private tramiteSvc = inject(TramiteService);
  private realtime = inject(RealtimeService);
  private simulador = inject(TramiteTiempoSimuladorService);
  private authSvc = inject(AuthService);
  private http = inject(HttpClient);
  private layoutSvc = inject(LayoutService);

  tramite = signal<any>(null);
  cargando = signal(true);
  private tick = signal(0);
  private relojId: number | null = null;
  private tramiteSeguimientoId: string | null = null;

  horasSimuladas = this.simulador.horasSimuladas;

  // ── Documentos S3/MinIO ────────────────────────────────────
  documentos = signal<any[]>([]);
  cargandoDocs = signal(false);
  subiendoDoc = signal(false);
  reemplazandoDoc = signal<string | null>(null);
  mensajeDoc = signal<string | null>(null);
  requiereDocumentos = signal(false);

  // ── Editor Colaborativo TipTap ────────────────────────────
  mostrarEditorColaborativo = signal(false);
  documentoEnEdicion = signal<any | null>(null);
  contenidoEditor = signal<string>('');

  // ── Esquemas de formulario para resolver etiquetas de grid ───
  // Clave: nodoId → lista de CampoFormulario del formulario de ese nodo
  private formularioSchemas = signal<Map<string, any[]>>(new Map());

  private readonly FASTAPI = '/ai';

  // Documento a abrir automáticamente (viene de la campana de notificaciones)
  private abrirDocPendiente: string | null = null;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.tramiteSeguimientoId = id || null;

    // Auto-abrir editor si venimos desde la campana (funciona aunque ya estemos en la página)
    this.route.queryParamMap.subscribe(params => {
      const abrirDoc = params.get('abrirDoc');
      if (!abrirDoc) return;
      const docs = this.documentos();
      if (docs.length > 0) {
        const doc = docs.find((d: any) => d.key === abrirDoc)
          ?? { key: abrirDoc, nombre: abrirDoc.split('/').pop() ?? 'Documento' };
        this.abrirEditorColaborativo(doc);
      } else {
        this.abrirDocPendiente = abrirDoc;
      }
    });
    this.realtime.connect();
    this.relojId = window.setInterval(() => this.tick.update(v => v + 1), 60000);
    this.tramiteSvc.obtenerDetalle(id).subscribe({
      next: (t) => {
        this.tramite.set(t);
        this.cargando.set(false);
        this.cargarDocumentos();
        this.verificarRequiereDocumentos(t);
        this.cargarEsquemasFormularios(t);
      },
      error: () => this.cargando.set(false)
    });

    this.realtime.estadoTramite(id).subscribe(() => {
      this.tramiteSvc.obtenerDetalle(id).subscribe({
        next: (t) => this.tramite.set(t),
      });
    });
  }

  ngOnDestroy(): void {
    this.layoutSvc.editorColabAbierto.set(false);
    if (this.relojId !== null) {
      window.clearInterval(this.relojId);
    }
    if (this.tramiteSeguimientoId) {
      this.realtime.unsubscribe(`/topic/tramite/${this.tramiteSeguimientoId}/estado`);
    }
  }

  resetSimulacion(): void {
    this.simulador.reset();
  }

  formatFecha(f: string | undefined): string {
    if (!f) return '—';
    try { return new Date(f).toLocaleString('es-BO'); } catch { return f ?? '—'; }
  }

  tiempoRestanteTexto(fechaLimite: string | undefined): string {
    this.tick();
    if (!fechaLimite) return '—';

    const limite = new Date(fechaLimite).getTime();
    if (Number.isNaN(limite)) return '—';

    const diferenciaMs = limite - this.simulador.ahoraMs();
    if (diferenciaMs <= 0) return 'Vencido';

    const horas = Math.floor(diferenciaMs / 3600000);
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;

    return dias > 0 ? `${dias} d ${horasRestantes} h` : `${horas} h`;
  }

  semaforoVisual(tramite: any): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    if (!tramite) return undefined;

    const inicio = this.obtenerFecha(tramite.fecha_inicio ?? tramite.fechaInicio);
    const limite = this.obtenerFecha(tramite.fecha_limite ?? tramite.fechaLimite);
    if (inicio === null || limite === null) {
      return this.normalizarSemaforo(tramite.semaforizacion);
    }

    const ahora = this.simulador.ahoraMs();
    if (ahora > limite) return 'Rojo';

    const total = limite - inicio;
    if (total <= 0) return 'Rojo';

    const porcentaje = (ahora - inicio) / total;
    if (porcentaje >= 0.75) return 'Rojo';
    if (porcentaje >= 0.40) return 'Amarillo';
    return 'Verde';
  }

  private obtenerFecha(fecha?: string): number | null {
    if (!fecha) return null;
    const valor = new Date(fecha).getTime();
    return Number.isNaN(valor) ? null : valor;
  }

  private normalizarSemaforo(valor?: string): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    const normalizado = (valor || '').trim().toLowerCase();
    if (normalizado === 'rojo') return 'Rojo';
    if (normalizado === 'amarillo') return 'Amarillo';
    if (normalizado === 'verde') return 'Verde';
    return undefined;
  }

  /** Devuelve las entradas del nodo sin las claves internas (__LABELS__, etc.) */
  entradasVisibles(nodoId: string): [string, any][] {
    const respuestas = this.tramite()?.respuestas_por_nodo?.[nodoId] ?? {};
    return Object.entries(respuestas).filter(([k]) => !k.startsWith('__'));
  }

  /** Resuelve el label legible de un campo, priorizando labels_por_nodo y __LABELS__ */
  labelCampo(nodoId: string, key: string): string {
    const t = this.tramite();
    // 1) labels_por_nodo[nodoId][key]
    const labelNodo = t?.labels_por_nodo?.[nodoId]?.[key]
      ?? t?.labels_por_nodo?.[nodoId]?.[key.toLowerCase()]
      ?? t?.labels_por_nodo?.[nodoId]?.[key.toUpperCase()];
    if (labelNodo) return labelNodo;

    // 2) __LABELS__ dentro de respuestas_por_nodo[nodoId]
    const respuestas = t?.respuestas_por_nodo?.[nodoId] ?? {};
    const labelsInline: Record<string, string> =
      respuestas['__LABELS__'] ?? respuestas['__labels__'] ?? {};
    const labelInline = labelsInline[key] ?? labelsInline[key.toLowerCase()] ?? labelsInline[key.toUpperCase()];
    if (labelInline) return labelInline;

    return humanizarClaveCampo(key);
  }

  esFirma(valor: any): boolean {
    return typeof valor === 'string' && valor.startsWith('data:image');
  }

  esArchivo(valor: any): boolean {
    if (typeof valor !== 'string') return false;
    return /\.(jpg|jpeg|png|pdf|docx|xlsx|gif|webp|doc|xls)$/i.test(valor);
  }

  nombreArchivo(ruta: string): string {
    if (!ruta) return ruta;
    return ruta.split('/').pop() || ruta;
  }

  iconoArchivo(nombre: string): string {
    const ext = (nombre ?? '').split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext ?? '')) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext ?? '')) return '📝';
    if (['xls','xlsx'].includes(ext ?? '')) return '📊';
    return '📎';
  }

  formatValor(valor: any): string {
    if (valor === null || valor === undefined) return '—';
    if (Array.isArray(valor)) return valor.join(', ');
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    if (typeof valor === 'object') return JSON.stringify(valor);
    return String(valor);
  }

  esGrid(valor: any): boolean {
    if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false;
    const vals = Object.values(valor);
    return vals.length > 0 && vals.every(v => typeof v === 'object' && v !== null && !Array.isArray(v));
  }

  /**
   * Carga esquemas de formularios para resolver etiquetas de grids sin __GRID_META__.
   * Cadena: política → esquema_workflow.pasos[].{id, formularioId}
   *         → formularios → campos con tablaFilas/tablaColumnas
   * El mapa resultante clave = pasoId (= nodoId del historial) → campos[].
   */
  private cargarEsquemasFormularios(t: any): void {
    const politicaId = t?.politica_id || t?.politicaId;
    if (!politicaId || politicaId === 'sin-politica') return;

    // Paso 1: obtener política para conocer pasoId → formularioId
    this.http.get<any>(`/api/politicas/${politicaId}`).subscribe({
      next: (pol) => {
        const pasos: any[] = pol.esquema_workflow?.pasos ?? [];
        // mapa pasoId → formularioId
        const pasoFormulario = new Map<string, string>();
        for (const paso of pasos) {
          if (paso.id && paso.formularioId) pasoFormulario.set(paso.id, paso.formularioId);
        }

        // Paso 2: cargar todos los formularios de la política
        this.http.get<any[]>(`/api/formularios?politicaId=${politicaId}`).subscribe({
          next: (formularios) => {
            // mapa formularioId → campos
            const porFormularioId = new Map<string, any[]>();
            for (const f of formularios ?? []) {
              porFormularioId.set(f.id, f.campos ?? f.esquema_campos ?? []);
              if (f.id_nodo) porFormularioId.set(f.id_nodo, f.campos ?? f.esquema_campos ?? []);
            }

            // Construir mapa final: pasoId → campos
            const mapa = new Map<string, any[]>();
            for (const [pasoId, formularioId] of pasoFormulario) {
              const campos = porFormularioId.get(formularioId);
              if (campos) mapa.set(pasoId, campos);
            }
            // También indexar directamente por formularioId por si acaso
            for (const [fid, campos] of porFormularioId) mapa.set(fid, campos);

            this.formularioSchemas.set(mapa);
          },
          error: () => {}
        });
      },
      error: () => {}
    });
  }

  gridMeta(nodoId: string, campoId: string): any {
    // Prioridad 1: meta guardada al enviar (nueva funcionalidad)
    const resp = this.tramite()?.respuestas_por_nodo?.[nodoId] ?? {};
    const stored = resp[`__GRID_META__${campoId}`];
    if (stored) return stored;

    // Prioridad 2: cargar del esquema del formulario (trámites existentes sin meta)
    const campos: any[] = this.formularioSchemas().get(nodoId) ?? [];
    const campo = campos.find((c: any) => c.id === campoId);
    if (!campo) return null;

    const meta: any = {
      col0Header: (campo.tablaColumnas ?? [])[0]?.titulo ?? 'Concepto',
      filas: {} as Record<string, string>,
      columnas: {} as Record<string, string>
    };
    for (const fila of campo.tablaFilas ?? []) {
      meta.filas[fila.id] = fila.etiqueta ?? fila.id;
    }
    for (const col of (campo.tablaColumnas ?? []).slice(1)) {
      meta.columnas[col.id] = col.titulo ?? col.id;
    }
    return meta;
  }

  gridFilas(val: any): string[] {
    return Object.keys(val ?? {});
  }

  gridCols(val: any): string[] {
    const primerFila = Object.values(val ?? {})[0];
    if (!primerFila || typeof primerFila !== 'object') return [];
    return Object.keys(primerFila as object);
  }

  gridCellValue(val: any, filaId: string, colId: string): string {
    const cell = val?.[filaId]?.[colId];
    if (cell === null || cell === undefined || cell === '') return '—';
    return String(cell);
  }

  /**
   * Determina si existe una firma de un FUNCIONARIO en el trámite.
   *
   * LÓGICA CORRECTA: usa `completadoPor` del historial.
   * Si el nodo fue completado por el cliente (cliente_id),
   * TODAS sus firmas son del cliente — sin importar el label del campo.
   * Solo se cuenta como firma de funcionario si el nodo fue completado
   * por alguien DISTINTO al cliente.
   */
  tieneFirmaFuncionario(): boolean {
    const t = this.tramite();
    if (!t) return false;
    const clienteId: string = t.cliente_id;
    const respuestas: Record<string, any> = t.respuestas_por_nodo ?? {};
    const historial: any[] = t.historial ?? [];

    for (const nodoId of Object.keys(respuestas)) {
      // ¿Quién completó este nodo?
      const entrada = historial.find((h: any) => h.nodoId === nodoId);
      const completadoPor: string | undefined = entrada?.completadoPor;

      // Si fue completado por el cliente (completadoPor === clienteId) → todas sus firmas son del cliente
      // No asumir cliente cuando completadoPor es undefined
      if (completadoPor !== undefined && completadoPor === clienteId) continue;

      // Fue completado por alguien más (funcionario/admin) → buscar firmas
      const nodoRespuestas = respuestas[nodoId] ?? {};
      for (const [key, val] of Object.entries(nodoRespuestas)) {
        if (key.startsWith('__')) continue;
        if (this.esFirma(val)) return true; // ✅ Firma real de funcionario
      }
    }
    return false;
  }

  buscarLabelGlobal(key: string): string {
    const t = this.tramite();
    if (!t) return key;
    const labelsNodo = t.labels_por_nodo ?? {};
    for (const nodoId of Object.keys(labelsNodo)) {
      const l = labelsNodo[nodoId]?.[key] 
             ?? labelsNodo[nodoId]?.[key.toLowerCase()] 
             ?? labelsNodo[nodoId]?.[key.toUpperCase()];
      if (l) return l;
    }
    const respuestas = t.respuestas_por_nodo ?? {};
    for (const nodoId of Object.keys(respuestas)) {
      const labelsInline = respuestas[nodoId]?.['__LABELS__'] ?? respuestas[nodoId]?.['__labels__'] ?? {};
      const l = labelsInline[key] ?? labelsInline[key.toLowerCase()] ?? labelsInline[key.toUpperCase()];
      if (l) return l;
    }
    return key;
  }

  // ── Documentos S3/MinIO ────────────────────────────────────

  private verificarRequiereDocumentos(t: any): void {
    const politicaId = t.politica_id || t.politicaId;
    if (!politicaId || politicaId === 'sin-politica') {
      this.requiereDocumentos.set(true);
      return;
    }
    this.http.get<any>(`http://localhost:9090/api/politicas/${politicaId}`).subscribe({
      next: (pol) => {
        const pasos: any[] = pol.esquema_workflow?.pasos ?? [];
        const tieneArchivo = pasos.some((p: any) =>
          p.campotipo === 'archivo' ||
          (p.campos ?? []).some((c: any) => c.tipo === 'archivo')
        );
        this.requiereDocumentos.set(tieneArchivo || !!pol.requiereDocumentacion || !!pol.requiere_documentacion);
      },
      error: () => this.requiereDocumentos.set(true)
    });
  }

  private cargarDocumentos(): void {
    const t = this.tramite();
    if (!t) return;
    const usuario = this.authSvc.getUsuario() as any;
    // empresa_id viene del tramite primero (para que admin y cliente vean los mismos docs)
    const empresaId = t.empresa_id || t.empresaId || usuario?.empresa_id || usuario?.empresa || 'EMP-DEFAULT';
    const politicaId = t.politica_id || t.politicaId || 'sin-politica';
    const tramiteId = t.id;

    this.cargandoDocs.set(true);
    this.http.get<any>(`${this.FASTAPI}/documentos/${empresaId}/${politicaId}/${tramiteId}`)
      .subscribe({
        next: (res) => {
          // Ocultar archivos internos de edición (.edited.html)
          const docs = (res.documentos ?? []).filter((d: any) =>
            !d.key?.endsWith('.edited.html') && !d.nombre?.endsWith('.edited.html')
          );
          this.documentos.set(docs);
          this.cargandoDocs.set(false);

          // Auto-abrir editor si venimos desde la campana de notificaciones
          if (this.abrirDocPendiente) {
            const pendiente = this.abrirDocPendiente;
            this.abrirDocPendiente = null;
            const doc = docs.find((d: any) => d.key === pendiente)
              ?? { key: pendiente, nombre: pendiente.split('/').pop() ?? 'Documento' };
            this.abrirEditorColaborativo(doc);
          }
        },
        error: () => this.cargandoDocs.set(false)
      });
  }

  subirDocumento(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const archivo = input.files[0];
    const t = this.tramite();
    if (!t) return;

    const usuario = this.authSvc.getUsuario() as any;
    const empresaId = t.empresa_id || t.empresaId || usuario?.empresa_id || usuario?.empresa || 'EMP-DEFAULT';
    const politicaId = t.politica_id || t.politicaId || 'sin-politica';
    const tramiteId = t.id;
    const subidoPor = usuario?.nombre || usuario?.email || 'cliente';

    const formData = new FormData();
    formData.append('archivo', archivo, archivo.name);
    formData.append('empresa_id', empresaId);
    formData.append('politica_id', politicaId);
    formData.append('tramite_id', tramiteId);
    formData.append('subido_por', subidoPor);

    this.subiendoDoc.set(true);
    this.mensajeDoc.set(null);

    this.http.post<any>(`${this.FASTAPI}/documentos/subir`, formData)
      .subscribe({
        next: (res) => {
          this.subiendoDoc.set(false);
          this.mensajeDoc.set(`✅ Archivo "${res.nombre}" subido correctamente al repositorio`);
          this.cargarDocumentos();
          setTimeout(() => this.mensajeDoc.set(null), 5000);
          input.value = '';
        },
        error: () => {
          this.subiendoDoc.set(false);
          this.mensajeDoc.set('❌ Error al subir el archivo. Verifica que FastAPI esté activo.');
        }
      });
  }

  reemplazarDocumento(doc: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const archivo = input.files[0];
    const t = this.tramite();
    if (!t) return;

    const usuario = this.authSvc.getUsuario() as any;
    const empresaId = t.empresa_id || t.empresaId || usuario?.empresa_id || usuario?.empresa || 'EMP-DEFAULT';
    const politicaId = t.politica_id || t.politicaId || 'sin-politica';
    const tramiteId = t.id;
    const subidoPor = usuario?.nombre || usuario?.email || 'cliente';

    // Upload with ORIGINAL filename so MinIO overwrites the existing key
    const formData = new FormData();
    formData.append('archivo', archivo, doc.nombre);   // ← use old name to overwrite
    formData.append('empresa_id', empresaId);
    formData.append('politica_id', politicaId);
    formData.append('tramite_id', tramiteId);
    formData.append('subido_por', subidoPor);

    this.reemplazandoDoc.set(doc.key);
    this.mensajeDoc.set(null);

    this.http.post<any>(`${this.FASTAPI}/documentos/subir`, formData).subscribe({
      next: (_) => {
        // Also delete the .edited.html cache so the editor reloads fresh from the new file
        const editedKey = `${doc.key}.edited.html`;
        this.http.delete(`${this.FASTAPI}/documentos/${encodeURIComponent(editedKey)}`).subscribe({
          error: () => {} // ignore if cache didn't exist
        });
        this.reemplazandoDoc.set(null);
        this.mensajeDoc.set(`✅ "${doc.nombre}" reemplazado correctamente`);
        this.cargarDocumentos();
        input.value = '';
        setTimeout(() => this.mensajeDoc.set(null), 5000);
      },
      error: () => {
        this.reemplazandoDoc.set(null);
        this.mensajeDoc.set('❌ Error al reemplazar el archivo.');
        input.value = '';
      }
    });
  }

  abrirEditorColaborativo(doc: any): void {
    this.documentoEnEdicion.set(doc);
    this.mostrarEditorColaborativo.set(true);
    this.layoutSvc.editorColabAbierto.set(true);
  }

  cerrarEditorColaborativo(): void {
    this.mostrarEditorColaborativo.set(false);
    this.layoutSvc.editorColabAbierto.set(false);
    setTimeout(() => {
      this.documentoEnEdicion.set(null);
    }, 300);
  }

  proxyUrlDescarga(doc: any): string {
    // /ai/ → nginx → FastAPI → MinIO (funciona desde browser y desde Docker)
    return `/ai/documentos/proxy/${doc.key ?? ''}`;
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

function humanizarClaveCampo(key: string): string {
  return (key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, letra => letra.toUpperCase()) || key;
}
