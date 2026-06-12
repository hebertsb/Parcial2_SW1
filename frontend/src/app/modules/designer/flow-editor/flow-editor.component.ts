import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  AfterViewInit,
  ViewChild,
  computed,
  inject,
  signal,
  NgZone,
  effect
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  FFlowModule,
  FCanvasComponent,
  FCreateConnectionEvent,
} from '@foblex/flow';
import { Subject, auditTime, takeUntil, forkJoin } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import {
  Carril,
  CampoFormulario,
  EsquemaWorkflow,
  FlujoRelacion,
  Paso,
  TipoCampo,
  TipoPaso,
} from '../../../core/models/flujo.models';

import { AuthService } from '../../../core/services/auth.service';
import { EditorCambioDto, CursorEditorDto } from '../../../core/models/realtime.models';
import { FlujoEditorService } from '../../../core/services/flujo-editor.service';
import { FormularioService } from '../../../core/services/formulario.service';
import { PoliticaService } from '../../../core/services/politica.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { UnidadService } from '../../../core/services/unidad.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { IaAssistantService } from '../../../core/services/ia-assistant.service';
import { environment } from '../../../../environments/environment';

import { PasoNodeComponent } from './nodes/paso-node.component';
import { PasoEditDialogComponent } from './dialogs/paso-edit.dialog';
import { CondicionEditDialogComponent } from './dialogs/condicion-edit.dialog';
import { CampoConfigDialogComponent } from './dialogs/campo-config.dialog';
import { FormularioEditorDialogComponent } from './dialogs/formulario-editor.dialog';

