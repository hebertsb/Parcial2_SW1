/**
 * Editor de Formulario Visual (CU-11).
 *
 * - Paleta izquierda: tipos de campo (clic para agregar).
 * - Canvas central: campos arrastrables en posición libre (estilo NetBeans).
 * - Panel derecho: configuración del campo seleccionado.
 * - Cada cambio se emite por STOMP + autoguardado REST con debounce 800 ms.
 */

import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragEnd } from '@angular/cdk/drag-drop';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import {
  CampoFormulario,
  Formulario,
  TipoCampo,
  EsquemaWorkflow,
  ColumnaTabla,
  FilaTabla,
} from '../../../../core/models/flujo.models';
import { AuthService } from '../../../../core/services/auth.service';
import { FormularioService } from '../../../../core/services/formulario.service';
import { RealtimeService } from '../../../../core/services/realtime.service';
import { CursorFormularioDto } from '../../../../core/models/realtime.models';

interface EditorRemoto {
  usuarioId: string;
  usuarioNombre: string;
  color: string;
  campoId?: string;
}

const TIPOS: { valor: TipoCampo; etiqueta: string; icono: string }[] = [
  { valor: 'texto',       etiqueta: 'Texto',         icono: 'text_fields' },
  { valor: 'texto_largo', etiqueta: 'Texto largo',   icono: 'notes' },
  { valor: 'numero',      etiqueta: 'Número',         icono: 'tag' },
  { valor: 'lista',       etiqueta: 'Lista',          icono: 'list' },
  { valor: 'si_no',       etiqueta: 'Sí / No',       icono: 'check_box' },
  { valor: 'fecha',       etiqueta: 'Fecha',          icono: 'event' },
  { valor: 'archivo',     etiqueta: 'Archivo',        icono: 'attach_file' },
  { valor: 'firma',       etiqueta: 'Firma Digital',  icono: 'draw' },
  { valor: 'label',       etiqueta: 'Etiqueta',       icono: 'label' },
  { valor: 'grid',        etiqueta: 'Tabla / Grid',   icono: 'table_chart' },
];

const CAMPO_COLORS: Record<TipoCampo, string> = {
  texto: '#3b82f6', texto_largo: '#14b8a6', numero: '#10b981',
  lista: '#f97316', si_no: '#a855f7', fecha: '#06b6d4',
  firma: '#ec4899', archivo: '#f59e0b', label: '#64748b', grid: '#8b5cf6',
};

const CAMPO_ICONS: Record<TipoCampo, string> = {
  texto: 'text_fields', texto_largo: 'notes', numero: 'pin',
  lista: 'format_list_bulleted', si_no: 'toggle_on', fecha: 'calendar_month',
  firma: 'draw', archivo: 'attach_file', label: 'label', grid: 'table_chart',
};

const CAMPO_PREVIEWS: Record<TipoCampo, string> = {
  texto: '[ ___________________ ]',
  texto_largo: '[ ___________________ ]\n[ ___________________ ]',
  numero: '[ _______ 0 _________ ]',
  lista: '[ Seleccionar...     ▾ ]',
  si_no: '◉ Sí   ○ No',
  fecha: '[ DD / MM / AAAA   📅 ]',
  firma: '✍  ________________________',
  archivo: '📎  Adjuntar archivo...',
  label: '— Texto informativo —',
  grid: '⊞  Tabla de datos',
};