@Component({
  selector: 'app-flow-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FFlowModule,
    PasoNodeComponent,
    PasoEditDialogComponent,
    CondicionEditDialogComponent,
    CampoConfigDialogComponent,
    FormularioEditorDialogComponent
  ],
  template: `
    <div class="designer-container glass-theme">
      <!-- HEADER PREMIUM -->
      <header class="designer-header">
        <div class="header-left">
          <button (click)="volver()" class="btn-icon">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="breadcrumb">
            <span class="label">DISEÑADOR DE WORKFLOW</span>
            <h1 class="title">{{ politicaNombre() }} <span class="text-xs text-blue-400">({{ esquema().pasos.length }} nodos)</span></h1>
          </div>
        </div>

        <div class="header-right">
          <!-- Indicador de guardado reactivo -->
          @if (estadoGuardado() === 'guardando') {
            <div class="status-indicator saving">
              <span class="pulse-dot"></span> Guardando...
            </div>
          } @else if (estadoGuardado() === 'error') {
            <div class="status-indicator error">
              <span class="material-symbols-outlined" style="font-size:14px">error</span> Error al guardar
            </div>
          } @else {
            <div class="status-indicator sync">
              <span class="pulse-dot"></span> Sincronizado
            </div>
          }
          <!-- Colaboradores activos -->
          @if (cursoresArray().length > 0) {
            <div class="colaboradores-badge">
              <span class="material-symbols-outlined">group</span>
              {{ cursoresArray().length + 1 }} editando
            </div>
          }
          <button (click)="exportarUML()" class="btn-secondary" title="Exportar diagrama como XMI UML 2.5">
            <span class="material-symbols-outlined">download</span>
            <span>UML 2.5</span>
          </button>
          <button (click)="ejecutarValidacion()" class="btn-secondary" title="Validar diagrama UML"
                  [style.border-color]="validacionErrores().length > 0 ? '#f97316' : ''">
            <span class="material-symbols-outlined" [style.color]="validacionErrores().length > 0 ? '#f97316' : ''">rule</span>
            <span>Validar</span>
            @if (validacionErrores().length > 0) {
              <span style="background:#f97316;color:white;border-radius:9px;padding:1px 6px;font-size:10px;font-weight:700;margin-left:2px;">{{ validacionErrores().length }}</span>
            }
          </button>
          <button (click)="mostrarIAPanel.set(true); iaError.set(null); modoIA.set('generar')" class="btn-secondary btn-ai" title="Generar flujo con IA">
            <span class="material-symbols-outlined">auto_awesome</span>
            <span>Generar IA</span>
          </button>
          <button (click)="abrirNuevoPaso()" class="btn-primary glow-effect">
            <span class="material-symbols-outlined">add_circle</span>
            <span>Nuevo Paso</span>
          </button>
        </div>
      </header>

      <!-- PANEL DE VALIDACIÓN -->
      @if (mostrarValidacion()) {
        <div style="background:#0f172a;border-bottom:1px solid rgba(249,115,22,0.4);padding:10px 16px;display:flex;align-items:flex-start;gap:10px;z-index:200;">
          <span class="material-symbols-outlined" style="color:#f97316;font-size:18px;margin-top:1px;flex-shrink:0;">
            {{ validacionErrores().length === 0 ? 'check_circle' : 'warning' }}
          </span>
          <div style="flex:1">
            @if (validacionErrores().length === 0) {
              <p style="color:#4ade80;font-size:12px;font-weight:700;">Diagrama válido — cumple todas las reglas UML de diagrama de actividad.</p>
            } @else {
              <p style="color:#fb923c;font-size:11px;font-weight:700;margin-bottom:4px;">{{ validacionErrores().length }} error(es) encontrado(s):</p>
              @for (err of validacionErrores(); track $index) {
                <p style="color:#fca5a5;font-size:11px;margin-bottom:2px;">• {{ err }}</p>
              }
            }
          </div>
          <button (click)="mostrarValidacion.set(false)" style="color:#64748b;background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:0;">✕</button>
        </div>
      }

      <!-- BODY: PALETA + CANVAS -->
      <div class="editor-body">

        <!-- PALETA DE NODOS (drag desde aquí al canvas) -->
        <div class="node-palette">
          <p class="palette-title">FLUJO</p>

          <div class="palette-item palette-inicio"
               draggable="true"
               (dragstart)="onPaletteDrag('INICIO', $event)"
               title="Nodo de inicio del flujo">
            <div class="palette-icon"><span class="material-symbols-outlined">radio_button_checked</span></div>
            <span>Inicio</span>
          </div>

          <div class="palette-item palette-tarea"
               draggable="true"
               (dragstart)="onPaletteDrag('TAREA', $event)"
               title="Actividad / tarea del flujo">
            <div class="palette-icon"><span class="material-symbols-outlined">task_alt</span></div>
            <span>Tarea</span>
          </div>

          <div class="palette-item palette-gateway"
               draggable="true"
               (dragstart)="onPaletteDrag('GATEWAY', $event)"
               title="Nodo de decisión / compuerta">
            <div class="palette-icon"><span class="material-symbols-outlined">device_hub</span></div>
            <span>Decisión</span>
          </div>

          <div class="palette-item palette-fin"
               draggable="true"
               (dragstart)="onPaletteDrag('FIN', $event)"
               title="Nodo final del flujo">
            <div class="palette-icon"><span class="material-symbols-outlined">stop_circle</span></div>
            <span>Fin</span>
          </div>

          <div class="palette-divider"></div>
          <p class="palette-title" style="margin-top:2px">ESTRUCTURA</p>

          <div class="palette-item palette-carril"
               (click)="agregarCarril()"
               title="Añadir un carril horizontal al diagrama">
            <div class="palette-icon"><span class="material-symbols-outlined">view_agenda</span></div>
            <span>Carril</span>
          </div>

          <div class="palette-divider"></div>
          <p class="palette-hint">Arrastra al canvas · Click en Carril</p>
        </div>

        <!-- CANVAS DE FOBLEX -->
        <div class="canvas-wrapper"
             (mousemove)="onCanvasMouseMove($event)"
             (dragover)="onCanvasDragOver($event)"
             (drop)="onCanvasDrop($event)">

          <!-- SWIMLANES OVERLAY — fuera de f-canvas (ng-content de foblex no acepta divs planos),
               sincronizado con el transform de f-canvas vía requestAnimationFrame -->
          <div #lanesOverlayRef
               style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;transform-origin:0 0;z-index:2;">
            @for (carril of carriles(); track carril.id; let i = $index) {
              <div style="position:absolute;width:8000px;pointer-events:none;"
                   [style.top.px]="i * LANE_HEIGHT"
                   [style.height.px]="LANE_HEIGHT"
                   [style.background]="i % 2 === 0 ? 'rgba(37,99,235,0.13)' : 'rgba(2,6,28,0.32)'"
                   [style.borderBottom]="'2px solid rgba(59,130,246,0.45)'">
                <div class="lane-header" (click)="$event.stopPropagation()">
                  <span class="lane-num">{{ i + 1 }}</span>
                  @if (editingLaneId() === carril.id) {
                    <input class="lane-name-input" type="text"
                           [value]="editingLaneName()"
                           (input)="editingLaneName.set($any($event.target).value)"
                           (blur)="finishEditLane()"
                           (keyup.enter)="finishEditLane()"
                           (keyup.escape)="editingLaneId.set(null)"
                           (click)="$event.stopPropagation()"
                           (mousedown)="$event.stopPropagation()" />
                  } @else {
                    <span class="lane-name" (dblclick)="startEditLane(carril.id); $event.stopPropagation()" title="Doble clic para editar">{{ carril.nombre }}</span>
                  }
                  @if (carril.id === 'cliente' || carril.departamentoId === 'cliente' || (carril.nombre ?? '').toLowerCase().includes('cliente')) {
                    <span style="font-size:9px;color:#93c5fd;font-weight:600;background:rgba(59,130,246,0.12);padding:2px 5px;border-radius:4px;margin-top:2px;">
                      🧑 Carril del Cliente
                    </span>
                  } @else if (carril.funcionarioAsignadoNombre) {
                    <span style="font-size:9px;color:#86efac;font-weight:600;background:rgba(0,255,100,0.07);padding:2px 5px;border-radius:4px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;" title="Funcionario asignado">
                      👤 {{ carril.funcionarioAsignadoNombre }}
                    </span>
                  } @else {
                    <span style="font-size:9px;color:#f59e0b;font-weight:600;background:rgba(245,158,11,0.1);padding:2px 5px;border-radius:4px;margin-top:2px;">
                      ⚠ Sin funcionario asignado
                    </span>
                  }
                  <div class="lane-actions">
                    <button class="lane-btn" (click)="editarCarril(carril.id); $event.stopPropagation()" title="Asignar funcionario / editar carril" style="color:#60a5fa;">
                      <span class="material-symbols-outlined">manage_accounts</span>
                    </button>
                    <button class="lane-btn" (click)="startEditLane(carril.id); $event.stopPropagation()" title="Editar nombre">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="lane-btn lane-btn-up" (click)="moverCarrilArriba(carril.id); $event.stopPropagation()" [disabled]="i === 0" title="Subir">
                      <span class="material-symbols-outlined">keyboard_arrow_up</span>
                    </button>
                    <button class="lane-btn lane-btn-down" (click)="moverCarrilAbajo(carril.id); $event.stopPropagation()" [disabled]="i === carriles().length - 1" title="Bajar">
                      <span class="material-symbols-outlined">keyboard_arrow_down</span>
                    </button>
                    <button class="lane-btn lane-btn-delete" (click)="eliminarCarril(carril.id); $event.stopPropagation()" title="Eliminar">
                      <span class="material-symbols-outlined">close</span>
                    </button>
                  </div>
                </div>
              </div>
            }
            <div class="lane-add"
                 [style.top.px]="carriles().length * LANE_HEIGHT"
                 style="position:absolute;width:180px;height:44px;background:rgba(4,8,20,0.9);border:1px dashed rgba(59,130,246,0.35);display:flex;align-items:center;justify-content:center;gap:6px;font-size:10px;color:#475569;cursor:pointer;pointer-events:auto;transition:all 0.2s;letter-spacing:0.04em;font-weight:600;"
                 (click)="agregarCarril(); $event.stopPropagation()">
              <span class="material-symbols-outlined">add</span> Añadir carril
            </div>
          </div>

        <f-flow
          #fFlow
          fDraggable
          (fFullRendered)="onFlowFullRendered()"
          (fCreateConnection)="onCreateConnection($event)"
          (fReassignConnection)="onReassignConnection($event)"
          class="custom-flow"
        >
          <!-- Fondo elegante -->
          <f-background>
            <f-rect-pattern />
          </f-background>

          <f-canvas #fCanvas fZoom>

            <f-connection-for-create fType="segment">
              <f-connection-marker-arrow type="END" class="custom-arrow"></f-connection-marker-arrow>
            </f-connection-for-create>

            <!-- CONEXIONES -->
            @for (rel of esquema().relaciones; track $index) {
              <f-connection
                [fOutputId]="rel.puertoSalida || (rel.padreId + '-out-sig')"
                [fInputId]="rel.destinoId + '-in'"
                [attr.data-tipo]="rel.tipo"
                [fReassignableStart]="true"
                fType="segment"
              >
                <f-connection-marker-arrow type="END" class="custom-arrow"></f-connection-marker-arrow>

                <div fConnectionContent class="rel-pill" [class.condicional]="rel.tipo === 'condicional' || !!rel.condicion" (click)="editarCondicion(rel)">
                   <span>{{ getConnectionLabel(rel) }}</span>
                   <button class="delete-conn" (click)="eliminarRelacion(rel, $event)" title="Eliminar conexión">
                     <span class="material-symbols-outlined">close</span>
                   </button>
                </div>
              </f-connection>
            }

            <!-- NODOS (PASOS) -->
            @for (paso of esquema().pasos; track $index) {
              <app-paso-node
                fNode
                [fNodeId]="paso.id"
                [fNodePosition]="{ x: paso.x, y: paso.y }"
                (fNodePositionChange)="onNodeMoved(paso.id, $event)"
                [paso]="paso"
                [selected]="pasoSeleccionadoId() === paso.id"
                [formularios]="formularios()"
                (click)="pasoSeleccionadoId.set(paso.id)"
                (editar)="abrirEditarPaso(paso)"
                (eliminar)="eliminarPaso(paso)"
                (condicion)="abrirCondicion(paso)"
              ></app-paso-node>
            }
          </f-canvas>
        </f-flow>

        <!-- Cursores remotos: overlay sincronizado con la transformación del canvas (funciona en móvil/tablet) -->
        <div #cursorsOverlayRef
             style="position:absolute;left:0;top:0;pointer-events:none;overflow:visible;transform-origin:0 0;z-index:99999;">
          @for (cursor of cursoresArray(); track cursor.usuarioId) {
            <div class="remote-cursor"
                 [style.left.px]="cursor.x"
                 [style.top.px]="cursor.y">
              <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                <path d="M0 0L0 16L4.5 12L7.5 19L9.5 18L6.5 11L12 11L0 0Z" [attr.fill]="cursor.color" stroke="white" stroke-width="1.5"/>
              </svg>
              <span class="cursor-label" [style.background-color]="cursor.color">{{ cursor.usuarioNombre }}</span>
            </div>
          }
        </div>
      </div><!-- /canvas-wrapper -->
      </div><!-- /editor-body -->

      <!-- MODALES -->
      @if (pasoEdit()) {
        <div class="overlay">
          <app-paso-edit-dialog
            [paso]="pasoEdit()!"
            [padreIdInicial]="padreIdActualParaPaso()"
            [formulariosDisponibles]="formularios()"
            [pasosDisponibles]="esquema().pasos"
            [departamentos]="departamentos()"
            (guardar)="guardarPasoEditado($event)"
            (cerrar)="pasoEdit.set(null)"
      (crearFormulario)="abrirEditorFormulario(null, $event)"
      (abrirFormulario)="abrirEditorFormulario($event)"
          ></app-paso-edit-dialog>
        </div>
      }

      @if (condicionEdit()) {
        <div class="overlay">
          <app-condicion-edit-dialog
            [condicion]="condicionEdit()"
            [camposPadre]="camposPadreCondicion()"
            (guardar)="guardarCondicion($event)"
            (cerrar)="condicionEdit.set(null)"
          ></app-condicion-edit-dialog>
        </div>
      }

      <!-- Modal editor de formulario -->
      @if (formularioEdit()) {
        <div class="overlay">
          <app-formulario-editor-dialog
            [formulario]="formularioEdit()!"
            [esquema]="esquema()"
            [formularios]="formularios()"
            [nombrePolitica]="politicaNombre()"
            (actualizado)="onFormularioActualizado($event)"
            (cerrar)="formularioEdit.set(null)"
          ></app-formulario-editor-dialog>
        </div>
      }

      @if (campoConfigFormId()) {
        <div class="overlay">
          <app-campo-config-dialog
            [tipoInicial]="campoConfigTipo()"
            [camposDisponibles]="camposDisponiblesParaCampo()"
            (guardar)="guardarCampoConfigurado($event)"
            (cerrar)="cerrarCampoConfiguracion()"
          ></app-campo-config-dialog>
        </div>
      }

      <!-- MODAL CONFIRMAR ELIMINAR -->
      @if (nodoEliminar()) {
        <div class="overlay" (click)="nodoEliminar.set(null)">
          <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div
              class="w-full max-w-sm bg-[#0f172a]/80 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] p-6 text-slate-100"
              (click)="$event.stopPropagation()"
            >
              <div class="flex items-center gap-3 mb-4 text-red-400">
                <span class="material-symbols-outlined text-[32px]">warning</span>
                <h3 class="text-lg font-bold text-white">Eliminar Paso</h3>
              </div>
              <p class="text-sm text-slate-300 mb-6">
                ¿Estás seguro de que deseas eliminar permanentemente el paso <strong class="text-white">"{{ nodoEliminar()?.nombre }}"</strong>? Todas las conexiones asociadas también se perderán.
              </p>
              <div class="flex gap-3 mt-4">
                <button
                  (click)="nodoEliminar.set(null)"
                  class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
                <button
                  (click)="confirmarEliminacion()"
                  class="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl py-2.5 text-sm font-semibold shadow-[0_4px_15px_rgba(239,68,68,0.4)] transition-all transform hover:-translate-y-0.5"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- MODAL GENERAR / EDITAR CON IA -->
      @if (mostrarIAPanel()) {
        <div class="overlay" (click)="mostrarIAPanel.set(false)" style="background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);">
          <div class="ia-panel" (click)="$event.stopPropagation()" style="width:560px; max-width:95vw; border-radius:16px; border:1px solid rgba(139,92,246,0.25); box-shadow:0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05); background:linear-gradient(145deg,#0f172a,#1e1b4b); padding:24px;">

            <!-- Header -->
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
              <div style="width:40px; height:40px; border-radius:10px; background:linear-gradient(135deg,#7c3aed,#4f46e5); display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                <span class="material-symbols-outlined" style="color:white; font-size:22px;">auto_awesome</span>
              </div>
              <div style="flex:1;">
                <h3 style="margin:0; font-size:18px; font-weight:700; color:#f1f5f9;">
                  {{ modoIA() === 'generar' ? 'Generar Flujo con IA' : 'Editar Flujo con IA' }}
                </h3>
                <p style="margin:2px 0 0; font-size:12px; color:#64748b;">Potenciado por Llama 3.3 + Whisper</p>
              </div>
              <button (click)="mostrarIAPanel.set(false)" style="width:32px; height:32px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); cursor:pointer; display:flex; align-items:center; justify-content:center; color:#94a3b8; transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <span class="material-symbols-outlined" style="font-size:18px;">close</span>
              </button>
            </div>

            <!-- Tabs -->
            <div style="display:flex; gap:6px; margin-bottom:20px; background:rgba(0,0,0,0.3); border-radius:10px; padding:4px;">
              <button (click)="modoIA.set('generar'); iaError.set(null)"
                style="flex:1; padding:9px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px;"
                [style.background]="modoIA() === 'generar' ? 'linear-gradient(135deg,rgba(124,58,237,0.5),rgba(79,70,229,0.5))' : 'transparent'"
                [style.color]="modoIA() === 'generar' ? '#c4b5fd' : '#64748b'"
                [style.boxShadow]="modoIA() === 'generar' ? '0 2px 8px rgba(124,58,237,0.3)' : 'none'">
                <span style="font-size:16px;">✨</span> Generar desde cero
              </button>
              <button (click)="modoIA.set('editar'); iaError.set(null)"
                style="flex:1; padding:9px 16px; border-radius:8px; border:none; cursor:pointer; font-size:13px; font-weight:600; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px;"
                [style.background]="modoIA() === 'editar' ? 'linear-gradient(135deg,rgba(59,130,246,0.4),rgba(37,99,235,0.4))' : 'transparent'"
                [style.color]="modoIA() === 'editar' ? '#93c5fd' : '#64748b'"
                [style.boxShadow]="modoIA() === 'editar' ? '0 2px 8px rgba(59,130,246,0.25)' : 'none'">
                <span style="font-size:16px;">✏️</span> Editar con instrucción
              </button>
            </div>

            <!-- Modo GENERAR -->
            @if (modoIA() === 'generar') {
              <p style="font-size:13px; color:#64748b; margin:0 0 12px; line-height:1.5;">
                Describe el proceso completo. La IA creará todos los nodos, calles y formularios automáticamente.
              </p>

              <!-- Textarea + mic -->
              <div style="position:relative; margin-bottom:16px;">
                <textarea [(ngModel)]="descripcionIA" class="ia-textarea" rows="5"
                  style="width:100%; resize:vertical; padding:14px 48px 14px 16px; font-size:14px; line-height:1.6; border-radius:10px; border:1px solid rgba(139,92,246,0.2); background:rgba(0,0,0,0.25); color:#e2e8f0; outline:none; box-sizing:border-box; transition:border 0.2s;"
                  placeholder="Ej: Flujo de crédito donde el cliente presenta documentos, el analista valida, el comité de riesgo aprueba o rechaza la solicitud..."></textarea>

                <!-- Botón micrófono grande -->
                <button (click)="toggleGrabacion()" title="Dictar por voz"
                  style="position:absolute; bottom:12px; right:12px; width:36px; height:36px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; z-index:10;"
                  [style.background]="grabandoVoz() ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(139,92,246,0.25)'"
                  [style.boxShadow]="grabandoVoz() ? '0 0 0 4px rgba(239,68,68,0.25), 0 0 20px rgba(239,68,68,0.4)' : '0 0 0 1px rgba(139,92,246,0.3)'">
                  <span class="material-symbols-outlined" style="font-size:20px;" [style.color]="grabandoVoz() ? 'white' : '#a78bfa'">
                    {{ grabandoVoz() ? 'stop_circle' : 'mic' }}
                  </span>
                </button>
              </div>

              <!-- Estado de grabación -->
              @if (grabandoVoz()) {
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2);">
                  <span style="width:8px; height:8px; border-radius:50%; background:#ef4444; animation:pulse 1s infinite;"></span>
                  <span style="font-size:13px; color:#fca5a5;">Grabando... Habla ahora. Clic en ⬛ para detener.</span>
                </div>
              }
              @if (generandoIA() && !grabandoVoz()) {
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(124,58,237,0.1); border:1px solid rgba(124,58,237,0.2);">
                  <span class="ia-spinner"></span>
                  <span style="font-size:13px; color:#c4b5fd;">Transcribiendo o generando diagrama...</span>
                </div>
              }

              <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button (click)="mostrarIAPanel.set(false)"
                  style="padding:10px 20px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#94a3b8; cursor:pointer; font-size:14px; font-weight:500;">
                  Cancelar
                </button>
                <button (click)="generarConIA()" [disabled]="generandoIA() || (!descripcionIA.trim() && !grabandoVoz())"
                  style="padding:10px 24px; border-radius:8px; border:none; cursor:pointer; font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; transition:all 0.2s;"
                  [style.background]="generandoIA() || (!descripcionIA.trim() && !grabandoVoz()) ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg,#7c3aed,#4f46e5)'"
                  [style.color]="generandoIA() || (!descripcionIA.trim() && !grabandoVoz()) ? '#6b7280' : 'white'"
                  [style.boxShadow]="generandoIA() || (!descripcionIA.trim() && !grabandoVoz()) ? 'none' : '0 4px 15px rgba(124,58,237,0.4)'">
                  @if (generandoIA() && !grabandoVoz()) { <span class="ia-spinner"></span> Generando... }
                  @else { <span class="material-symbols-outlined" style="font-size:18px;">auto_fix_high</span> Generar diagrama }
                </button>
              </div>
            }

            <!-- Modo EDITAR -->
            @if (modoIA() === 'editar') {
              <p style="font-size:13px; color:#64748b; margin:0 0 12px; line-height:1.5;">
                Dile exactamente qué cambiar: agregar/eliminar carriles, renombrar nodos, añadir pasos, cambiar conexiones.
              </p>

              <div style="position:relative; margin-bottom:16px;">
                <textarea [(ngModel)]="instruccionEdicion" class="ia-textarea" rows="4"
                  style="width:100%; resize:vertical; padding:14px 48px 14px 16px; font-size:14px; line-height:1.6; border-radius:10px; border:1px solid rgba(59,130,246,0.2); background:rgba(0,0,0,0.25); color:#e2e8f0; outline:none; box-sizing:border-box;"
                  placeholder="Ej: Agrega un carril LEGAL con una tarea de revisión jurídica después de Validar Documentos&#10;Ej: Elimina el carril NOTIFICACIONES y conecta el último nodo al Fin"></textarea>

                <button (click)="toggleGrabacionEdicion()" title="Dictar instrucción por voz"
                  style="position:absolute; bottom:12px; right:12px; width:36px; height:36px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s; z-index:10;"
                  [style.background]="grabandoVoz() ? 'linear-gradient(135deg,#dc2626,#ef4444)' : 'rgba(59,130,246,0.25)'"
                  [style.boxShadow]="grabandoVoz() ? '0 0 0 4px rgba(239,68,68,0.25)' : '0 0 0 1px rgba(59,130,246,0.3)'">
                  <span class="material-symbols-outlined" style="font-size:20px;" [style.color]="grabandoVoz() ? 'white' : '#60a5fa'">
                    {{ grabandoVoz() ? 'stop_circle' : 'mic' }}
                  </span>
                </button>
              </div>

              @if (grabandoVoz()) {
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2);">
                  <span style="width:8px; height:8px; border-radius:50%; background:#ef4444; animation:pulse 1s infinite;"></span>
                  <span style="font-size:13px; color:#fca5a5;">Grabando instrucción... Clic en ⬛ para detener.</span>
                </div>
              }
              @if (generandoIA() && !grabandoVoz()) {
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px; padding:10px 14px; border-radius:8px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.2);">
                  <span class="ia-spinner"></span>
                  <span style="font-size:13px; color:#93c5fd;">Aplicando edición con IA...</span>
                </div>
              }

              <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button (click)="mostrarIAPanel.set(false)"
                  style="padding:10px 20px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.05); color:#94a3b8; cursor:pointer; font-size:14px; font-weight:500;">
                  Cancelar
                </button>
                <button (click)="editarConIA()" [disabled]="generandoIA() || (!instruccionEdicion.trim() && !grabandoVoz())"
                  style="padding:10px 24px; border-radius:8px; border:none; cursor:pointer; font-size:14px; font-weight:600; display:flex; align-items:center; gap:8px; transition:all 0.2s;"
                  [style.background]="generandoIA() || (!instruccionEdicion.trim() && !grabandoVoz()) ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#1d4ed8,#2563eb)'"
                  [style.color]="generandoIA() || (!instruccionEdicion.trim() && !grabandoVoz()) ? '#6b7280' : 'white'"
                  [style.boxShadow]="generandoIA() || (!instruccionEdicion.trim() && !grabandoVoz()) ? 'none' : '0 4px 15px rgba(37,99,235,0.4)'">
                  @if (generandoIA() && !grabandoVoz()) { <span class="ia-spinner"></span> Editando... }
                  @else { <span class="material-symbols-outlined" style="font-size:18px;">edit_note</span> Aplicar edición }
                </button>
              </div>
            }

            <!-- Error -->
            @if (iaError()) {
              <div style="margin-top:14px; padding:10px 14px; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.25); display:flex; align-items:flex-start; gap:8px;">
                <span class="material-symbols-outlined" style="font-size:16px; color:#f87171; flex-shrink:0; margin-top:1px;">error</span>
                <span style="font-size:13px; color:#fca5a5; line-height:1.4;">{{ iaError() }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- MODAL AÑADIR/EDITAR CARRIL -->
      @if (showCarrilPicker()) {
        <div class="overlay" (click)="showCarrilPicker.set(false); carrilEditandoId.set(null)">
          <div class="cpm-modal" (click)="$event.stopPropagation()">
            <div class="cpm-header">
              <span class="material-symbols-outlined" style="color:#60a5fa;font-size:22px">view_agenda</span>
              <h3>{{ carrilEditandoId() ? 'Editar Carril' : 'Añadir Carril' }}</h3>
              <button class="btn-icon" (click)="showCarrilPicker.set(false); carrilEditandoId.set(null)">
                <span class="material-symbols-outlined">close</span>
              </button>
            </div>
            <label class="cpm-label">Departamento responsable</label>
            <select class="cpm-select"
                    [ngModel]="carrilPickerDeptId()"
                    (ngModelChange)="onPickerDeptChange($event)">
              <option value="">— Sin departamento —</option>
              @for (d of departamentos(); track d.id) {
                <option [value]="d.id">{{ d.nombre }}</option>
              }
            </select>
            <label class="cpm-label">Funcionario asignado (rotativo)</label>
            <select class="cpm-select"
                    [ngModel]="carrilPickerFuncionarioId()"
                    (ngModelChange)="carrilPickerFuncionarioId.set($event)">
              <option value="">— Sin asignar —</option>
              @for (f of funcionariosFiltrados(); track f.id) {
                <option [value]="f.id">{{ f.nombre_completo }}</option>
              }
            </select>
            @if (carrilPickerDeptId() && funcionariosFiltrados().length === 0) {
              <p style="font-size:10px;color:#f87171;margin-top:2px;">⚠ No hay funcionarios asignados a esta unidad. Asígnales la unidad correcta en Usuarios.</p>
            }
            <label class="cpm-label">Nombre del carril</label>
            <input class="cpm-input" type="text"
                   [ngModel]="carrilPickerNombre()"
                   (ngModelChange)="carrilPickerNombre.set($event)"
                   placeholder="Nombre visible en el diagrama" />
            <div class="cpm-actions">
              <button class="btn-secondary" (click)="showCarrilPicker.set(false); carrilEditandoId.set(null)">Cancelar</button>
              <button class="btn-primary" (click)="confirmarAgregarCarril()" [disabled]="!carrilPickerNombre().trim()">
                <span class="material-symbols-outlined">{{ carrilEditandoId() ? 'save' : 'add' }}</span>
                {{ carrilEditandoId() ? 'Guardar cambios' : 'Añadir carril' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- TOAST DE CONFIRMACIÓN -->
      <div class="toast-notification" [class.show]="showToast()">
        <span class="material-symbols-outlined">check_circle</span>
        Progreso guardado automáticamente
      </div>
    </div>
  `,
  styles: [`
    .designer-container {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: #060b14;
      color: #f1f5f9;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    }
    
    .designer-header {
      height: 70px;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
    }
    .colaboradores-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: rgba(99,102,241,0.15);
      border: 1px solid rgba(99,102,241,0.3);
      color: #a5b4fc;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
    }
    .status-indicator.saving {
      color: #facc15;
    }
    .status-indicator.saving .pulse-dot {
      background: #facc15;
      box-shadow: 0 0 0 0 rgba(250,204,21,0.4);
    }
    .status-indicator.error {
      color: #f87171;
      gap: 4px;
    }

    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .btn-icon {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #94a3b8;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
    }
    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
      transform: translateY(-1px);
    }
    
    .breadcrumb {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .breadcrumb .label {
      font-size: 10px;
      color: #38bdf8;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .breadcrumb .title {
      font-size: 18px;
      font-weight: 600;
      margin: 0;
      color: #f8fafc;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .status-indicator {
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #64748b;
      background: rgba(255, 255, 255, 0.03);
      padding: 6px 12px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .status-indicator.sync {
      color: #cbd5e1;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
      box-shadow: 0 0 12px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
      100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }

    .btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      border: none;
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(37, 99, 235, 0.4);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(37, 99, 235, 0.6);
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
    }

    .editor-body {
      flex: 1;
      display: flex;
      flex-direction: row;
      overflow: hidden;
      min-height: 0;
    }

    /* ── PALETA LATERAL ─────────────────────────────────── */
    .node-palette {
      width: 152px;
      min-width: 152px;
      background: rgba(6, 11, 20, 0.98);
      border-right: 1px solid rgba(255, 255, 255, 0.07);
      padding: 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
      z-index: 10;
    }
    .palette-title {
      font-size: 9px;
      color: #475569;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin: 0 0 4px;
    }
    .palette-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      padding: 10px 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      cursor: grab;
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      transition: all 0.18s ease;
      user-select: none;
    }
    .palette-item:hover { background: rgba(255,255,255,0.05); color: #e2e8f0; transform: translateY(-1px); }
    .palette-item:active { cursor: grabbing; transform: scale(0.97); }
    .palette-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 8px; }
    .palette-inicio .palette-icon { background: rgba(16,185,129,0.15); color: #10b981; }
    .palette-inicio:hover { border-color: rgba(16,185,129,0.4); }
    .palette-tarea .palette-icon  { background: rgba(59,130,246,0.15); color: #60a5fa; }
    .palette-tarea:hover { border-color: rgba(59,130,246,0.4); }
    .palette-gateway .palette-icon { background: rgba(249,115,22,0.15); color: #fb923c; }
    .palette-gateway:hover { border-color: rgba(249,115,22,0.4); }
    .palette-fin .palette-icon { background: rgba(239,68,68,0.15); color: #f87171; }
    .palette-fin:hover { border-color: rgba(239,68,68,0.4); }
    .palette-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0; }
    .palette-hint { font-size: 9px; color: #334155; text-align: center; line-height: 1.4; margin: 0; }

    .canvas-wrapper {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at center, #0f172a 0%, #020617 100%);
    }

    .palette-carril .palette-icon { background: rgba(148,163,184,0.12); color: #94a3b8; }
    .palette-carril:hover { border-color: rgba(148,163,184,0.4); }

    /* Atributos / campo types */
    .palette-campo-texto .palette-icon  { background: rgba(59,130,246,0.15);  color: #60a5fa; }
    .palette-campo-texto:hover  { border-color: rgba(59,130,246,0.4); }
    .palette-campo-numero .palette-icon { background: rgba(16,185,129,0.15);  color: #34d399; }
    .palette-campo-numero:hover { border-color: rgba(16,185,129,0.4); }
    .palette-campo-lista .palette-icon  { background: rgba(249,115,22,0.15);  color: #fb923c; }
    .palette-campo-lista:hover  { border-color: rgba(249,115,22,0.4); }
    .palette-campo-sino .palette-icon   { background: rgba(168,85,247,0.15);  color: #c084fc; }
    .palette-campo-sino:hover   { border-color: rgba(168,85,247,0.4); }
    .palette-campo-fecha .palette-icon  { background: rgba(6,182,212,0.15);   color: #22d3ee; }
    .palette-campo-fecha:hover  { border-color: rgba(6,182,212,0.4); }
    .palette-campo-firma .palette-icon  { background: rgba(236,72,153,0.15);  color: #f472b6; }
    .palette-campo-firma:hover  { border-color: rgba(236,72,153,0.4); }
    .palette-campo-archivo .palette-icon{ background: rgba(245,158,11,0.15);  color: #fbbf24; }
    .palette-campo-archivo:hover{ border-color: rgba(245,158,11,0.4); }
    .palette-campo-largo .palette-icon  { background: rgba(20,184,166,0.15);  color: #2dd4bf; }
    .palette-campo-largo:hover  { border-color: rgba(20,184,166,0.4); }
    .palette-campo-grid .palette-icon   { background: rgba(139,92,246,0.15);  color: #a78bfa; }
    .palette-campo-grid:hover   { border-color: rgba(139,92,246,0.4); }

    /* === LANES INSIDE F-CANVAS (zoom/pan with nodes) === */
    ::ng-deep .lanes-world {
      position: absolute;
      left: 0;
      top: 0;
      pointer-events: none;
      display: flex;
      flex-direction: column;
      overflow: visible;
    }
    ::ng-deep .lane-bg {
      position: relative;
      flex-shrink: 0;
      width: 8000px;
      border-bottom: 2px solid rgba(148, 163, 184, 0.18);
      background: rgba(10, 18, 40, 0.82);
      pointer-events: none;
    }
    ::ng-deep .lane-bg.lane-odd {
      background: rgba(17, 28, 58, 0.78);
    }
    ::ng-deep .lane-header {
      position: absolute;
      left: 0;
      top: 0;
      width: 180px;
      height: 100%;
      background: rgba(4, 8, 20, 0.96);
      border-right: 2px solid rgba(59, 130, 246, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      pointer-events: auto;
      cursor: default;
      user-select: none;
    }
    ::ng-deep .lane-num {
      width: 28px; height: 28px;
      background: rgba(59,130,246,0.22);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; color: #93c5fd;
      flex-shrink: 0;
      border: 1.5px solid rgba(59,130,246,0.45);
    }
    ::ng-deep .lane-name {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      transform: rotate(180deg);
      font-size: 11px; font-weight: 700; color: #cbd5e1;
      letter-spacing: 0.08em; text-transform: uppercase;
      max-height: 220px; overflow: hidden;
    }
    ::ng-deep .lane-actions {
      display: flex; flex-direction: column; gap: 4px;
      opacity: 0; transition: opacity 0.2s;
    }
    ::ng-deep .lane-header:hover .lane-actions { opacity: 1; }
    ::ng-deep .lane-btn {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 4px; color: #64748b;
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s;
    }
    ::ng-deep .lane-btn:hover { background: rgba(255,255,255,0.15); color: #e2e8f0; }
    ::ng-deep .lane-btn-delete:hover { background: rgba(239,68,68,0.2); color: #f87171; border-color: rgba(239,68,68,0.3); }
    ::ng-deep .lane-btn .material-symbols-outlined { font-size: 14px; }
    ::ng-deep .lane-add {
      align-self: flex-start;
      width: 180px;
      height: 44px;
      background: rgba(4, 8, 20, 0.9);
      border: 1px dashed rgba(59,130,246,0.25);
      display: flex; align-items: center; justify-content: center;
      gap: 6px; font-size: 10px; color: #475569;
      cursor: pointer; pointer-events: auto;
      transition: all 0.2s;
      letter-spacing: 0.04em; font-weight: 600;
    }
    ::ng-deep .lane-add:hover { color: #93c5fd; border-color: rgba(59,130,246,0.5); background: rgba(59,130,246,0.08); }
    ::ng-deep .lane-add .material-symbols-outlined { font-size: 16px; }

    /* === INLINE LANE NAME EDITING === */
    ::ng-deep .lane-name-input {
      writing-mode: vertical-rl;
      text-orientation: mixed;
      background: rgba(59,130,246,0.12);
      border: 1px solid rgba(59,130,246,0.5);
      border-radius: 4px;
      color: #93c5fd;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 4px 2px;
      max-height: 200px;
      width: 20px;
      outline: none;
      text-align: center;
      cursor: text;
    }
    ::ng-deep .lane-btn-up:disabled, ::ng-deep .lane-btn-down:disabled {
      opacity: 0.2;
      cursor: not-allowed;
      pointer-events: none;
    }

    /* === REMOVE OLD SWIMLANE OVERLAY (replaced above) === */
    .swimlanes-overlay {
      position: absolute;
      inset: 0;
      z-index: 0;
      display: flex;
      flex-direction: column;
      pointer-events: none;
    }

    .swimlane {
      flex: 1;
      position: relative;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)),
        linear-gradient(90deg, rgba(15,23,42,0.84), rgba(15,23,42,0.58) 150px, rgba(2,6,23,0.08) 150px);
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
    }

    .swimlane:nth-child(odd) {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015)),
        linear-gradient(90deg, rgba(15,23,42,0.88), rgba(15,23,42,0.62) 150px, rgba(2,6,23,0.1) 150px);
    }

    .swimlane:last-child {
      border-bottom: none;
    }

    .swimlane-header {
      position: absolute;
      top: 12px;
      left: 12px;
      width: 118px;
      min-height: calc(100% - 24px);
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 8px;
      padding: 12px 10px;
      border: 1px solid rgba(96, 165, 250, 0.2);
      border-radius: 14px;
      background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(30,41,59,0.82));
      box-shadow: 0 10px 24px rgba(0,0,0,0.25);
      pointer-events: none;
    }

    .swimlane-index {
      width: 28px;
      height: 28px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.16);
      color: #7dd3fc;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .swimlane-title {
      color: #e2e8f0;
      font-size: 11px;
      line-height: 1.2;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      align-self: center;
      text-align: center;
      max-height: calc(100% - 40px);
    }

    f-flow, .custom-flow {
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      position: absolute;
      inset: 0;
      z-index: 1;
      background: transparent !important;
    }

    ::ng-deep f-rect-pattern rect { fill: transparent; }
    ::ng-deep f-rect-pattern path { stroke: rgba(56, 189, 248, 0.06); stroke-width: 1; }

    /* ── Conexiones UML 2.5 ─────────────────────────────── */
    .rel-pill {
      background: rgba(15, 23, 42, 0.88);
      color: #94a3b8;
      font-size: 9px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 3px;
      border: 1px solid rgba(100, 116, 139, 0.35);
      pointer-events: auto;
      cursor: pointer;
      transition: border-color 0.18s, background 0.18s;
      display: flex;
      align-items: center;
      gap: 5px;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.02em;
    }
    .rel-pill:hover {
      background: rgba(30, 41, 59, 0.95);
      border-color: rgba(148, 163, 184, 0.55);
    }
    .rel-pill.condicional {
      color: #c084fc;
      border-color: rgba(168, 85, 247, 0.4);
    }
    .rel-pill.condicional:hover {
      border-color: rgba(168, 85, 247, 0.7);
      background: rgba(88, 28, 135, 0.2);
    }
    .rel-pill .delete-conn {
      background: transparent;
      color: #475569;
      border: none;
      border-radius: 2px;
      width: 14px;
      height: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: color 0.15s;
      padding: 0;
    }
    .rel-pill .delete-conn .material-symbols-outlined { font-size: 12px; }
    .rel-pill .delete-conn:hover { color: #f87171; }

    /* Rutas de Conexión — estilo UML 2.5 limpio */
    ::ng-deep .f-connection:not([data-tipo='condicional']) .f-connection-path,
    ::ng-deep .f-connection-for-create .f-connection-path {
      stroke: #64748b !important;
      stroke-width: 1.5 !important;
      fill: none !important;
      filter: none !important;
    }
    ::ng-deep .f-connection:not([data-tipo='condicional']) .f-connection-path:hover {
      stroke: #94a3b8 !important;
    }
    ::ng-deep .f-connection[data-tipo='condicional'] .f-connection-path {
      stroke: #7c3aed !important;
      stroke-dasharray: 7 4 !important;
      stroke-width: 1.5 !important;
      filter: none !important;
    }

    ::ng-deep [f-connection-drag-handle-start],
    ::ng-deep [f-connection-drag-handle-end] {
      fill: transparent !important;
      stroke: transparent !important;
      cursor: crosshair;
    }

    /* Flechas UML — pequeñas, limpias */
    ::ng-deep f-connection marker path,
    ::ng-deep f-connection-for-create marker path {
      fill: #64748b !important;
      stroke: none !important;
      filter: none !important;
    }
    ::ng-deep f-connection[data-tipo='condicional'] marker path {
      fill: #7c3aed !important;
      stroke: none !important;
      filter: none !important;
    }

    ::ng-deep svg.f-connection-svg { overflow: visible !important; }
    ::ng-deep .f-node { background: transparent !important; border: none !important; padding: 0 !important; }

    .toast-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: rgba(15, 23, 42, 0.9);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #f8fafc;
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 1000;
    }
    .toast-notification .material-symbols-outlined { color: #10b981; font-size: 20px; }
    .toast-notification.show { transform: translateY(0); opacity: 1; }

    .remote-cursor {
      position: absolute;
      pointer-events: none;
      z-index: 99999;
      transition: left 0.08s linear, top 0.08s linear;
    }
    .remote-cursor .cursor-label {
      position: absolute;
      top: 18px;
      left: 12px;
      color: white;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }


    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      color: #cbd5e1;
      padding: 7px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .btn-ai { border-color: rgba(167,139,250,0.4); color: #c4b5fd; }
    .btn-ai:hover { background: rgba(167,139,250,0.15); color: #ddd6fe; }

    .ia-panel {
      background: #0f172a;
      border: 1px solid rgba(167,139,250,0.3);
      border-radius: 16px;
      padding: 28px;
      width: 520px;
      max-width: 95vw;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7);
    }
    .ia-panel-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }
    .ia-panel-header h3 { font-size: 18px; font-weight: 700; color: #f1f5f9; margin: 0; }
    .ia-hint { font-size: 13px; color: #64748b; margin-bottom: 14px; line-height: 1.5; }
    .ia-textarea {
      width: 100%;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      color: #e2e8f0;
      font-size: 13px;
      padding: 12px;
      resize: vertical;
      font-family: inherit;
      line-height: 1.6;
      margin-bottom: 16px;
      box-sizing: border-box;
    }
    .ia-textarea:focus { outline: none; border-color: rgba(167,139,250,0.5); }
    .ia-actions { display: flex; gap: 10px; justify-content: flex-end; }
    .ia-spinner {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ia-error { color: #f87171; font-size: 12px; margin-top: 10px; }

    /* ── CARRIL PICKER MODAL ─────────────────────────── */
    .cpm-modal {
      background: #0f172a;
      border: 1px solid rgba(59,130,246,0.35);
      border-radius: 16px;
      padding: 28px;
      width: 420px;
      max-width: 95vw;
      box-shadow: 0 20px 60px rgba(0,0,0,0.8);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .cpm-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .cpm-header h3 { font-size: 17px; font-weight: 700; color: #f1f5f9; margin: 0; flex: 1; }
    .cpm-label { font-size: 10px; font-weight: 700; color: #64748b; letter-spacing: 0.09em; text-transform: uppercase; }
    .cpm-select, .cpm-input {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      color: #e2e8f0;
      font-size: 14px;
      padding: 10px 12px;
      width: 100%;
      outline: none;
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .cpm-select:focus, .cpm-input:focus { border-color: rgba(59,130,246,0.55); }
    .cpm-select option { background: #1e293b; }
    .cpm-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 4px; }

    /* ── MOBILE RESPONSIVE (≤767px) ─────────────────────── */
    @media (max-width: 767px) {
      .designer-header {
        height: auto;
        min-height: 52px;
        padding: 6px 10px;
        flex-wrap: wrap;
        gap: 6px;
      }
      .header-left { gap: 8px; }
      .header-right { gap: 8px; overflow-x: auto; flex-shrink: 0; }
      .status-indicator { display: none; }
      .colaboradores-badge { font-size: 10px; padding: 4px 8px; }
      .breadcrumb .label { display: none; }
      .breadcrumb .title { font-size: 13px; }
      .btn-secondary > span:last-child,
      .btn-primary > span:last-child { display: none; }
      .btn-secondary { padding: 6px 9px; }
      .btn-primary { padding: 7px 9px; }
      .node-palette {
        width: 68px;
        min-width: 68px;
        padding: 8px 5px;
        gap: 5px;
      }
      .palette-item > span:last-child { display: none; }
      .palette-item { padding: 7px 3px; }
      .palette-icon { width: 30px; height: 30px; border-radius: 6px; }
      .palette-title { display: none; }
      .palette-divider { margin: 2px 0; }
    }
  `]
})
export class FlowEditorComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private autoguardar$ = new Subject<void>();

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private elRef = inject(ElementRef);
  rt = inject(RealtimeService);
  auth = inject(AuthService);
  private flujoSvc = inject(FlujoEditorService);
  private formSvc = inject(FormularioService);
  private unidadSvc = inject(UnidadService);
  private usuarioSvc = inject(UsuarioService);
  private ngZone = inject(NgZone);
  private http = inject(HttpClient);
  private iaSvc = inject(IaAssistantService);

  @ViewChild('fCanvas') private fCanvas?: FCanvasComponent;
  @ViewChild('lanesOverlayRef') private lanesOverlayRef?: ElementRef<HTMLElement>;
  @ViewChild('cursorsOverlayRef') private cursorsOverlayRef?: ElementRef<HTMLElement>;
  private lanesRafId: number | null = null;

  // Validation
  validacionErrores = signal<string[]>([]);
  mostrarValidacion = signal(false);
  private flowCentered = false;

  // IA + Export
  mostrarIAPanel = signal(false);
  generandoIA = signal(false);
  iaError = signal<string | null>(null);
  descripcionIA = '';
  modoIA = signal<'generar' | 'editar'>('generar');
  instruccionEdicion = '';
  
  // Audio recording
  grabandoVoz = signal(false);
  mediaRecorder: MediaRecorder | null = null;
  audioChunks: Blob[] = [];

  // Paleta drag-and-drop
  private draggedTipoPaso: TipoPaso | null = null;
  private draggedCampotipo: import('../../../core/models/flujo.models').TipoCampo | null = null;

  // Perfil del usuario actual para el colaborador
  miUsuarioId = this.auth.getUsuario()?.id || 'anon-' + Math.random().toString(36).substr(2, 5);
  miUsuarioNombre = this.auth.getUsuario()?.nombre || 'Anónimo';

  // Cursores remotos + timeout para eliminarlos si el usuario se desconecta
  cursoresRemotos = signal<Record<string, CursorEditorDto>>({});
  cursoresArray = computed(() => Object.values(this.cursoresRemotos()));
  private cursorTimeouts: Record<string, ReturnType<typeof setTimeout>> = {};

  // Estado de guardado reactivo: 'idle' | 'guardando' | 'sincronizado' | 'error'
  estadoGuardado = signal<'idle' | 'guardando' | 'sincronizado' | 'error'>('sincronizado');

  politicaId = signal<string | null>(null);
  politicaNombre = signal<string>('Cargando...');
  esquema = signal<EsquemaWorkflow>({ version: 1, tipoFlujo: 'secuencial', pasos: [], relaciones: [] });
  formularios = signal<any[]>([]);
  departamentos = signal<any[]>([]);
  // Swimlane constants (world-coordinate units)
  readonly LANE_HEIGHT = 320;
  readonly LANE_CANVAS_WIDTH = 8000;

  private readonly DEFAULT_CARRILES: Carril[] = [
    { id: 'cliente',   nombre: 'Carril de Cliente' },
    { id: 'recepcion', nombre: 'Carril de Recepción' },
    { id: 'analista',  nombre: 'Carril de Analista/Jefe' },
  ];

  // Computed from schema — falls back to defaults when no carriles are stored
  carriles = computed<Carril[]>(() => {
    const c = this.esquema().carriles;
    return (c && c.length > 0) ? c : this.DEFAULT_CARRILES;
  });

  // Inline lane editing state
  editingLaneId = signal<string | null>(null);
  editingLaneName = signal<string>('');

  pasoSeleccionadoId = signal<string | null>(null);
  pasoEdit = signal<Paso | null>(null);
  formularioEditorId = signal<string | null>(null);
  formularioEdit = signal<any | null>(null); // Formulario completo para el dialog
  padreIdActualParaPaso = signal<string | null>(null); // Padre actual del paso que se está editando
  camposPadreCondicion = signal<CampoFormulario[]>([]); // Campos del formulario del paso padre para el modal de condición
  campoConfigFormId = signal<string | null>(null);
  campoConfigTipo = signal<TipoCampo>('texto');

  ngOnInit(): void {
    this.rt.connect();
    const id = this.route.snapshot.paramMap.get('politicaId');
    if (id) {
      this.politicaId.set(id);
      this.cargarDatos(id);
      this.rt.cambiosEditor(id).pipe(takeUntil(this.destroy$)).subscribe(msg => this.manejarCambioRemoto(msg));
      this.rt.cursoresEditor(id).pipe(takeUntil(this.destroy$)).subscribe(cursor => {
        if (cursor.usuarioId !== this.miUsuarioId) {
          // Actualizar cursor remoto
          const dict = { ...this.cursoresRemotos() };
          dict[cursor.usuarioId] = cursor;
          this.cursoresRemotos.set(dict);
          // Reiniciar timeout: si no hay movimiento en 4s, eliminar cursor
          clearTimeout(this.cursorTimeouts[cursor.usuarioId]);
          this.cursorTimeouts[cursor.usuarioId] = setTimeout(() => {
            const current = { ...this.cursoresRemotos() };
            delete current[cursor.usuarioId];
            this.cursoresRemotos.set(current);
          }, 4000);
        }
      });
    }
    this.autoguardar$.pipe(takeUntil(this.destroy$), auditTime(1500)).subscribe(() => this.persistir());
  }

  ngAfterViewInit(): void {
    const wrapper = this.elRef.nativeElement.querySelector('.canvas-wrapper') as HTMLElement;
    if (wrapper) {
      this._canvasWrapperEl = wrapper;
      this.startLanesSync(wrapper);
    }
  }

  private startLanesSync(wrapper: HTMLElement): void {
    const sync = () => {
      const fCanvasEl = wrapper.querySelector('f-canvas') as HTMLElement | null;
      if (fCanvasEl) {
        const t = window.getComputedStyle(fCanvasEl).transform;
        const transform = (t && t !== 'none') ? t : '';
        const lanesOverlay = this.lanesOverlayRef?.nativeElement;
        if (lanesOverlay) lanesOverlay.style.transform = transform;
        const cursorsOverlay = this.cursorsOverlayRef?.nativeElement;
        if (cursorsOverlay) cursorsOverlay.style.transform = transform;
      }
      this.lanesRafId = requestAnimationFrame(sync);
    };
    this.ngZone.runOutsideAngular(() => {
      this.lanesRafId = requestAnimationFrame(sync);
    });
  }

  onFlowFullRendered(): void {
    if (this.flowCentered || this.esquema().pasos.length === 0) return;
    window.setTimeout(() => {
      if (!this.fCanvas || this.esquema().pasos.length === 0) {
        return;
      }
      this.fCanvas.resetScaleAndCenter(false);
      this.fCanvas.fitToScreen({ x: 160, y: 160 }, false);
      this.flowCentered = true;
    }, 0);
  }

  // Lee el transform CSS del canvas de Foblex y retorna la matriz
  private getCanvasMatrix(wrapper: HTMLElement): { matrix: DOMMatrix; parentOffsetX: number; parentOffsetY: number } | null {
    const fCanvasEl = wrapper.querySelector('f-canvas') as HTMLElement;
    if (!fCanvasEl) return null;
    let el: HTMLElement = fCanvasEl;
    const child = fCanvasEl.firstElementChild as HTMLElement | null;
    if (child && window.getComputedStyle(child).transform !== 'none') el = child;
    const transformStr = window.getComputedStyle(el).transform;
    if (!transformStr || transformStr === 'none') return null;
    const parent = el.parentElement || wrapper;
    const parentRect = parent.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    return {
      matrix: new DOMMatrix(transformStr),
      parentOffsetX: parentRect.left - wrapperRect.left,
      parentOffsetY: parentRect.top - wrapperRect.top
    };
  }

  // EMITIR: screen → world
  private screenToWorld(wrapper: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
    const wrapperRect = wrapper.getBoundingClientRect();
    const info = this.getCanvasMatrix(wrapper);
    if (!info) return { x: clientX - wrapperRect.left, y: clientY - wrapperRect.top };
    const { matrix, parentOffsetX, parentOffsetY } = info;
    const scale = matrix.a || 1;
    const screenX = (clientX - wrapperRect.left) - parentOffsetX;
    const screenY = (clientY - wrapperRect.top)  - parentOffsetY;
    return { x: (screenX - matrix.e) / scale, y: (screenY - matrix.f) / scale };
  }

  // MOSTRAR: world → screen (relativo al canvas-wrapper)
  private _canvasWrapperEl: HTMLElement | null = null;
  worldToDisplay(worldX: number, worldY: number): { x: number; y: number } {
    const wrapper = this._canvasWrapperEl;
    if (!wrapper) return { x: worldX, y: worldY };
    const info = this.getCanvasMatrix(wrapper);
    if (!info) return { x: worldX, y: worldY };
    const { matrix, parentOffsetX, parentOffsetY } = info;
    const scale = matrix.a || 1;
    return {
      x: worldX * scale + matrix.e + parentOffsetX,
      y: worldY * scale + matrix.f + parentOffsetY
    };
  }

  // Determines lane index from world Y coordinate (immune to zoom/pan)
  private laneIndexFromWorldY(worldY: number): number {
    const count = Math.max(1, this.carriles().length);
    const idx = Math.floor(worldY / this.LANE_HEIGHT);
    return Math.max(0, Math.min(idx, count - 1));
  }

  private lastCursorUpdate = 0;
  onCanvasMouseMove(e: MouseEvent): void {
    const now = Date.now();
    // Guardamos referencia al wrapper para usar en worldToDisplay()
    this._canvasWrapperEl = e.currentTarget as HTMLElement;
    if (now - this.lastCursorUpdate > 33) {
      this.lastCursorUpdate = now;
      const pid = this.politicaId();
      if (pid) {
        const { x, y } = this.screenToWorld(this._canvasWrapperEl, e.clientX, e.clientY);
        this.rt.emitirCursor({
          politicaId: pid,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          color: this.rt.colorParaUsuario(this.miUsuarioId),
          x, y
        });
      }
    }
  }


  private manejarCambioRemoto(cambio: EditorCambioDto): void {
    if (cambio.usuarioId === this.miUsuarioId) return; // Ignorar mis propios ecos

    this.ngZone.run(() => {
      const pl = cambio.payload;

      // Clonamos profundamente el esquema para garantizar que Angular detecte el cambio
      const esq = {
        ...this.esquema(),
        pasos: [...this.esquema().pasos],
        relaciones: [...this.esquema().relaciones]
      };

      switch (cambio.tipo) {
        case 'paso_movido': {
          const idx = esq.pasos.findIndex(p => p.id === pl.id);
          if (idx >= 0) {
            esq.pasos[idx] = { ...esq.pasos[idx], x: pl.x, y: pl.y };
          }
          break;
        }
        case 'paso_creado':
          if (!esq.pasos.find(p => p.id === pl.id)) {
            esq.pasos = [...esq.pasos, pl as Paso];
          }
          break;
        case 'paso_actualizado': {
          const idx = esq.pasos.findIndex(p => p.id === pl.id);
          if (idx >= 0) {
            esq.pasos[idx] = { ...esq.pasos[idx], ...pl };
          }
          break;
        }
        case 'paso_eliminado':
          esq.pasos = esq.pasos.filter(p => p.id !== pl.id);
          esq.relaciones = esq.relaciones.filter(r => r.padreId !== pl.id && r.destinoId !== pl.id);
          break;
        case 'relacion_creada':
          if (!esq.relaciones.find(r => r.id === pl.id)) {
            esq.relaciones = [...esq.relaciones, pl as FlujoRelacion];
          }
          break;
        case 'relacion_eliminada':
          esq.relaciones = esq.relaciones.filter(r => r.id !== pl.id);
          break;
        case 'condicion_actualizada':
        case 'relacion_actualizada': {
          const rIdx = esq.relaciones.findIndex(r => r.id === pl.id);
          if (rIdx >= 0) {
            esq.relaciones[rIdx] = { ...esq.relaciones[rIdx], ...pl };
          }
          break;
        }
        default:
          console.warn('Cambio remoto no manejado explícitamente:', cambio.tipo);
          break;
      }
      this.esquema.set(esq);
    });
  }

  ngOnDestroy(): void {
    if (this.lanesRafId !== null) cancelAnimationFrame(this.lanesRafId);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarDatos(id: string): void {
    this.flowCentered = false;
    // Cargar política y formularios en paralelo — los formularios se setean ANTES
    // de activar el esquema para que los nodos ya vean los campos en el primer render.
    forkJoin({
      pol: this.flujoSvc.obtenerPolitica(id),
      list: this.formSvc.listar(id),
    }).subscribe(({ pol, list }) => {
      this.politicaNombre.set(pol.nombre);
      const esquema = this.flujoSvc.normalizarEsquema(pol.esquema_workflow);

      // Llevar nodos a coordenadas positivas para que caigan dentro de los carriles (y >= 20, x >= 200)
      if (esquema.pasos.length > 0) {
        const minY = Math.min(...esquema.pasos.map((p: Paso) => p.y));
        const minX = Math.min(...esquema.pasos.map((p: Paso) => p.x));
        const dy = minY < 20 ? 20 - minY : 0;
        const dx = minX < 200 ? 200 - minX : 0;
        if (dy !== 0 || dx !== 0) {
          esquema.pasos = esquema.pasos.map((p: Paso) => ({ ...p, x: p.x + dx, y: p.y + dy }));
          setTimeout(() => this.autoguardar$.next(), 200);
        }
      }

      // 1. Poblar formularios ANTES de mostrar el esquema
      const formulariosCompletos = list.map((f: any) => ({
        ...f,
        campos: f.campos && Array.isArray(f.campos) ? f.campos : (f.esquema_campos && Array.isArray(f.esquema_campos) ? f.esquema_campos : [])
      }));
      this.formularios.set(formulariosCompletos);

      // 2. Ahora activar el esquema — los nodos ya tendrán formularios disponibles
      this.esquema.set(esquema);

      // 3. Fallback: cargar individualmente los formularios que no estén en la lista
      const listedIds = new Set(formulariosCompletos.map((f: any) => f.id));
      const missingIds = esquema.pasos
        .filter((p: Paso) => p.formularioId && !listedIds.has(p.formularioId))
        .map((p: Paso) => p.formularioId!);

      missingIds.forEach(fId => {
        this.formSvc.obtener(fId).subscribe(f => {
          if (f) {
            this.formularios.update(current => {
              if (current.some((x: any) => x.id === f!.id)) return current;
              const fAny = f as any;
              return [...current, { ...f, campos: fAny.campos ?? fAny.esquema_campos ?? [] }];
            });
          }
        });
      });
    });

    this.unidadSvc.obtenerTodasLasUnidades().subscribe(u => this.departamentos.set(u));
    this.usuarioSvc.obtenerTodosLosUsuarios().subscribe(users => {
      this.funcionarios.set(users.filter((u: any) =>
        u.rol_id?.includes('FUNCIONARIO') || u.rol?.includes('FUNCIONARIO')
      ));
    });
  }

  ejecutarValidacion(): void {
    const errores: string[] = [];
    const pasos = this.esquema().pasos;
    const relaciones = this.esquema().relaciones;

    const inicios = pasos.filter(p => p.tipoPaso === 'INICIO');
    const fines   = pasos.filter(p => p.tipoPaso === 'FIN');

    if (inicios.length === 0) errores.push('Falta un nodo de INICIO. El diagrama debe tener exactamente uno.');
    if (inicios.length > 1)  errores.push(`Hay ${inicios.length} nodos de INICIO. Solo puede haber uno.`);
    if (fines.length === 0)  errores.push('Falta un nodo de FIN. El diagrama debe tener exactamente uno.');
    if (fines.length > 1)   errores.push(`Hay ${fines.length} nodos de FIN. Solo puede haber uno.`);

    for (const paso of pasos) {
      const entradas  = relaciones.filter(r => r.destinoId === paso.id || (r as any).to === paso.id).length;
      const salidas   = relaciones.filter(r => r.padreId  === paso.id || (r as any).from === paso.id).length;

      if (paso.tipoPaso === 'INICIO') {
        if (entradas > 0) errores.push(`Nodo INICIO "${paso.nombre}" no debe tener conexiones entrantes.`);
        if (salidas === 0) errores.push(`Nodo INICIO "${paso.nombre}" debe tener al menos una conexión saliente.`);
      } else if (paso.tipoPaso === 'FIN') {
        if (entradas === 0) errores.push(`Nodo FIN "${paso.nombre}" debe tener al menos una conexión entrante.`);
        if (salidas > 0)   errores.push(`Nodo FIN "${paso.nombre}" no debe tener conexiones salientes.`);
      } else if (paso.tipoPaso === 'GATEWAY') {
        if (entradas === 0) errores.push(`Decisión "${paso.nombre}" no tiene conexiones entrantes (nodo huérfano).`);
        if (salidas < 2)   errores.push(`Decisión "${paso.nombre}" debe tener al menos 2 salidas (tiene ${salidas}).`);
      } else {
        if (entradas === 0 && inicios.length > 0) errores.push(`Tarea "${paso.nombre}" no tiene conexiones entrantes (nodo huérfano).`);
        if (salidas === 0 && fines.length > 0)   errores.push(`Tarea "${paso.nombre}" no tiene conexiones salientes (nodo huérfano).`);
      }
    }

    // Verificar conectividad: alcanzabilidad desde INICIO hasta FIN
    if (inicios.length === 1 && fines.length === 1) {
      const adyacencia = new Map<string, string[]>();
      for (const p of pasos) adyacencia.set(p.id, []);
      for (const r of relaciones) {
        const from = r.padreId ?? (r as any).from;
        const to   = r.destinoId ?? (r as any).to;
        if (from && to) adyacencia.get(from)?.push(to);
      }
      const alcanzados = new Set<string>();
      const pila = [inicios[0].id];
      while (pila.length) {
        const actual = pila.pop()!;
        if (alcanzados.has(actual)) continue;
        alcanzados.add(actual);
        for (const sig of adyacencia.get(actual) ?? []) pila.push(sig);
      }
      if (!alcanzados.has(fines[0].id)) {
        errores.push('No existe un camino desde el INICIO hasta el FIN. Verifica que el flujo esté conectado.');
      }
      const noAlcanzados = pasos.filter(p => !alcanzados.has(p.id));
      for (const p of noAlcanzados) {
        errores.push(`El nodo "${p.nombre}" no es alcanzable desde el INICIO.`);
      }
    }

    this.validacionErrores.set(errores);
    this.mostrarValidacion.set(true);
  }

  abrirNuevoPaso(): void {
    this.debugLog.set('Clic en Nuevo Paso');
    this.ngZone.run(() => {
      const id = this.politicaId();
      if (!id) {
        this.debugLog.set('ERROR: politicaId es null');
        return;
      }
      try {
        const esq = { ...this.esquema() };
        const offset = esq.pasos.length * 60;
        const nuevo = this.flujoSvc.crearPasoLocal(esq, { 
          politicaId: id, 
          nombre: 'Ejecutar Revisión Técnica',
          obligatorio: true,
          x: 120 + offset,
          y: 120 + offset,
          departamentoId: 'analista'
        });
        this.esquema.set(esq);
        this.autoguardar$.next();
        
        // Abrimos el modal inmediatamente
        this.pasoEdit.set(nuevo);
        
        // Colaborativo
        this.rt.emitirCambioEditor({
          politicaId: id,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'paso_creado',
          payload: nuevo
        });

        this.debugLog.set('Exito: nodo ' + nuevo.id + ' modal=' + !!this.pasoEdit());
      } catch (e: any) {
        this.debugLog.set('EXCEPTION: ' + e.message);
      }
    });
  }

  onNodeMoved(id: string, pos: any): void {
    this.ngZone.run(() => {
      const esq = { ...this.esquema() };
      this.flujoSvc.actualizarPasoLocal(esq, id, { x: pos.x, y: pos.y });
      // Reasignar departamento según el carril donde quedó el nodo
      try {
        const laneIndex = this.laneIndexFromWorldY(pos.y);
        const lane = this.carriles()[laneIndex];
        if (lane) {
          this.flujoSvc.actualizarPasoLocal(esq, id, { departamentoId: lane.departamentoId || lane.id });
        }
      } catch (e) {
        // ignore
      }
      this.esquema.set(esq);
      this.autoguardar$.next();

      const pid = this.politicaId();
      if (pid) {
        this.rt.emitirCambioEditor({
          politicaId: pid,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'paso_movido',
          payload: { id, x: pos.x, y: pos.y }
        });
      }
    });
  }

  onCreateConnection(ev: FCreateConnectionEvent): void {
    this.ngZone.run(() => {
      const pId = this.politicaId();
      if (!pId) return;
      const esq = { ...this.esquema() };
      
      const sourceId = ev.fOutputId || (ev as any).sourceId;
      const targetId = ev.fInputId || (ev as any).targetId;
      
      if (sourceId && targetId) {
        // IDs are full UUIDs. Remove the suffix to get the pure Node ID
        const padreId = sourceId.replace('-out-sig', '').replace('-out-cond', '');
        const destinoId = targetId.replace('-in', '');
        const tipo = sourceId.includes('cond') ? 'condicional' : 'siguiente';
        
        // Sincronizar Jerarquía automáticamente: al conectar nodos visualmente,
        // establecemos que el destino es "hijo" del origen para el selector de "Flujo Padre".
        esq.relaciones = esq.relaciones.filter(r => !(r.destinoId === destinoId && r.tipo === 'hijo'));
        this.flujoSvc.crearRelacionLocal(esq, padreId, destinoId, 'hijo', pId);

        const rel = this.flujoSvc.crearRelacionLocal(esq, padreId, destinoId, tipo, pId);
        rel.puertoSalida = sourceId;

        // Si el destino es el nodo FIN, marcar el origen como esUltimo automáticamente
        const destinoStep = esq.pasos.find((p: Paso) => p.id === destinoId);
        if (destinoStep?.tipoPaso === 'FIN') {
          const origenStep = esq.pasos.find((p: Paso) => p.id === padreId);
          if (origenStep) origenStep.esUltimo = true;
        }

        this.esquema.set(esq);
        this.autoguardar$.next();

        // Auto-open condition dialog when connecting FROM a GATEWAY
        const padreStep = esq.pasos.find((p: Paso) => p.id === padreId);
        if (padreStep?.tipoPaso === 'GATEWAY') {
          this.cargarCamposPadre(padreId);
          this.condicionEdit.set({
            id: rel.id,
            padreId,
            campoId: '',
            fuente: 'campo_formulario',
            operador: '=',
            valorEsperado: ''
          });
        }

        this.rt.emitirCambioEditor({
          politicaId: pId,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'relacion_creada',
          payload: rel
        });
      }
    });
  }

  onReassignConnection(ev: any): void {
    this.ngZone.run(() => {
      const pId = this.politicaId();
      if (!pId) return;
      const esq = { ...this.esquema() };
      
      const newTargetId = ev.nextTargetId || ev.newTargetId;
      const oldTargetId = ev.previousTargetId || ev.oldTargetId;
      const sourceId = ev.previousSourceId || ev.oldSourceId;

      if (!sourceId || !oldTargetId) return;

      // Find the existing relation
      const index = esq.relaciones.findIndex(r => 
        r.puertoSalida === sourceId && r.destinoId === oldTargetId.replace('-in', '')
      );

      if (index !== -1) {
        if (!newTargetId) {
          // Dropped in empty space -> Delete relation
          esq.relaciones.splice(index, 1);
        } else {
          // Reassigned to new target
          esq.relaciones[index].destinoId = newTargetId.replace('-in', '');
        }
        this.esquema.set(esq);
        this.autoguardar$.next();
      }
    });
  }

  private persistir(): void {
    const id = this.politicaId();
    if (!id) return;
    this.estadoGuardado.set('guardando');
    const esq = this.esquema();
    const esquemaActual = { ...esq, version: String(esq.version) };
    console.log('PERSISTIENDO ESQUEMA COMPLETO:', JSON.stringify(esquemaActual));

    this.flujoSvc.guardarEsquema(id, esquemaActual as any).subscribe({
      next: (res) => {
        console.log('RESPUESTA BACKEND TRAS PERSISTIR:', res);
        this.estadoGuardado.set('sincronizado');
        this.showToast.set(true);
        setTimeout(() => this.showToast.set(false), 2500);
      },
      error: (err) => {
        console.error('ERROR AL PERSISTIR:', err);
        this.estadoGuardado.set('error');
        setTimeout(() => this.estadoGuardado.set('sincronizado'), 4000);
      }
    });
  }

  volver(): void { this.router.navigate(['/admin/politicas']); }

  abrirEditarPaso(p: Paso) {
    this.ngZone.run(() => {
      // Usar padreId del paso directamente (seteado por IA o manualmente)
      // Fallback: buscar relación tipo 'hijo' para compatibilidad con diagramas manuales
      let pId: string | null = (p as any).padreId || null;
      if (!pId) {
        const relacionHijo = this.esquema().relaciones.find(
          (r) => r.destinoId === p.id && r.tipo === 'hijo',
        );
        pId = relacionHijo ? relacionHijo.padreId : null;
      }

      this.padreIdActualParaPaso.set(pId);
      this.pasoEdit.set({ ...p }); // Clonamos para evitar mutaciones directas indeseadas
    });
  }

  guardarPasoEditado(ev: { paso: Paso; padreId: string | null }) {
    this.ngZone.run(() => {
      const esq = { ...this.esquema() };
      
      // 1. Actualizar datos básicos del paso
      this.flujoSvc.actualizarPasoLocal(esq, ev.paso.id, ev.paso);

      // 2. Gestionar la Jerarquía
      esq.relaciones = esq.relaciones.filter(r => !(r.destinoId === ev.paso.id && r.tipo === 'hijo'));

      if (ev.padreId) {
        this.flujoSvc.crearRelacionLocal(
          esq,
          ev.padreId,
          ev.paso.id,
          'hijo',
          this.politicaId() || ''
        );
      }

      this.esquema.set(esq);
      this.pasoEdit.set(null);
      this.persistir();

      const pId = this.politicaId();
      if (pId) {
        this.rt.emitirCambioEditor({
          politicaId: pId,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'paso_actualizado',
          payload: ev.paso
        });
      }
    });
  }

  nodoEliminar = signal<Paso | null>(null);
  debugLog = signal<string>('Init');

  constructor() {}

  eliminarPaso(p: Paso) { 
    this.ngZone.run(() => {
      this.nodoEliminar.set(p);
    });
  }

  eliminarRelacion(rel: FlujoRelacion, ev: Event) {
    ev.stopPropagation();
    this.ngZone.run(() => {
      const esq = { ...this.esquema() };
      esq.relaciones = esq.relaciones.filter(r => r.id !== rel.id);
      this.esquema.set(esq);
      this.persistir(); // Guardado instantáneo — acción atómica

      const pId = this.politicaId();
      if (pId) {
        this.rt.emitirCambioEditor({
          politicaId: pId,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'relacion_eliminada',
          payload: { id: rel.id }
        });
      }
    });
  }

  confirmarEliminacion() {
    this.ngZone.run(() => {
      const p = this.nodoEliminar();
      if(p) {
        const esq = { ...this.esquema() };
        this.flujoSvc.eliminarPasoLocal(esq, p.id);
        this.esquema.set(esq);
        this.persistir(); // Guardado instantáneo — acción atómica

        const pId = this.politicaId();
        if (pId) {
          this.rt.emitirCambioEditor({
            politicaId: pId,
            usuarioId: this.miUsuarioId,
            usuarioNombre: this.miUsuarioNombre,
            tipo: 'paso_eliminado',
            payload: { id: p.id }
          });
        }
      }
      this.nodoEliminar.set(null);
    });
  }

  abrirEditorFormulario(formId: string | null, nombre?: string) {
    this.ngZone.run(() => {
      const pid = this.politicaId();
      if (!pid) return;
      if (formId) {
        // Cargar el formulario completo y abrir el editor
        this.formSvc.obtener(formId).subscribe(f => {
          if (f) this.formularioEdit.set(f);
        });
      } else {
        // Crear formulario nuevo con nombre personalizado si existe
        this.formSvc.crear({ politicaId: pid, nombre: nombre || 'Nuevo Formulario', campos: [] }).subscribe(f => {
          this.formularios.update(list => [...list, f]);

          // Auto-vincular al paso que se está editando si aún no tiene formulario
          const currentPaso = this.pasoEdit();
          if (currentPaso && !currentPaso.formularioId) {
            const esq = { ...this.esquema() };
            this.flujoSvc.actualizarPasoLocal(esq, currentPaso.id, { formularioId: f.id });
            this.esquema.set(esq);
            this.pasoEdit.set({ ...currentPaso, formularioId: f.id });
            this.autoguardar$.next();
          }

          this.formularioEdit.set(f);
        });
      }
    });
  }

  onFormularioActualizado(f: any) {
    // Refrescar la lista de formularios con la versión actualizada
    this.formularios.update(list => list.map(x => x.id === f.id ? f : x));
    this.formularioEdit.set(f);
  }

  showToast = signal(false);
  condicionEdit = signal<any | null>(null);

  // Carril picker
  showCarrilPicker = signal(false);
  carrilPickerDeptId = signal<string>('');
  carrilPickerNombre = signal<string>('');
  carrilPickerFuncionarioId = signal<string>('');
  carrilEditandoId = signal<string | null>(null);
  funcionarios = signal<any[]>([]);

  funcionariosFiltrados = computed(() => {
    const deptId = this.carrilPickerDeptId();
    const todos = this.funcionarios();
    if (!deptId) return todos;
    return todos.filter(f => !f.unidad_id || f.unidad_id === deptId);
  });

  abrirCondicion(p: Paso) {
    this.ngZone.run(() => {
      this.cargarCamposPadre(p.id);
      const salientes = this.esquema().relaciones.filter(r => r.padreId === p.id);
      const relacionObjetivo = salientes.find(r => r.tipo === 'condicional') ?? salientes[0] ?? null;
      this.condicionEdit.set({
        id: relacionObjetivo?.id,
        padreId: p.id,
        campoId: relacionObjetivo?.condicion?.campoId || '',
        variableSistema: relacionObjetivo?.condicion?.variableSistema || 'estado_anterior',
        fuente: relacionObjetivo?.condicion?.fuente || 'campo_formulario',
        operador: relacionObjetivo?.condicion?.operador || '=',
        valorEsperado: relacionObjetivo?.condicion?.valorEsperado || ''
      });
    });
  }

  camposDisponiblesParaCampo(): CampoFormulario[] {
    const formId = this.campoConfigFormId();
    if (!formId) return [];
    return this.formularios().find((f) => f.id === formId)?.campos ?? [];
  }

  cerrarCampoConfiguracion(): void {
    this.campoConfigFormId.set(null);
    this.campoConfigTipo.set('texto');
  }

  abrirCampoConfiguracionEnPaso(paso: Paso, tipo: TipoCampo): void {
    const pid = this.politicaId();
    if (!pid) return;

    const abrir = (formularioId: string) => {
      this.campoConfigFormId.set(formularioId);
      this.campoConfigTipo.set(tipo);
    };

    if (paso.formularioId) {
      abrir(paso.formularioId);
      return;
    }

    this.formSvc.crear({ politicaId: pid, nombre: paso.nombre || 'Formulario del paso', campos: [] }).subscribe((formulario) => {
      this.formularios.update((list) => [...list, formulario]);
      const esq = { ...this.esquema() };
      this.flujoSvc.actualizarPasoLocal(esq, paso.id, { formularioId: formulario.id });
      this.esquema.set(esq);
      this.autoguardar$.next();
      abrir(formulario.id);
    });
  }

  guardarCampoConfigurado(campo: CampoFormulario): void {
    const formId = this.campoConfigFormId();
    if (!formId) return;

    const formularioActual = this.formularios().find((f) => f.id === formId);
    if (!formularioActual) return;

    const campoNormalizado: CampoFormulario = {
      ...campo,
      formularioId: formId,
      orden: campo.orden || (formularioActual.campos?.length ?? 0) + 1,
    };

    const camposActuales = (formularioActual.campos || []) as CampoFormulario[];
    const existe = camposActuales.some((c: CampoFormulario) => c.id === campoNormalizado.id);
    const request$ = existe
      ? this.formSvc.actualizarCampo(formId, campoNormalizado.id, campoNormalizado)
      : this.formSvc.agregarCampo(formId, campoNormalizado);

    request$.subscribe({
      next: (campoGuardado) => {
        const campos = existe
          ? camposActuales.map((c: CampoFormulario) => c.id === campoGuardado.id ? campoGuardado : c)
          : [...camposActuales, campoGuardado];
        const formularioActualizado = { ...formularioActual, campos };

        this.formularios.update((list) => list.map((f) => f.id === formId ? formularioActualizado : f));
        if (this.formularioEdit()?.id === formId) {
          this.formularioEdit.set(formularioActualizado);
        }
        this.cerrarCampoConfiguracion();
      },
      error: () => {
        this.estadoGuardado.set('error');
      },
    });
  }

  guardarCondicion(condicion: any) {
    this.ngZone.run(() => {
      let relId = this.condicionEdit()?.id;
      if (!relId) {
        const padreId = this.condicionEdit()?.padreId;
        if (padreId) {
          const salientes = this.esquema().relaciones.filter(r => r.padreId === padreId);
          if (salientes.length === 1) {
            relId = salientes[0].id;
          } else {
            const preferida = salientes.find(r => r.tipo === 'condicional');
            relId = preferida?.id;
          }
        }
      }

      if (relId) {
        const esq = {
          ...this.esquema(),
          relaciones: this.esquema().relaciones.map(r =>
            r.id === relId ? { ...r, condicion, tipo: 'condicional' as const } : r
          )
        };
        this.esquema.set(esq);
        this.persistir(); // Guardado instantáneo — acción atómica

        const pId = this.politicaId();
        if (pId) {
          this.rt.emitirCambioEditor({
            politicaId: pId,
            usuarioId: this.miUsuarioId,
            usuarioNombre: this.miUsuarioNombre,
            tipo: 'condicion_actualizada',
            payload: { id: relId, condicion, tipo: 'condicional' }
          });
        }
      }
      this.condicionEdit.set(null);
    });
  }

  editarCondicion(r: FlujoRelacion) {
    // Abre el modal de condición con los datos de la relación (para editar su ReglaCondicion)
    this.ngZone.run(() => {
      this.cargarCamposPadre(r.padreId);
      this.condicionEdit.set({
        id: r.id,
        padreId: r.padreId,
        campoId: r.condicion?.campoId || '',
        operador: r.condicion?.operador || '=',
        valorEsperado: r.condicion?.valorEsperado || ''
      });
    });
  }

  /**
   * Carga los campos del formulario del paso padre para el modal de condición.
   * Busca el paso por ID → obtiene su formularioId → carga los campos del formulario.
   */
  private cargarCamposPadre(pasoId: string): void {
    this.camposPadreCondicion.set([]); // Reset mientras carga
    const paso = this.esquema().pasos.find(p => p.id === pasoId);
    if (!paso?.formularioId) return;
    this.formSvc.obtener(paso.formularioId).subscribe(f => {
      if (f && f.campos) {
        this.camposPadreCondicion.set(f.campos);
      }
    });
  }

  describirCondicion(rel: FlujoRelacion): string {
    const c = rel.condicion;
    if (!c || !c.valorEsperado) return '[condición]';
    const op = c.operador || '=';
    const val = c.valorEsperado;
    if (c.fuente === 'variable_sistema' && c.variableSistema) {
      return `[${c.variableSistema} ${op} ${val}]`;
    }
    if (c.campoId) return `[${c.campoId} ${op} ${val}]`;
    return `[${val}]`;
  }

  // ── PALETA DRAG-AND-DROP ────────────────────────────────────────
  onPaletteDrag(tipo: TipoPaso, event: DragEvent, campotipo?: Paso['campotipo']): void {
    this.draggedTipoPaso = tipo;
    this.draggedCampotipo = campotipo ?? null;
    event.dataTransfer!.setData('tipoPaso', tipo);
    event.dataTransfer!.effectAllowed = 'copy';
  }

  onCanvasDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  private labelParaCampotipo(ct: Paso['campotipo']): string {
    const m: Record<string, string> = {
      texto: 'Campo de Texto', texto_largo: 'Observaciones', numero: 'Número',
      lista: 'Selección', si_no: 'Sí / No', fecha: 'Fecha', firma: 'Firma', archivo: 'Archivo', label: 'Etiqueta', grid: 'Tabla',
    };
    return ct ? (m[ct] ?? ct) : 'Paso';
  }

  onCanvasDrop(event: DragEvent): void {
    event.preventDefault();
    const tipo = (event.dataTransfer?.getData('tipoPaso') || this.draggedTipoPaso) as TipoPaso | null;
    const campotipo = this.draggedCampotipo;
    this.draggedTipoPaso = null;
    this.draggedCampotipo = null;
    if (!tipo) return;
    const pid = this.politicaId();
    if (!pid) return;

    if (campotipo) {
      const pasoDestino = this.buscarPasoBajoPuntero(event);
      if (pasoDestino && (!pasoDestino.tipoPaso || pasoDestino.tipoPaso === 'TAREA')) {
        this.abrirCampoConfiguracionEnPaso(pasoDestino, campotipo);
      } else {
        alert('Suelta el atributo sobre una tarea para incrustarlo dentro del nodo.');
      }
      return;
    }

    // Asegurar referencia al wrapper
    if (!this._canvasWrapperEl) {
      this._canvasWrapperEl = (event.currentTarget as HTMLElement);
    }
    const worldPos = this.screenToWorld(this._canvasWrapperEl!, event.clientX, event.clientY);

    // Solo un nodo INICIO y un nodo FIN
    const yaExiste = this.esquema().pasos.some(p => p.tipoPaso === tipo);
    if ((tipo === 'INICIO' || tipo === 'FIN') && yaExiste) {
      alert(`Solo puede haber un nodo de tipo ${tipo} en el diagrama.`);
      return;
    }

    const nombreDefault: Record<TipoPaso, string> = {
      INICIO: 'Iniciar Solicitud',
      FIN: 'Finalizar Proceso',
      TAREA: 'Nueva Tarea',
      GATEWAY: 'Evaluar Datos'
    };
    const nombre = campotipo ? this.labelParaCampotipo(campotipo) : nombreDefault[tipo];

    this.ngZone.run(() => {
      const esq = { ...this.esquema() };
      const nuevo = this.flujoSvc.crearPasoLocal(esq, {
        politicaId: pid,
        nombre,
        obligatorio: true,
        tipoPaso: tipo,
        esUltimo: tipo === 'FIN',
        campotipo: campotipo ?? undefined,
        x: worldPos.x,
        y: worldPos.y
      });
      // Asignar departamento según el carril donde se soltó (world Y)
      try {
        const laneIndex = this.laneIndexFromWorldY(worldPos.y);
        const lane = this.carriles()[laneIndex];
        if (lane) {
          const deptId = lane.departamentoId || lane.id;
          this.flujoSvc.actualizarPasoLocal(esq, nuevo.id, { departamentoId: deptId });
          const idx = esq.pasos.findIndex((p: any) => p.id === nuevo.id);
          if (idx !== -1) esq.pasos[idx] = { ...esq.pasos[idx], departamentoId: deptId };
        }
      } catch (e) {
        console.warn('No se pudo asignar departamento por carril:', e);
      }
      this.esquema.set(esq);
      this.autoguardar$.next();

      const rt = this.rt;
      if (pid) {
        rt.emitirCambioEditor({
          politicaId: pid,
          usuarioId: this.miUsuarioId,
          usuarioNombre: this.miUsuarioNombre,
          tipo: 'paso_creado',
          payload: nuevo
        });
      }
    });
  }

  private buscarPasoBajoPuntero(event: DragEvent): Paso | null {
    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    
    // Intento 1: Buscar ancestro directo con data-paso-id
    let nodo = target?.closest('[data-paso-id]') as HTMLElement | null;
    let pasoId = nodo?.dataset?.['pasoId'];

    // Intento 2: Si el drop cayó sobre el overlay de selección de Foblex u otro elemento contenedor
    if (!pasoId && target) {
      const fNode = target.closest('f-node');
      if (fNode) {
        // Encontrar nuestro compact-node interno
        const hijoConId = fNode.querySelector('[data-paso-id]') as HTMLElement | null;
        if (hijoConId) {
          pasoId = hijoConId.dataset?.['pasoId'];
        }
      }
    }

    if (!pasoId) return null;
    return this.esquema().pasos.find((p) => p.id === pasoId) ?? null;
  }

  // ── GESTIÓN DE CARRILES ────────────────────────────────────────
  agregarCarril(): void {
    const depts = this.departamentos();
    if (depts.length > 0) {
      const first = depts[0];
      this.carrilPickerDeptId.set(first.id);
      this.carrilPickerNombre.set(first.nombre);
      this.showCarrilPicker.set(true);
    } else {
      const nombre = prompt('Nombre del nuevo carril:');
      if (!nombre?.trim()) return;
      this._pushCarril({ id: this.flujoSvc.uuid(), nombre: nombre.trim() });
    }
  }

  onPickerDeptChange(deptId: string): void {
    this.carrilPickerDeptId.set(deptId);
    const dept = this.departamentos().find((d: any) => d.id === deptId);
    if (dept) this.carrilPickerNombre.set(dept.nombre);
    // Limpiar funcionario si no pertenece a la nueva unidad
    const funcActual = this.carrilPickerFuncionarioId();
    if (funcActual && deptId) {
      const f = this.funcionarios().find((u: any) => u.id === funcActual);
      if (f && f.unidad_id && f.unidad_id !== deptId) {
        this.carrilPickerFuncionarioId.set('');
      }
    }
  }

  confirmarAgregarCarril(): void {
    const nombre = this.carrilPickerNombre().trim();
    if (!nombre) return;
    const funcId = this.carrilPickerFuncionarioId() || undefined;
    const funcNombre = funcId
      ? (this.funcionarios().find((f: any) => f.id === funcId)?.nombre_completo || undefined)
      : undefined;
    const editandoId = this.carrilEditandoId();
    if (editandoId) {
      // Editar carril existente
      const esq = { ...this.esquema() };
      const base = esq.carriles && esq.carriles.length > 0 ? esq.carriles : [...this.DEFAULT_CARRILES];
      esq.carriles = base.map(c => c.id === editandoId
        ? { ...c, nombre, departamentoId: this.carrilPickerDeptId() || c.departamentoId, funcionarioAsignadoId: funcId, funcionarioAsignadoNombre: funcNombre }
        : c);
      this.esquema.set(esq);
      this.autoguardar$.next();
      this.carrilEditandoId.set(null);
    } else {
      this._pushCarril({ id: this.flujoSvc.uuid(), nombre, departamentoId: this.carrilPickerDeptId() || undefined, funcionarioAsignadoId: funcId, funcionarioAsignadoNombre: funcNombre });
    }
    this.showCarrilPicker.set(false);
  }

  editarCarril(carrilId: string): void {
    const carril = this.carriles().find(c => c.id === carrilId);
    if (!carril) return;
    this.carrilEditandoId.set(carrilId);
    this.carrilPickerNombre.set(carril.nombre);
    this.carrilPickerDeptId.set(carril.departamentoId || '');
    this.carrilPickerFuncionarioId.set(carril.funcionarioAsignadoId || '');
    this.showCarrilPicker.set(true);
  }

  private _pushCarril(c: Carril): void {
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? esq.carriles : [...this.DEFAULT_CARRILES];
    esq.carriles = [...base, c];
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  renombrarCarril(id: string): void {
    const actual = this.carriles().find(c => c.id === id)?.nombre ?? '';
    const nuevo = prompt('Nuevo nombre del carril:', actual);
    if (!nuevo?.trim() || nuevo.trim() === actual) return;
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? esq.carriles : [...this.DEFAULT_CARRILES];
    esq.carriles = base.map(c => c.id === id ? { ...c, nombre: nuevo.trim() } : c);
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  eliminarCarril(id: string): void {
    if (this.carriles().length <= 1) { alert('Debe haber al menos un carril.'); return; }
    if (!confirm('¿Eliminar este carril? Los nodos asignados a él quedarán sin departamento.')) return;
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? esq.carriles : [...this.DEFAULT_CARRILES];
    esq.carriles = base.filter(c => c.id !== id);
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  startEditLane(id: string): void {
    const lane = this.carriles().find(c => c.id === id);
    this.editingLaneName.set(lane?.nombre ?? '');
    this.editingLaneId.set(id);
  }

  finishEditLane(): void {
    const id = this.editingLaneId();
    const nombre = this.editingLaneName().trim();
    this.editingLaneId.set(null);
    if (!id || !nombre) return;
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? esq.carriles : [...this.DEFAULT_CARRILES];
    esq.carriles = base.map(c => c.id === id ? { ...c, nombre } : c);
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  moverCarrilArriba(id: string): void {
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? [...esq.carriles] : [...this.DEFAULT_CARRILES];
    const idx = base.findIndex(c => c.id === id);
    if (idx <= 0) return;
    [base[idx - 1], base[idx]] = [base[idx], base[idx - 1]];
    esq.carriles = base;
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  moverCarrilAbajo(id: string): void {
    const esq = { ...this.esquema() };
    const base = esq.carriles && esq.carriles.length > 0 ? [...esq.carriles] : [...this.DEFAULT_CARRILES];
    const idx = base.findIndex(c => c.id === id);
    if (idx >= base.length - 1) return;
    [base[idx], base[idx + 1]] = [base[idx + 1], base[idx]];
    esq.carriles = base;
    this.esquema.set(esq);
    this.autoguardar$.next();
  }

  getConnectionLabel(rel: FlujoRelacion): string {
    if (rel.condicion || rel.tipo === 'condicional') return this.describirCondicion(rel);
    const padreStep = this.esquema().pasos.find(p => p.id === rel.padreId);
    if (padreStep?.tipoPaso === 'GATEWAY') {
      return rel.puertoSalida?.includes('cond') ? '[No]' : '[Sí]';
    }
    return 'siguiente';
  }

  exportarUML(): void {
    const id = this.politicaId();
    if (!id) return;
    this.http.get(`${environment.apiUrl}/politicas/${id}/exportar-xmi`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `politica_${id}_uml25.xmi`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: () => alert('Error al exportar el XMI. Verifica que el backend esté activo.')
      });
  }

  generarConIA(): void {
    const id = this.politicaId();
    if (!id || !this.descripcionIA.trim()) return;
    this.generandoIA.set(true);
    this.iaError.set(null);
    this.iaSvc.generarDiagrama(this.descripcionIA.trim(), id).subscribe({
      next: (res) => {
        this.generandoIA.set(false);
        if (res?.error) {
          this.iaError.set(res.error);
          return;
        }
        this.mostrarIAPanel.set(false);
        this.descripcionIA = '';
        this.cargarDatos(id);
      },
      error: () => {
        this.generandoIA.set(false);
        this.iaError.set('Error al conectar con el servicio de IA. Verifica que FastAPI esté activo.');
      }
    });
  }

  editarConIA(): void {
    const id = this.politicaId();
    if (!id || !this.instruccionEdicion.trim()) return;
    this.generandoIA.set(true);
    this.iaError.set(null);
    this.iaSvc.editarDiagrama(id, this.instruccionEdicion.trim()).subscribe({
      next: (res) => {
        this.generandoIA.set(false);
        if (res?.error) {
          this.iaError.set(res.error);
          return;
        }
        this.mostrarIAPanel.set(false);
        this.instruccionEdicion = '';
        this.cargarDatos(id);
      },
      error: () => {
        this.generandoIA.set(false);
        this.iaError.set('Error al conectar con el servicio de IA. Verifica que FastAPI esté activo.');
      }
    });
  }

  // ============================================================
  // IA - GRABACIÓN DE VOZ
  // ============================================================
  toggleGrabacion(): void {
    if (this.grabandoVoz()) {
      this.detenerGrabacion();
    } else {
      this.iniciarGrabacion();
    }
  }

  private async iniciarGrabacion(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        
        const base64 = await this.blobToBase64(audioBlob);
        this.iaError.set(null);
        this.generandoIA.set(true); // Usamos el spinner mientras transcribe
        
        this.iaSvc.transcribirVoz(base64).subscribe({
          next: (res) => {
            this.generandoIA.set(false);
            if (res?.error) {
              this.iaError.set(res.error);
            } else if (res?.texto?.trim()) {
              this.descripcionIA = (this.descripcionIA.trim() + ' ' + res.texto).trim();
            } else {
              this.iaError.set('No se pudo transcribir el audio. Intenta de nuevo.');
            }
          },
          error: () => {
            this.generandoIA.set(false);
            this.iaError.set('Error al conectar con el servicio de IA.');
          }
        });
      };

      this.mediaRecorder.start();
      this.grabandoVoz.set(true);
    } catch (err) {
      this.iaError.set('Error accediendo al micrófono. Verifica los permisos.');
    }
  }

  private detenerGrabacion(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.grabandoVoz.set(false);
    }
  }

  toggleGrabacionEdicion(): void {
    if (this.grabandoVoz()) {
      this.detenerGrabacionEdicion();
    } else {
      this.iniciarGrabacionEdicion();
    }
  }

  private async iniciarGrabacionEdicion(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        const base64 = await this.blobToBase64(audioBlob);
        this.iaError.set(null);
        this.generandoIA.set(true);
        this.iaSvc.transcribirVoz(base64).subscribe({
          next: (res) => {
            this.generandoIA.set(false);
            if (res?.error) {
              this.iaError.set(res.error);
            } else if (res?.texto?.trim()) {
              this.instruccionEdicion = (this.instruccionEdicion.trim() + ' ' + res.texto).trim();
            } else {
              this.iaError.set('No se pudo transcribir el audio. Intenta de nuevo.');
            }
          },
          error: () => {
            this.generandoIA.set(false);
            this.iaError.set('Error al conectar con el servicio de IA.');
          }
        });
      };
      this.mediaRecorder.start();
      this.grabandoVoz.set(true);
    } catch (err) {
      this.iaError.set('Error accediendo al micrófono. Verifica los permisos.');
    }
  }

  private detenerGrabacionEdicion(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.grabandoVoz.set(false);
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.readAsDataURL(blob);
    });
  }
}