@Component({
  selector: 'app-formulario-editor-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  template: `
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex flex-col">

      <!-- ── HEADER ── -->
      <div class="flex items-center justify-between px-5 py-3 bg-[#0f172a]/95 border-b border-white/10 shrink-0">
        <div class="flex items-center gap-3">
          @if (editoresRemotos.length > 0) {
            <div class="flex items-center gap-1">
              @for (e of editoresRemotos; track $index) {
                <span class="px-2 py-0.5 rounded-full text-white text-[10px] font-semibold"
                      [style.background]="e.color">● {{ e.usuarioNombre }}</span>
              }
            </div>
          }
          <div>
            <h3 class="text-white font-bold text-base">{{ formulario.nombre }}</h3>
            <p class="text-xs text-slate-400">{{ formulario.campos.length }} campos · Diseñador visual libre</p>
          </div>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-xs flex items-center gap-1.5"
                [class.text-emerald-400]="estadoGuardado === 'guardado'"
                [class.text-yellow-400]="estadoGuardado === 'guardando'"
                [class.text-red-400]="estadoGuardado === 'error'">
            <span class="w-1.5 h-1.5 rounded-full"
                  [class.bg-emerald-400]="estadoGuardado === 'guardado'"
                  [class.bg-yellow-400]="estadoGuardado === 'guardando'"
                  [class.bg-red-400]="estadoGuardado === 'error'"></span>
            {{ estadoGuardado === 'guardando' ? 'Guardando...' : estadoGuardado === 'error' ? 'Error al guardar' : 'Guardado' }}
          </span>
          <button (click)="modoPrevia = !modoPrevia"
                  [class]="'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all border ' + (modoPrevia ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/10 border-white/10 text-slate-300')">
            <span class="material-symbols-outlined text-[16px]">{{ modoPrevia ? 'edit_note' : 'preview' }}</span>
            {{ modoPrevia ? 'Editar diseño' : 'Vista previa' }}
          </button>
          <button (click)="cerrar.emit()"
                  class="bg-white/10 hover:bg-white/20 border border-white/10 px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">close</span>
            Cerrar
          </button>
        </div>
      </div>

      <!-- ── BODY ── -->
      <div class="flex flex-1 overflow-hidden">

        <!-- ─── PALETA ─── -->
        <div class="w-44 bg-[#0f172a]/95 border-r border-white/10 flex flex-col shrink-0 overflow-y-auto" [class.hidden]="modoPrevia">
          <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest px-3 pt-3 pb-2">
            Tipos de campo
          </p>
          @for (t of tipos; track t.valor) {
            <button
              draggable="true"
              (dragstart)="onPaletteDragStart($event, t.valor)"
              (click)="agregarDesdePaleta(t.valor)"
              class="flex items-center gap-2 px-3 py-2.5 hover:bg-white/8 text-slate-300 hover:text-white transition-colors text-left group border-b border-white/5 cursor-grab active:cursor-grabbing"
              title="Arrastra al lienzo o haz clic para agregar"
            >
              <span class="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    [style.background]="getCampoColor(t.valor) + '25'"
                    [style.border]="'1px solid ' + getCampoColor(t.valor) + '55'">
                <span class="material-symbols-outlined text-[14px]"
                      [style.color]="getCampoColor(t.valor)">{{ t.icono }}</span>
              </span>
              <span class="text-xs font-medium flex-1">{{ t.etiqueta }}</span>
              <span class="material-symbols-outlined text-[12px] text-slate-700 group-hover:text-purple-400 transition-colors">drag_indicator</span>
            </button>
          }
          <div class="mt-auto p-3 text-center">
            <p class="text-[9px] text-slate-600 leading-tight">⬆ Arrastra al lienzo<br>o clic para agregar</p>
          </div>
        </div>

        <!-- ─── CANVAS ─── -->
        <div class="flex-1 overflow-auto bg-slate-950 relative" [class.hidden]="modoPrevia"
             (click)="campoSeleccionado = null">
          <!-- canvas workspace + form paper (guía hoja) -->
          <div style="width: 1060px; min-height: 800px; padding: 32px 40px;">
            <div style="width: 760px; border: 1px solid #64748b; background: white; box-shadow: 0 4px 32px rgba(0,0,0,0.5); position: relative;">

              <!-- ENCABEZADO DEL FORMULARIO -->
              <div style="height: 44px; background: #e2e8f0; border-bottom: 2px solid #94a3b8; display: flex; align-items: center; padding: 0 14px; user-select: none; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #64748b;">article</span>
                <span style="font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .1em;">Encabezado del formulario</span>
              </div>

              <!-- DETALLE (área de diseño de campos) -->
              <div #detalleRef class="relative" style="background: white;" [style.min-height]="calcAlturaPrevia() + 'px'"
                   (dragover)="onCanvasDragOver($event)"
                   (dragleave)="canvasDragOver = false"
                   (drop)="onCanvasDrop($event, detalleRef)"
                   [style.box-shadow]="canvasDragOver ? 'inset 0 0 0 3px #a855f7' : 'none'">
                <!-- dot grid fino -->
                <div class="absolute inset-0 pointer-events-none"
                     style="background-image: radial-gradient(rgba(100,116,139,0.18) 1px, transparent 1px); background-size: 16px 16px;"></div>

                @if (formulario.campos.length === 0) {
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
                    <span class="material-symbols-outlined text-6xl" style="color: #cbd5e1;">dashboard_customize</span>
                    <p style="color: #94a3b8; font-size: 13px; text-align: center;">
                      Haz clic en un tipo de campo de la paleta izquierda<br>para comenzar a diseñar el formulario.
                    </p>
                  </div>
                }

                @for (campo of formulario.campos; track campo.id) {
              <div
                cdkDrag
                [cdkDragFreeDragPosition]="{x: campo.posX ?? 20, y: campo.posY ?? 20}"
                (cdkDragEnded)="onDragEnded($event, campo)"
                class="absolute top-0 left-0 cursor-move select-none campo-widget"
                [style.width.px]="campo.largoCampo || 240"
                [class.ring-2]="campoSeleccionado?.id === campo.id"
                [class.ring-purple-400]="campoSeleccionado?.id === campo.id"
                [class.ring-offset-2]="campoSeleccionado?.id === campo.id"
                [class.shadow-2xl]="campoSeleccionado?.id === campo.id"
                (click)="$event.stopPropagation(); seleccionarCampo(campo)"
              >
                <!-- card -->
                <div class="rounded-xl border overflow-hidden transition-all duration-150"
                     style="background: rgba(15,23,42,0.96); backdrop-filter: blur(8px);"
                     [style.border-color]="campoSeleccionado?.id === campo.id ? getCampoColor(campo.tipo) : 'rgba(255,255,255,0.1)'">

                  <!-- header = drag handle -->
                  <div cdkDragHandle
                       class="flex items-center gap-2 px-3 py-2 border-b border-white/8 cursor-grab active:cursor-grabbing"
                       [style.border-left]="'3px solid ' + getCampoColor(campo.tipo)">
                    <span class="w-5 h-5 rounded flex items-center justify-center shrink-0"
                          [style.background]="getCampoColor(campo.tipo) + '22'">
                      <span class="material-symbols-outlined text-[12px]"
                            [style.color]="getCampoColor(campo.tipo)">{{ getCampoIcon(campo.tipo) }}</span>
                    </span>
                    <span class="text-[11px] font-semibold text-slate-200 flex-1 truncate">
                      {{ campo.titulo || '(sin título)' }}
                    </span>
                    @if (campo.obligatorio) {
                      <span class="text-red-400 text-[10px] font-black">*</span>
                    }
                    @if (campoDestacadoColor(campo.id); as col) {
                      <span class="w-2 h-2 rounded-full shrink-0" [style.background]="col"></span>
                    }
                    <span class="material-symbols-outlined text-[10px] text-slate-700">drag_indicator</span>
                  </div>

                  <!-- preview -->
                  <div class="px-3 py-2.5">
                    @if (campo.tipo === 'grid') {
                      @if ((campo.tablaColumnas?.length ?? 0) > 0) {
                        <div class="overflow-x-auto">
                          <table class="w-full text-[9px] border-collapse">
                            <thead>
                              <tr>
                                @for (col of (campo.tablaColumnas ?? []); track col.id) {
                                  <th class="border border-slate-700 bg-slate-900/70 px-1.5 py-0.5 text-slate-400 font-semibold text-left whitespace-nowrap">{{ col.titulo || 'Col' }}</th>
                                }
                              </tr>
                            </thead>
                            <tbody>
                              @for (fila of ((campo.tablaFilas?.length ? campo.tablaFilas : [{id:'_r',etiqueta:''}])); track fila.id) {
                                <tr>
                                  @for (col of (campo.tablaColumnas ?? []); track col.id; let ci = $index) {
                                    <td class="border border-slate-700 px-1.5 py-0.5 text-[9px] italic"
                                        [class]="ci === 0 ? 'text-slate-300 font-medium' : 'text-slate-600'">
                                      {{ ci === 0 ? (fila.etiqueta || '—') : (col.tipo === 'numero' ? '[ 0.00 ]' : '[ Rellena ]') }}
                                    </td>
                                  }
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      } @else {
                        <p class="text-[9px] text-slate-600 italic">Sin columnas — configura en el panel</p>
                      }
                    } @else {
                      <p class="text-[9px] text-slate-500 font-mono whitespace-pre-line leading-relaxed">{{ getCampoPreview(campo.tipo) }}</p>
                    }
                    @if (campo.descripcion) {
                      <p class="text-[9px] text-slate-700 mt-1 italic truncate">{{ campo.descripcion }}</p>
                    }
                  </div>
                </div>

                <!-- resize handle (borde derecho arrastrable) -->
                <div
                  class="absolute top-0 right-0 h-full z-40 flex items-center justify-center"
                  style="width: 8px; cursor: col-resize;"
                  (mousedown)="iniciarResize($event, campo)"
                  title="Arrastra para cambiar el ancho del campo"
                >
                  <div style="width: 2px; height: 28px; background: rgba(168,85,247,0.85); border-radius: 1px; transition: opacity .15s;"
                       [style.opacity]="campoSeleccionado?.id === campo.id ? '1' : '0'"></div>
                </div>

                <!-- delete button (visible when selected) -->
                <button
                  (click)="$event.stopPropagation(); eliminarCampo(campo)"
                  class="absolute -top-2.5 -right-2.5 w-5 h-5 bg-red-600 hover:bg-red-500 border-2 border-slate-950 rounded-full flex items-center justify-center z-50 transition-all duration-150"
                  [class.opacity-0]="campoSeleccionado?.id !== campo.id"
                  [class.scale-75]="campoSeleccionado?.id !== campo.id"
                  [class.opacity-100]="campoSeleccionado?.id === campo.id"
                  [class.scale-100]="campoSeleccionado?.id === campo.id"
                  title="Eliminar campo"
                >
                  <span class="material-symbols-outlined text-[11px] text-white font-bold">close</span>
                </button>
              </div>
            }

              </div>

              <!-- PIE DEL FORMULARIO -->
              <div style="height: 44px; background: #e2e8f0; border-top: 2px solid #94a3b8; display: flex; align-items: center; padding: 0 14px; user-select: none; gap: 8px;">
                <span class="material-symbols-outlined" style="font-size: 14px; color: #64748b;">web</span>
                <span style="font-size: 9px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: .1em;">Pie del formulario</span>
              </div>

            </div>
          </div>
        </div>

        <!-- ─── PANEL CONFIG ─── -->
        <div class="w-72 bg-[#0f172a]/95 border-l border-white/10 flex flex-col shrink-0 overflow-y-auto" [class.hidden]="modoPrevia">

          @if (!campoSeleccionado) {
            <div class="flex flex-col items-center justify-center flex-1 gap-3 p-6 text-center">
              <span class="material-symbols-outlined text-4xl text-slate-700">touch_app</span>
              <p class="text-slate-600 text-sm leading-relaxed">
                Selecciona un campo del canvas para ver y editar su configuración.
              </p>
            </div>
          } @else {
            <div class="p-4 space-y-4">

              <!-- tipo badge -->
              <div class="flex items-center gap-2 pb-3 border-b border-white/10">
                <span class="w-7 h-7 rounded-lg flex items-center justify-center"
                      [style.background]="getCampoColor(campoSeleccionado.tipo) + '33'">
                  <span class="material-symbols-outlined text-[16px]"
                        [style.color]="getCampoColor(campoSeleccionado.tipo)">{{ getCampoIcon(campoSeleccionado.tipo) }}</span>
                </span>
                <div>
                  <p class="text-xs font-bold text-slate-200">{{ etiquetaTipo(campoSeleccionado.tipo) }}</p>
                  <p class="text-[9px] text-slate-600">Pos: {{ campoSeleccionado.posX ?? 20 }}, {{ campoSeleccionado.posY ?? 20 }}</p>
                </div>
              </div>

              <!-- Título -->
              <div>
                <label class="cfg-label">Título *</label>
                <input
                  [ngModel]="campoSeleccionado.titulo"
                  (ngModelChange)="actualizarCampo(campoSeleccionado, 'titulo', $event)"
                  class="cfg-input"
                  placeholder="Ej: Nombre completo"
                />
              </div>

              <!-- Placeholder -->
              <div>
                <label class="cfg-label">Placeholder</label>
                <input
                  [ngModel]="campoSeleccionado.placeholder"
                  (ngModelChange)="actualizarCampo(campoSeleccionado, 'placeholder', $event)"
                  class="cfg-input"
                  placeholder="Texto de ayuda"
                />
              </div>

              <!-- Instrucciones -->
              <div>
                <label class="cfg-label">Instrucciones (visible al cliente)</label>
                <input
                  [ngModel]="campoSeleccionado.descripcion"
                  (ngModelChange)="actualizarCampo(campoSeleccionado, 'descripcion', $event)"
                  class="cfg-input"
                  placeholder="Ej: Ingrese NIT sin guiones"
                />
              </div>

              <!-- Ancho -->
              <div>
                <label class="cfg-label">Ancho del campo: {{ campoSeleccionado.largoCampo || 240 }}px</label>
                <input
                  type="range"
                  min="120" max="520" step="8"
                  [ngModel]="campoSeleccionado.largoCampo || 240"
                  (ngModelChange)="actualizarCampo(campoSeleccionado, 'largoCampo', +$event)"
                  class="w-full accent-purple-500 mt-1"
                />
                <div class="flex justify-between text-[9px] text-slate-600 mt-0.5">
                  <span>120px</span><span>Pequeño</span><span>Mediano</span><span>Grande</span><span>520px</span>
                </div>
              </div>

              <!-- Obligatorio -->
              <label class="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  [ngModel]="campoSeleccionado.obligatorio"
                  (ngModelChange)="actualizarCampo(campoSeleccionado, 'obligatorio', $event)"
                  class="accent-purple-500 w-4 h-4"
                />
                <span class="text-xs text-slate-300 font-medium">Campo obligatorio</span>
              </label>

              <!-- ── TIPO-SPECIFIC CONFIG ── -->

              <!-- LISTA -->
              @if (campoSeleccionado.tipo === 'lista') {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Opciones de lista</p>
                  <textarea rows="5"
                    [ngModel]="opcionesToText(campoSeleccionado)"
                    (ngModelChange)="actualizarCampo(campoSeleccionado, 'opciones', textToOpciones($event))"
                    class="cfg-input font-mono resize-none text-[11px]"
                    placeholder="OPCIÓN 1&#10;OPCIÓN 2&#10;OTRA"></textarea>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      [ngModel]="campoSeleccionado.multiple"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'multiple', $event)"
                      class="accent-purple-500"/>
                    <span class="text-[11px] text-slate-400">Selección múltiple</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      [ngModel]="campoSeleccionado.permitirOtro"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'permitirOtro', $event)"
                      class="accent-purple-500"/>
                    <span class="text-[11px] text-slate-400">Permitir opción "Otro"</span>
                  </label>
                </div>
              }

              <!-- ARCHIVO -->
              @if (campoSeleccionado.tipo === 'archivo') {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Archivo</p>
                  <div>
                    <label class="cfg-label">Formatos permitidos</label>
                    <div class="grid grid-cols-2 gap-y-1 gap-x-2 mt-1.5 bg-slate-900/60 rounded-lg p-2.5 border border-slate-700">
                      @for (fmt of formatosDisponibles; track fmt) {
                        <label class="flex items-center gap-1.5 cursor-pointer select-none">
                          <input type="checkbox"
                            [checked]="tieneFormato(campoSeleccionado, fmt)"
                            (change)="toggleFormato(campoSeleccionado, fmt, $any($event.target).checked)"
                            class="accent-purple-500 w-3.5 h-3.5 rounded"/>
                          <span class="text-[11px] text-slate-300 font-mono">{{ fmt }}</span>
                        </label>
                      }
                    </div>
                    @if (campoSeleccionado.formatos) {
                      <p class="text-[9px] text-slate-600 mt-1.5 italic truncate">{{ campoSeleccionado.formatos }}</p>
                    }
                  </div>
                  <div>
                    <label class="cfg-label">Máx. archivos</label>
                    <input type="number" [ngModel]="campoSeleccionado.cantidadMaxima"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'cantidadMaxima', +$event)"
                      class="cfg-input"/>
                  </div>
                </div>
              }

              <!-- FECHA -->
              @if (campoSeleccionado.tipo === 'fecha') {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Fecha</p>
                  <div class="flex gap-2">
                    <button (click)="actualizarCampo(campoSeleccionado, 'formatoFecha', 'corta')"
                      class="flex-1 py-1.5 rounded text-[11px] border transition-colors font-semibold"
                      [class.bg-purple-600]="campoSeleccionado.formatoFecha !== 'larga'"
                      [class.border-purple-400]="campoSeleccionado.formatoFecha !== 'larga'"
                      [class.text-white]="campoSeleccionado.formatoFecha !== 'larga'"
                      [class.border-slate-700]="campoSeleccionado.formatoFecha === 'larga'"
                      [class.text-slate-500]="campoSeleccionado.formatoFecha === 'larga'">
                      Corta
                    </button>
                    <button (click)="actualizarCampo(campoSeleccionado, 'formatoFecha', 'larga')"
                      class="flex-1 py-1.5 rounded text-[11px] border transition-colors font-semibold"
                      [class.bg-purple-600]="campoSeleccionado.formatoFecha === 'larga'"
                      [class.border-purple-400]="campoSeleccionado.formatoFecha === 'larga'"
                      [class.text-white]="campoSeleccionado.formatoFecha === 'larga'"
                      [class.border-slate-700]="campoSeleccionado.formatoFecha !== 'larga'"
                      [class.text-slate-500]="campoSeleccionado.formatoFecha !== 'larga'">
                      Larga
                    </button>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      [ngModel]="campoSeleccionado.incluyeHora"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'incluyeHora', $event)"
                      class="accent-purple-500"/>
                    <span class="text-[11px] text-slate-400">Incluir hora</span>
                  </label>
                </div>
              }

              <!-- NUMERO -->
              @if (campoSeleccionado.tipo === 'numero') {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Número</p>
                  <div>
                    <label class="cfg-label">Propósito</label>
                    <select [ngModel]="campoSeleccionado.subtipoNumero"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'subtipoNumero', $event)"
                      class="cfg-input">
                      <option value="general">General</option>
                      <option value="celular">Celular</option>
                      <option value="cuenta">Nº Cuenta</option>
                      <option value="pago">Monto / Pago</option>
                    </select>
                  </div>
                  <div>
                    <label class="cfg-label">Unidad (Bs., %, etc.)</label>
                    <input [ngModel]="campoSeleccionado.prefijoSufijo"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'prefijoSufijo', $event)"
                      class="cfg-input" placeholder="Bs."/>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <label class="cfg-label">Mínimo</label>
                      <input type="number" [ngModel]="campoSeleccionado.min"
                        (ngModelChange)="actualizarCampo(campoSeleccionado, 'min', +$event)" class="cfg-input"/>
                    </div>
                    <div>
                      <label class="cfg-label">Máximo</label>
                      <input type="number" [ngModel]="campoSeleccionado.max"
                        (ngModelChange)="actualizarCampo(campoSeleccionado, 'max', +$event)" class="cfg-input"/>
                    </div>
                  </div>
                </div>
              }

              <!-- FIRMA -->
              @if (campoSeleccionado.tipo === 'firma') {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Firma Digital</p>
                  <div>
                    <label class="cfg-label">Rol que firma</label>
                    <input [ngModel]="campoSeleccionado.rolFirma"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'rolFirma', $event)"
                      class="cfg-input" placeholder="Ej: Cliente, Gerente"/>
                  </div>
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      [ngModel]="campoSeleccionado.registrarFechaHora"
                      (ngModelChange)="actualizarCampo(campoSeleccionado, 'registrarFechaHora', $event)"
                      class="accent-purple-500"/>
                    <span class="text-[11px] text-slate-400">Registrar fecha/hora automáticamente</span>
                  </label>
                </div>
              }

              <!-- GRID -->
              @if (campoSeleccionado.tipo === 'grid') {
                <div class="pt-3 border-t border-white/10 space-y-3">
                  <p class="text-[9px] uppercase text-slate-500 font-bold tracking-widest">Tabla / Grid</p>
                  <!-- Columnas -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="cfg-label">Columnas</label>
                      <button (click)="agregarColumna(campoSeleccionado)"
                        class="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[12px]">add</span>Col
                      </button>
                    </div>
                    @for (col of (campoSeleccionado.tablaColumnas ?? []); track col.id; let ci = $index) {
                      <div class="flex gap-1 items-center mb-1">
                        <input [ngModel]="col.titulo"
                          (ngModelChange)="actualizarColumna(campoSeleccionado, ci, 'titulo', $event)"
                          [placeholder]="ci === 0 ? 'Concepto' : 'Col ' + (ci+1)"
                          class="cfg-input text-[11px] flex-1"/>
                        <select [ngModel]="col.tipo"
                          (ngModelChange)="actualizarColumna(campoSeleccionado, ci, 'tipo', $event)"
                          class="bg-slate-900 border border-slate-700 rounded px-1 py-1 text-[10px] text-white">
                          <option value="texto">Txt</option>
                          <option value="numero">Num</option>
                        </select>
                        <button (click)="eliminarColumna(campoSeleccionado, ci)"
                          class="text-slate-600 hover:text-red-400 shrink-0">
                          <span class="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </div>
                    }
                  </div>
                  <!-- Filas -->
                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="cfg-label">Filas predefinidas</label>
                      <button (click)="agregarFila(campoSeleccionado)"
                        class="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-0.5">
                        <span class="material-symbols-outlined text-[12px]">add</span>Fila
                      </button>
                    </div>
                    @for (fila of (campoSeleccionado.tablaFilas ?? []); track fila.id; let fi = $index) {
                      <div class="flex gap-1 items-center mb-1">
                        <input [ngModel]="fila.etiqueta"
                          (ngModelChange)="actualizarFila(campoSeleccionado, fi, $event)"
                          placeholder="Ej: Concepto A"
                          class="cfg-input text-[11px] flex-1"/>
                        <button (click)="eliminarFila(campoSeleccionado, fi)"
                          class="text-slate-600 hover:text-red-400 shrink-0">
                          <span class="material-symbols-outlined text-[12px]">close</span>
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Lógica condicional -->
              @if (formulario.campos.length > 1 || nodosAnterioresConCampos.length > 0) {
                <div class="pt-3 border-t border-white/10 space-y-2">
                  <p class="text-[9px] uppercase text-purple-400 font-bold tracking-widest flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">visibility</span>
                    Visibilidad condicional
                  </p>
                  <select
                    [ngModel]="campoSeleccionado.dependeDeCampoId"
                    (ngModelChange)="actualizarCampo(campoSeleccionado, 'dependeDeCampoId', $event)"
                    class="cfg-input text-[11px]">
                    <option [value]="undefined">Siempre visible</option>
                    <optgroup label="── Este formulario ──">
                      @for (c of formulario.campos; track $index) {
                        @if (c.id !== campoSeleccionado.id) {
                          <option [value]="c.id">{{ c.titulo }}</option>
                        }
                      }
                    </optgroup>
                    @for (grupo of nodosAnterioresConCampos; track $index) {
                      <optgroup [label]="'── Nodo: ' + grupo.nodo + ' ──'">
                        @for (c of grupo.campos; track $index) {
                          <option [value]="c.id">{{ c.titulo }}</option>
                        }
                      </optgroup>
                    }
                  </select>
                  @if (campoSeleccionado.dependeDeCampoId) {
                    <div>
                      <label class="cfg-label">Valor que activa este campo</label>
                      <input
                        [ngModel]="campoSeleccionado.dependeDeValor"
                        (ngModelChange)="actualizarCampo(campoSeleccionado, 'dependeDeValor', $event)"
                        class="cfg-input" placeholder="Ej: Sí, Activo..."/>
                    </div>
                  }
                </div>
              }

              <!-- Eliminar -->
              <div class="pt-3 border-t border-white/10">
                <button
                  (click)="eliminarCampo(campoSeleccionado)"
                  class="w-full py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5">
                  <span class="material-symbols-outlined text-[14px]">delete</span>
                  Eliminar campo
                </button>
              </div>

            </div>
          }
        </div>

        <!-- ─── VISTA PREVIA (hoja A4 simulada) ─── -->
        @if (modoPrevia) {
          <div class="flex-1 overflow-auto bg-slate-900 flex items-start justify-center py-10">
            <div style="width:820px;min-height:500px;font-family:sans-serif;box-shadow:0 8px 48px rgba(0,0,0,0.5);background:white;overflow:hidden;border-radius:4px">
              <!-- HEADER FORMAL DEL TRÁMITE -->
              <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);padding:24px 32px 20px;">
                <div style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.5);margin-bottom:6px">
                  Formulario del trámite{{ nombrePolitica ? ' · ' + nombrePolitica : '' }}
                </div>
                <h2 style="font-size:19px;font-weight:700;margin:0 0 6px;color:white">{{ formulario.nombre }}</h2>
                <p style="font-size:11px;color:rgba(255,255,255,0.6);margin:0">Complete los campos marcados con (*) para avanzar al siguiente paso.</p>
              </div>
              <!-- BARRA INFO -->
              <div style="background:#f1f5f9;border-bottom:1px solid #e2e8f0;padding:9px 32px;display:flex;align-items:center;gap:12px;">
                <span style="font-size:10px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Datos requeridos</span>
                <span style="font-size:10px;color:#94a3b8">{{ formulario.campos.length }} campo(s)</span>
              </div>
              @if (formulario.campos.length === 0) {
                <p style="color:#94a3b8;font-size:13px;text-align:center;margin-top:60px;padding:0 32px">Sin campos — agrega campos desde el diseñador.</p>
              }
              <!-- Área campos: 760px exacto = ancho canvas DETALLE → coordenadas sin offset -->
              <div style="padding:20px 30px 24px;">
                <div class="relative" style="width:760px;" [style.min-height]="calcAlturaPrevia() + 'px'">
                @for (campo of formulario.campos; track campo.id) {
                  <div class="absolute" [style.left.px]="campo.posX ?? 0" [style.top.px]="campo.posY ?? 0" [style.width.px]="campo.largoCampo || 240">
                    @if (campo.tipo !== 'label') {
                      <label style="display:block;font-size:11px;font-weight:600;color:#334155;margin-bottom:4px">
                        {{ campo.titulo }}@if (campo.obligatorio) {<span style="color:#ef4444"> *</span>}
                      </label>
                    }
                    @switch (campo.tipo) {
                      @case ('texto') {
                        <input type="text" [placeholder]="campo.placeholder || ''" disabled
                               style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;color:#94a3b8;background:#f8fafc;box-sizing:border-box"/>
                      }
                      @case ('texto_largo') {
                        <textarea rows="3" [placeholder]="campo.placeholder || ''" disabled
                                  style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;color:#94a3b8;background:#f8fafc;resize:none;box-sizing:border-box"></textarea>
                      }
                      @case ('numero') {
                        <input type="text" [placeholder]="(campo.prefijoSufijo || '') + '0'" disabled
                               style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;color:#94a3b8;background:#f8fafc;box-sizing:border-box"/>
                      }
                      @case ('lista') {
                        <select disabled style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;color:#94a3b8;background:#f8fafc;box-sizing:border-box">
                          <option>{{ campo.placeholder || 'Seleccionar...' }}</option>
                          @for (op of (campo.opciones ?? []); track $index) { <option>{{ op.label }}</option> }
                        </select>
                      }
                      @case ('si_no') {
                        <div style="display:flex;gap:20px;padding:4px 0">
                          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569"><input type="radio" disabled/> Sí</label>
                          <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#475569"><input type="radio" disabled/> No</label>
                        </div>
                      }
                      @case ('fecha') {
                        <input type="text" placeholder="DD / MM / AAAA" disabled
                               style="width:100%;border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;font-size:12px;color:#94a3b8;background:#f8fafc;box-sizing:border-box"/>
                      }
                      @case ('archivo') {
                        <div style="border:2px dashed #cbd5e1;border-radius:8px;padding:14px;text-align:center;color:#94a3b8;font-size:11px">
                          📎 Adjuntar archivo {{ campo.formatos ? '(' + campo.formatos + ')' : '' }}
                        </div>
                      }
                      @case ('firma') {
                        <div style="border:1px solid #cbd5e1;border-radius:8px;height:68px;background:#f8fafc;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px">
                          ✍ Área de firma — {{ campo.rolFirma || 'Firmante' }}
                        </div>
                      }
                      @case ('label') {
                        <div style="padding:4px 0">
                          <p style="font-size:13px;font-weight:600;color:#334155;margin:0">{{ campo.titulo }}</p>
                          @if (campo.descripcion) { <p style="font-size:11px;color:#64748b;margin:3px 0 0">{{ campo.descripcion }}</p> }
                        </div>
                      }
                      @case ('grid') {
                        <table style="width:100%;border-collapse:collapse;font-size:11px">
                          <thead>
                            <tr style="background:#f1f5f9">
                              @for (col of (campo.tablaColumnas ?? []); track col.id) {
                                <th style="border:1px solid #e2e8f0;padding:6px 8px;text-align:left;color:#475569;font-weight:600">{{ col.titulo || 'Col' }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (fila of ((campo.tablaFilas?.length ? campo.tablaFilas : [{id:'p1',etiqueta:''}])); track fila.id) {
                              <tr>
                                @for (col of (campo.tablaColumnas ?? []); track col.id; let ci = $index) {
                                  <td [style]="ci === 0 ? 'border:1px solid #e2e8f0;padding:6px 8px;color:#334155;font-weight:500' : 'border:1px solid #e2e8f0;padding:6px 8px;color:#94a3b8;font-style:italic'">
                                    {{ ci === 0 ? (fila.etiqueta || '—') : (col.tipo === 'numero' ? '0.00' : 'Rellene aquí') }}
                                  </td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      }
                    }
                    @if (campo.descripcion && campo.tipo !== 'label') {
                      <p style="font-size:10px;color:#64748b;margin-top:3px;font-style:italic">{{ campo.descripcion }}</p>
                    }
                  </div>
                }
                </div>
              </div>
              <!-- PIE FORMAL -->
              <div style="background:#f1f5f9;border-top:2px solid #e2e8f0;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:#94a3b8;font-weight:500">NexusFlow — Sistema de Gestión de Trámites</span>
                <span style="font-size:10px;color:#94a3b8">Formulario oficial · Uso interno</span>
              </div>
            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .cfg-label {
      display: block;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .cfg-input {
      width: 100%;
      background: rgba(2,6,23,0.7);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 6px;
      padding: 6px 8px;
      font-size: 12px;
      color: #e2e8f0;
      outline: none;
      transition: border-color 0.15s;
    }
    .cfg-input:focus { border-color: #a855f7; }
    .campo-widget { z-index: 10; }
    .campo-widget:hover { z-index: 20; }
    .cdk-drag-preview { opacity: 0.85; z-index: 9999 !important; }
    .cdk-drag-placeholder { opacity: 0; }
    .cdk-drag-animating { transition: transform 150ms cubic-bezier(0,0,0.2,1); }
  `],
})
export class FormularioEditorDialogComponent implements OnInit, OnDestroy {
  @Input() formulario!: Formulario;
  @Input() esquema!: EsquemaWorkflow;
  @Input() formularios: Formulario[] = [];
  @Input() nombrePolitica = '';
  @Output() actualizado = new EventEmitter<Formulario>();
  @Output() cerrar = new EventEmitter<void>();

  campoSeleccionado: CampoFormulario | null = null;
  modoPrevia = false;
  private resizeState: { campoId: string; anchoInicial: number; xInicial: number } | null = null;
  tipos = TIPOS;
  editoresRemotos: EditorRemoto[] = [];
  estadoGuardado: 'guardado' | 'guardando' | 'error' = 'guardado';

  private destroy$ = new Subject<void>();
  private guardarRest$ = new Subject<void>();
  private realtime = inject(RealtimeService);
  private auth = inject(AuthService);
  private formService = inject(FormularioService);

  // ── Nodos anteriores con campos (lógica condicional cross-nodo) ──

  get nodosAnterioresConCampos(): { nodo: string; campos: CampoFormulario[] }[] {
    if (!this.esquema || !this.formulario) return [];
    const pasoActual = this.esquema.pasos.find(p => p.formularioId === this.formulario.id);
    if (!pasoActual) return [];
    const ancestrosIds = new Set<string>();
    const buscarPadres = (hijoId: string) => {
      for (const rel of this.esquema.relaciones.filter(r => r.destinoId === hijoId)) {
        if (!ancestrosIds.has(rel.padreId)) {
          ancestrosIds.add(rel.padreId);
          buscarPadres(rel.padreId);
        }
      }
    };
    buscarPadres(pasoActual.id);
    return this.esquema.pasos
      .filter(p => ancestrosIds.has(p.id) && p.formularioId)
      .map(p => {
        const f = this.formularios.find(form => form.id === p.formularioId);
        return { nodo: p.nombre, campos: f ? f.campos : [] };
      })
      .filter(x => x.campos.length > 0);
  }

  // ── Lifecycle ──

  ngOnInit(): void {
    this.realtime
      .camposFormulario(this.formulario.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(msg => this.aplicarMensajeRemoto(msg));

    this.realtime
      .cursoresFormulario(this.formulario.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((c: CursorFormularioDto) => this.aplicarCursorRemoto(c));

    this.guardarRest$
      .pipe(takeUntil(this.destroy$), debounceTime(800))
      .subscribe(() => this.persistirFormularioREST());
  }

  ngOnDestroy(): void {
    this.persistirFormularioREST();
    this.destroy$.next();
    this.destroy$.complete();
    this.realtime.unsubscribe(`/topic/formulario/${this.formulario.id}/campos`);
    this.realtime.unsubscribe(`/topic/editor/${this.formulario.id}/cursores-form`);
  }

  // ── Paleta: agregar campo ──

  canvasDragOver = false;

  onPaletteDragStart(event: DragEvent, tipo: TipoCampo): void {
    event.dataTransfer!.setData('tipo', tipo);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'copy';
    this.canvasDragOver = true;
  }

  onCanvasDrop(event: DragEvent, detalleEl: HTMLElement): void {
    event.preventDefault();
    this.canvasDragOver = false;
    const tipo = event.dataTransfer?.getData('tipo') as TipoCampo;
    if (!tipo) return;
    const rect = detalleEl.getBoundingClientRect();
    const posX = Math.max(0, Math.round(event.clientX - rect.left));
    const posY = Math.max(0, Math.round(event.clientY - rect.top));
    this.crearCampoEnPosicion(tipo, posX, posY);
  }

  agregarDesdePaleta(tipo: TipoCampo): void {
    const cant = this.formulario.campos.length;
    const col = cant % 3;
    const row = Math.floor(cant / 3);
    this.crearCampoEnPosicion(tipo, 20 + col * 280, 20 + row * 140);
  }

  private crearCampoEnPosicion(tipo: TipoCampo, posX: number, posY: number): void {
    const cant = this.formulario.campos.length;
    const campo: CampoFormulario = {
      id: cryptoId(),
      formularioId: this.formulario.id,
      tipo,
      titulo: this.etiquetaTipo(tipo),
      placeholder: '',
      descripcion: '',
      obligatorio: false,
      orden: cant + 1,
      posX,
      posY,
      largoCampo: 240,
      ...(tipo === 'lista'   ? { opciones: [], multiple: false, permitirOtro: false } : {}),
      ...(tipo === 'archivo' ? { formatos: '', cantidadMaxima: 1 } : {}),
      ...(tipo === 'fecha'   ? { formatoFecha: 'corta', incluyeHora: false } : {}),
      ...(tipo === 'numero'  ? { subtipoNumero: 'general', prefijoSufijo: '' } : {}),
      ...(tipo === 'firma'   ? { rolFirma: '', registrarFechaHora: true } : {}),
      ...(tipo === 'grid'    ? { tablaColumnas: [], tablaFilas: [] } : {}),
    };
    this.formulario.campos = [...this.formulario.campos, campo];
    this.campoSeleccionado = campo;
    this.actualizado.emit(this.formulario);
    this.emitirCambio(campo.id, 'crear', campo);
    this.guardarRest$.next();
  }

  // ── Canvas: selección y drag ──

  seleccionarCampo(campo: CampoFormulario): void {
    this.campoSeleccionado = campo;
    this.reportarFoco(campo.id);
  }

  onDragEnded(event: CdkDragEnd, campo: CampoFormulario): void {
    const pos = event.source.getFreeDragPosition();
    const x = Math.max(0, Math.round(pos.x));
    const y = Math.max(0, Math.round(pos.y));
    this.actualizarCampo(campo, 'posX', x);
    this.actualizarCampo(campo, 'posY', y);
  }

  // ── CRUD ──

  actualizarCampo(campo: CampoFormulario, atributo: keyof CampoFormulario, valor: any): void {
    // Always mutate the live array item — campo may be a stale copy after the first call
    const live = this.formulario.campos.find(c => c.id === campo.id);
    if (live) (live as any)[atributo] = valor;
    (campo as any)[atributo] = valor;
    this.formulario.campos = [...this.formulario.campos];
    // Point campoSeleccionado to the live reference, not a copy
    if (live && this.campoSeleccionado?.id === campo.id) {
      this.campoSeleccionado = live;
    }
    this.actualizado.emit(this.formulario);
    this.emitirCambio(campo.id, atributo as string, valor);
    this.guardarRest$.next();
  }

  eliminarCampo(campo: CampoFormulario): void {
    this.formulario.campos = this.formulario.campos.filter(c => c.id !== campo.id);
    if (this.campoSeleccionado?.id === campo.id) this.campoSeleccionado = null;
    this.actualizado.emit(this.formulario);
    this.emitirCambio(campo.id, 'eliminar', null);
    this.guardarRest$.next();
  }

  // ── Grid helpers ──

  agregarColumna(campo: CampoFormulario): void {
    const cols: ColumnaTabla[] = [...(campo.tablaColumnas ?? [])];
    cols.push({ id: cryptoId(), titulo: cols.length === 0 ? 'Concepto' : '', tipo: 'texto' });
    this.actualizarCampo(campo, 'tablaColumnas', cols);
  }

  eliminarColumna(campo: CampoFormulario, idx: number): void {
    const cols = [...(campo.tablaColumnas ?? [])];
    cols.splice(idx, 1);
    this.actualizarCampo(campo, 'tablaColumnas', cols);
  }

  actualizarColumna(campo: CampoFormulario, idx: number, attr: 'titulo' | 'tipo', valor: any): void {
    const cols = [...(campo.tablaColumnas ?? [])];
    cols[idx] = { ...cols[idx], [attr]: valor };
    this.actualizarCampo(campo, 'tablaColumnas', cols);
  }

  agregarFila(campo: CampoFormulario): void {
    const filas: FilaTabla[] = [...(campo.tablaFilas ?? [])];
    filas.push({ id: cryptoId(), etiqueta: '' });
    this.actualizarCampo(campo, 'tablaFilas', filas);
  }

  eliminarFila(campo: CampoFormulario, idx: number): void {
    const filas = [...(campo.tablaFilas ?? [])];
    filas.splice(idx, 1);
    this.actualizarCampo(campo, 'tablaFilas', filas);
  }

  actualizarFila(campo: CampoFormulario, idx: number, valor: string): void {
    const filas = [...(campo.tablaFilas ?? [])];
    filas[idx] = { ...filas[idx], etiqueta: valor };
    this.actualizarCampo(campo, 'tablaFilas', filas);
  }

  // ── Archivo helpers ──

  readonly formatosDisponibles = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx', '.mp4', '.zip', '.txt', '.csv'];

  tieneFormato(campo: CampoFormulario, fmt: string): boolean {
    return (campo.formatos ?? '').split(',').map(f => f.trim()).includes(fmt);
  }

  toggleFormato(campo: CampoFormulario, fmt: string, checked: boolean): void {
    const actual = (campo.formatos ?? '').split(',').map(f => f.trim()).filter(f => f.length > 0);
    const nuevo = checked ? [...new Set([...actual, fmt])] : actual.filter(f => f !== fmt);
    this.actualizarCampo(campo, 'formatos', nuevo.join(', '));
  }

  // ── Realtime ──

  private emitirCambio(campoId: string, atributo: string, valor: any): void {
    const usuario = this.auth.getUsuario();
    if (!usuario) return;
    this.realtime.emitirCampoFormulario({
      formularioId: this.formulario.id,
      campoId,
      atributo,
      valor,
      usuarioId: usuario.id ?? usuario.email ?? '',
      usuarioNombre: usuario.nombre ?? 'Usuario',
    });
  }

  private aplicarMensajeRemoto(msg: any): void {
    if (!msg || msg.formularioId !== this.formulario.id) return;
    const miId = this.auth.getUsuario()?.id ?? this.auth.getUsuario()?.email ?? '';
    if (msg.usuarioId === miId) return;
    if (msg.atributo === 'crear' && msg.valor) {
      if (!this.formulario.campos.find(c => c.id === msg.valor.id)) {
        this.formulario.campos = [...this.formulario.campos, msg.valor];
      }
    } else if (msg.atributo === 'eliminar') {
      this.formulario.campos = this.formulario.campos.filter(c => c.id !== msg.campoId);
      if (this.campoSeleccionado?.id === msg.campoId) this.campoSeleccionado = null;
    } else {
      this.formulario.campos = this.formulario.campos.map(c =>
        c.id === msg.campoId ? { ...c, [msg.atributo]: msg.valor } : c,
      );
      if (this.campoSeleccionado?.id === msg.campoId) {
        const updated = this.formulario.campos.find(c => c.id === msg.campoId);
        if (updated) this.campoSeleccionado = { ...updated };
      }
    }
    this.actualizado.emit(this.formulario);
  }

  reportarFoco(campoId: string | undefined): void {
    const usuario = this.auth.getUsuario();
    if (!usuario) return;
    const uid = usuario.id ?? usuario.email ?? '';
    this.realtime.emitirCursorFormulario({
      formularioId: this.formulario.id,
      usuarioId: uid,
      usuarioNombre: usuario.nombre ?? 'Usuario',
      color: this.realtime.colorParaUsuario(uid),
      campoId,
    });
  }

  private aplicarCursorRemoto(c: CursorFormularioDto): void {
    const miId = this.auth.getUsuario()?.id ?? this.auth.getUsuario()?.email ?? '';
    if (c.usuarioId === miId) return;
    const existente = this.editoresRemotos.find(e => e.usuarioId === c.usuarioId);
    if (!c.campoId) {
      this.editoresRemotos = this.editoresRemotos.filter(e => e.usuarioId !== c.usuarioId);
    } else if (existente) {
      existente.campoId = c.campoId;
    } else {
      this.editoresRemotos.push({ ...c });
    }
  }

  campoDestacadoColor(campoId: string): string | undefined {
    return this.editoresRemotos.find(e => e.campoId === campoId)?.color;
  }

  private persistirFormularioREST(): void {
    if (!this.formulario?.id) return;
    this.estadoGuardado = 'guardando';
    this.formService.actualizar(this.formulario.id, this.formulario).subscribe({
      next: () => (this.estadoGuardado = 'guardado'),
      error: () => (this.estadoGuardado = 'error'),
    });
  }

  // ── Display helpers ──

  iniciarResize(event: MouseEvent, campo: CampoFormulario): void {
    event.stopPropagation();
    event.preventDefault();
    this.resizeState = { campoId: campo.id, anchoInicial: campo.largoCampo || 240, xInicial: event.clientX };
  }

  @HostListener('document:mousemove', ['$event'])
  onDocMouseMove(event: MouseEvent): void {
    if (!this.resizeState) return;
    const delta = event.clientX - this.resizeState.xInicial;
    const nuevoAncho = Math.max(120, Math.min(700, this.resizeState.anchoInicial + delta));
    const campo = this.formulario.campos.find(c => c.id === this.resizeState!.campoId);
    if (campo) {
      campo.largoCampo = nuevoAncho;
      this.formulario.campos = [...this.formulario.campos];
      if (this.campoSeleccionado?.id === campo.id) this.campoSeleccionado = { ...campo };
    }
  }

  @HostListener('document:mouseup')
  onDocMouseUp(): void {
    if (!this.resizeState) return;
    const campo = this.formulario.campos.find(c => c.id === this.resizeState!.campoId);
    if (campo) { this.actualizado.emit(this.formulario); this.guardarRest$.next(); }
    this.resizeState = null;
  }

  calcAlturaPrevia(): number {
    const campos = this.formulario?.campos ?? [];
    if (!campos.length) return 560;
    return Math.max(560, ...campos.map(c => (c.posY ?? 0) + 100));
  }

  getCampoColor(tipo: TipoCampo): string { return CAMPO_COLORS[tipo] ?? '#64748b'; }
  getCampoIcon(tipo: TipoCampo): string  { return CAMPO_ICONS[tipo]  ?? 'input'; }
  getCampoPreview(tipo: TipoCampo): string { return CAMPO_PREVIEWS[tipo] ?? ''; }

  etiquetaTipo(tipo: TipoCampo): string {
    return this.formService.etiquetaTipo(tipo);
  }

  opcionesToText(campo: CampoFormulario): string {
    return (campo.opciones || []).map(o => o.label).join('\n');
  }

  textToOpciones(texto: string): { label: string; valor: string }[] {
    return (texto || '').split('\n').map(o => o.trim()).filter(o => !!o).map(o => ({ label: o, valor: o }));
  }
}

function cryptoId(): string {
  return Math.random().toString(36).substring(2, 9);
}
