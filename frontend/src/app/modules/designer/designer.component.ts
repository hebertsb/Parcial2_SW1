import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import * as joint from 'jointjs';
import { environment } from '../../../environments/environment';
import { IaAssistantFabComponent } from '../../shared/components/ia-assistant-fab/ia-assistant-fab.component';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-designer',
  standalone: true,
  imports: [CommonModule, FormsModule, IaAssistantFabComponent],
  template: `
    <div class="flex-1 flex overflow-hidden absolute inset-0 pt-16">
      <!-- SIDEBAR IZQUIERDO: Elementos -->
      <aside class="w-64 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-[4px_0_24px_rgba(19,27,46,0.02)]">
        <div class="p-4 border-b border-slate-200">
          <h2 class="text-[0.75rem] font-bold tracking-[0.05em] uppercase text-slate-500 font-label">Elementos</h2>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <h3 class="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400 mb-3 font-label">Eventos</h3>
            <div class="grid grid-cols-2 gap-2">
              <div draggable="true" (dragstart)="onDragStart($event, 'NODO_INICIO')" class="bg-white border border-slate-200 shadow-sm p-3 rounded-md flex flex-col items-center justify-center gap-2 cursor-grab hover:border-emerald-300 transition-colors">
                <div class="w-6 h-6 rounded-full border-2 border-emerald-500"></div>
                <span class="text-xs text-slate-800 font-medium">Inicio</span>
              </div>
              <div draggable="true" (dragstart)="onDragStart($event, 'NODO_FIN')" class="bg-white border border-slate-200 shadow-sm p-3 rounded-md flex flex-col items-center justify-center gap-2 cursor-grab hover:border-red-300 transition-colors">
                <div class="w-6 h-6 rounded-full border-4 border-red-500"></div>
                <span class="text-xs text-slate-800 font-medium">Fin</span>
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400 mb-3 font-label">Estructural</h3>
            <div class="space-y-2">
              <div draggable="true" (dragstart)="onDragStart($event, 'SWIMLANE')" class="bg-white border border-slate-200 shadow-sm p-3 rounded-md flex items-center gap-3 cursor-grab hover:border-purple-300 transition-colors">
                <span class="material-symbols-outlined text-[20px] text-purple-600">view_column</span>
                <span class="text-xs text-slate-800 font-medium">Calle (Swimlane)</span>
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-[0.65rem] font-bold tracking-widest uppercase text-slate-400 mb-3 font-label">Actividades</h3>
            <div class="space-y-2">
              <div draggable="true" (dragstart)="onDragStart($event, 'TASK')" class="bg-white border border-slate-200 shadow-sm p-3 rounded-md flex items-center gap-3 cursor-grab hover:border-blue-300 transition-colors">
                <div class="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-200">
                  <span class="material-symbols-outlined text-[16px]">task</span>
                </div>
                <span class="text-xs text-slate-800 font-medium">Tarea de Usuario</span>
              </div>
              <div draggable="true" (dragstart)="onDragStart($event, 'GATEWAY')" class="bg-white border border-slate-200 shadow-sm p-3 rounded-md flex items-center gap-3 cursor-grab hover:border-amber-300 transition-colors">
                <div class="w-6 h-6 rounded bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-200 rotate-45 scale-75">
                  <div class="w-full h-full border-2 border-amber-500"></div>
                </div>
                <span class="text-xs text-slate-800 font-medium">Decisión</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <!-- ZONA CENTRAL: Canvas JointJS -->
      <section class="flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
        <!-- Toolbar Superior -->
        <div class="h-14 bg-white/90 backdrop-blur-md flex items-center justify-between px-4 absolute top-4 left-4 right-4 z-10 rounded-xl shadow-[0px_4px_16px_rgba(19,27,46,0.04)] border border-slate-200">
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-1 border-r border-slate-200 pr-4">
              <button (click)="undo()" class="p-1.5 rounded text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"><span class="material-symbols-outlined text-[20px]">undo</span></button>
              <button (click)="redo()" class="p-1.5 rounded text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all"><span class="material-symbols-outlined text-[20px]">redo</span></button>
            </div>
            
            <!-- Selector de Política -->
            <div class="flex items-center gap-2">
              <select [(ngModel)]="politicaId" (change)="onPoliticaSeleccionada()" class="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg py-1.5 px-3 outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px] truncate">
                <option [ngValue]="null" disabled selected>Seleccione una Política...</option>
                @for (p of politicasDisponibles; track p.id) {
                  <option [value]="p.id">{{ p.nombre }} ({{ p.tipo_flujo }})</option>
                }
              </select>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <!-- Indicador de Autoguardado -->
            @if (politicaId) {
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full" [ngClass]="isSaving ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'"></span>
                {{ isSaving ? 'Guardando...' : 'Autoguardado Activo' }}
              </span>
            }

            <div class="flex items-center bg-slate-50 border border-slate-200 rounded-md p-0.5 ml-2">
              <button (click)="zoomOut()" class="p-1 rounded text-slate-500 hover:bg-white hover:shadow-sm"><span class="material-symbols-outlined text-[16px]">remove</span></button>
              <span class="text-xs font-bold text-slate-800 px-2 w-12 text-center">{{ (currentScale * 100) | number:'1.0-0' }}%</span>
              <button (click)="zoomIn()" class="p-1 rounded text-slate-500 hover:bg-white hover:shadow-sm"><span class="material-symbols-outlined text-[16px]">add</span></button>
            </div>
            <button (click)="exportarPNG()" [disabled]="!politicaId" class="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all disabled:opacity-50" title="Exportar PNG">
              <span class="material-symbols-outlined text-[20px]">image</span>
            </button>
            <button (click)="guardarDiagrama(true)" [disabled]="!politicaId" class="px-4 py-1.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-[0_2px_10px_rgba(37,99,235,0.2)] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <span class="material-symbols-outlined text-[16px]">save</span> Guardar Manual
            </button>
          </div>
        </div>

        <!-- Contenedor JointJS -->
        <div class="flex-1 w-full h-full relative canvas-grid" (dragover)="onDragOver($event)" (drop)="onDrop($event)">
          <div #paperContainer class="w-full h-full absolute inset-0 cursor-crosshair"></div>
        </div>

        <!-- Minimapa (Navigator Style) -->
        <div class="absolute bottom-4 right-4 w-64 h-48 bg-white border border-slate-300 shadow-lg rounded-md overflow-hidden z-10 flex flex-col">
          <div class="bg-slate-100 border-b border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">map</span> Navegador del Diagrama
          </div>
          <div class="flex-1 relative bg-slate-50">
            <div #minimapContainer class="w-full h-full absolute inset-0"></div>
          </div>
        </div>

        <app-ia-assistant-fab></app-ia-assistant-fab>

        <!-- Toast Notification -->
        @if (toast.visible) {
          <div class="absolute top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold transition-all duration-300 border"
            [ngClass]="toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'">
            <span class="material-symbols-outlined text-[20px]" [ngClass]="toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'">{{ toast.type === 'success' ? 'check_circle' : 'error' }}</span>
            {{ toast.message }}
          </div>
        }
      </section>

      <!-- SIDEBAR DERECHO: Propiedades (Estilo Enterprise Architect) -->
      @if (selectedNode) {
      <aside class="w-[320px] bg-[#f4f4f4] border-l border-slate-300 shadow-[-4px_0_24px_rgba(0,0,0,0.1)] flex flex-col shrink-0 z-20 relative font-sans h-full">
        <div class="p-2 bg-[#e0e0e0] border-b border-slate-400 flex items-center justify-between shadow-sm z-10">
          <div class="flex items-center gap-1.5">
             <span class="material-symbols-outlined text-[16px] text-slate-700">build_circle</span>
             <h2 class="text-[12px] font-bold text-slate-800">Propiedades</h2>
          </div>
          <button (click)="deseleccionarNodo()" class="p-0.5 hover:bg-slate-300 rounded transition-colors text-slate-600">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
        
        <div class="flex-1 overflow-y-auto bg-white">
          
          <!-- Category: General -->
          <div class="border-b border-slate-300">
            <div class="bg-[#f0f0f0] px-2 py-1 border-y border-slate-300 text-[11px] font-bold text-slate-800 flex items-center gap-1 cursor-default shadow-[inset_0_1px_0_white]">
              <span class="material-symbols-outlined text-[14px]">expand_more</span> General
            </div>
            <div class="p-2.5 space-y-2 text-[11px] bg-white">
               <div class="flex items-center">
                  <span class="w-24 text-slate-600 font-medium">Nombre</span>
                  <input type="text" [(ngModel)]="nodeProps.nombre" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1.5 py-1 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
               </div>
               <div class="flex items-center">
                  <span class="w-24 text-slate-600 font-medium">Tipo</span>
                <span class="flex-1 text-slate-800 font-bold">{{ nodeProps.tipo === 'TASK' ? 'Tarea' : (nodeProps.tipo === 'GATEWAY' ? 'Decisión' : (nodeProps.tipo === 'NODO_INICIO' ? 'Evento de Inicio' : (nodeProps.tipo === 'NODO_FIN' ? 'Evento de Fin' : 'Calle (Swimlane)'))) }}</span>
               </div>
               <div class="flex items-center">
                  <span class="w-24 text-slate-600 font-medium">Estereotipo</span>
                  <select class="flex-1 border border-slate-300 px-1 py-1 outline-none bg-white">
                     <option>&lt;ninguno&gt;</option>
                     <option>business process</option>
                     <option>system</option>
                  </select>
               </div>
            </div>
          </div>

          <!-- Category: Details -->
          <div class="border-b border-slate-300">
            <div class="bg-[#f0f0f0] px-2 py-1 border-y border-slate-300 text-[11px] font-bold text-slate-800 flex items-center gap-1 cursor-default shadow-[inset_0_1px_0_white]">
              <span class="material-symbols-outlined text-[14px]">expand_more</span> Detalles
            </div>
            <div class="p-2.5 space-y-2 text-[11px] bg-white">
               @if (nodeProps.tipo === 'TASK') {
                 <div class="flex items-center">
                    <span class="w-24 text-slate-600 font-medium">Unidad/Calle</span>
                    <select [(ngModel)]="nodeProps.unidad" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white">
                      <option value="CLIENTE">CLIENTE</option>
                      <option value="SISTEMA">SISTEMA</option>
                      <option value="UNI-001">UNI-001 (Ventas)</option>
                      <option value="UNI-002">UNI-002 (RRHH)</option>
                    </select>
                 </div>
                 <div class="flex flex-col mt-2">
                    <span class="text-slate-600 font-medium mb-1">Datos (Campos)</span>
                    <textarea [(ngModel)]="nodeProps.campos" (change)="updateNodeVisuals()" rows="3" class="w-full border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 font-mono text-[10px] resize-none"></textarea>
                 </div>
               }
               @if (nodeProps.tipo === 'SWIMLANE') {
                 <div class="space-y-3 border border-slate-200 bg-slate-50 p-3 rounded-md">
                   <div>
                     <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Nombre de la Calle</label>
                     <input type="text" [(ngModel)]="nodeProps.nombre" (input)="updateNodeVisuals()" class="w-full border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-[11px] bg-white" placeholder="Ej: UNI-001">
                   </div>
                   <div class="grid grid-cols-2 gap-2">
                     <div>
                       <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Posición X</label>
                       <input type="number" [(ngModel)]="nodeProps.posX" (input)="updateNodeVisuals()" class="w-full border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-[11px] bg-white">
                     </div>
                     <div>
                       <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Posición Y</label>
                       <input type="number" [(ngModel)]="nodeProps.posY" (input)="updateNodeVisuals()" class="w-full border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-[11px] bg-white">
                     </div>
                   </div>
                   <div class="grid grid-cols-2 gap-2">
                     <div>
                       <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Ancho</label>
                       <input type="number" [(ngModel)]="nodeProps.ancho" (input)="updateNodeVisuals()" class="w-full border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-[11px] bg-white" min="120">
                     </div>
                     <div>
                       <label class="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Alto</label>
                       <input type="number" [(ngModel)]="nodeProps.alto" (input)="updateNodeVisuals()" class="w-full border border-slate-300 rounded px-2.5 py-1.5 outline-none focus:border-blue-500 text-[11px] bg-white" min="120">
                     </div>
                   </div>
                   <p class="text-[10px] text-slate-500 leading-relaxed">
                     Consejo: arrastra la calle con clic izquierdo para moverla. Para redimensionar rápido usa <span class="font-semibold">Shift + rueda</span> (alto) y <span class="font-semibold">Shift + Alt + rueda</span> (ancho).
                   </p>
                 </div>
               }
               @if (nodeProps.tipo === 'GATEWAY') {
                 <div class="flex flex-col gap-3 mt-2">
                    <div class="flex items-center gap-2">
                      <span class="w-24 text-slate-600 font-medium">Tipo Regla</span>
                      <select [(ngModel)]="nodeProps.reglaDecision.tipo_operador" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px] uppercase">
                        <option value="simple">Simple</option>
                        <option value="compuesta">Compuesta</option>
                        <option value="entre">Entre Rangos</option>
                        <option value="multirrama">Multirrama</option>
                      </select>
                    </div>

                    @if (nodeProps.reglaDecision.tipo_operador === 'simple') {
                      <div class="space-y-2 border border-slate-200 bg-slate-50 p-2 rounded-md">
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Campo</span>
                          <input type="text" [(ngModel)]="nodeProps.reglaDecision.campo" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="monto_solicitado">
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Condición</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.condicion" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="&gt;">&gt;</option>
                            <option value="&lt;">&lt;</option>
                            <option value="==">==</option>
                            <option value=">=">&gt;=</option>
                            <option value="<=">&lt;=</option>
                            <option value="!=">!=</option>
                            <option value="contains">contiene</option>
                            <option value="startsWith">empieza con</option>
                            <option value="endsWith">termina con</option>
                          </select>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Valor</span>
                          <input type="text" [(ngModel)]="nodeProps.reglaDecision.valor_comparacion" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="100000">
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Si verdadero</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_verdadera" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Si falso</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_falsa" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }

                    @if (nodeProps.reglaDecision.tipo_operador === 'compuesta') {
                      <div class="space-y-2 border border-slate-200 bg-slate-50 p-2 rounded-md">
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Lógico</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.operador_logico" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        </div>
                        @for (condicion of nodeProps.reglaDecision.condiciones; track $index) {
                          <div class="grid grid-cols-3 gap-1.5">
                            <input type="text" [(ngModel)]="condicion.campo" (input)="updateNodeVisuals()" class="border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="campo">
                            <select [(ngModel)]="condicion.condicion" (change)="updateNodeVisuals()" class="border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                              <option value="&gt;">&gt;</option>
                              <option value="&lt;">&lt;</option>
                              <option value="==">==</option>
                              <option value=">=">&gt;=</option>
                              <option value="<=">&lt;=</option>
                              <option value="!=">!=</option>
                            </select>
                            <input type="text" [(ngModel)]="condicion.valor" (input)="updateNodeVisuals()" class="border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="valor">
                          </div>
                        }
                        <button type="button" (click)="agregarCondicion()" class="text-[10px] font-bold text-blue-600 hover:underline">+ Agregar condición</button>
                        <div class="flex items-center gap-2 pt-1">
                          <span class="w-24 text-slate-600 font-medium">Si verdadero</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_verdadera" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Si falso</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_falsa" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }

                    @if (nodeProps.reglaDecision.tipo_operador === 'entre') {
                      <div class="space-y-2 border border-slate-200 bg-slate-50 p-2 rounded-md">
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Campo</span>
                          <input type="text" [(ngModel)]="nodeProps.reglaDecision.campo" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="monto_solicitado">
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                          <div class="flex items-center gap-2">
                            <span class="w-16 text-slate-600 font-medium">Mín</span>
                            <input type="number" [(ngModel)]="nodeProps.reglaDecision.minimo" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 bg-white text-[10px]" placeholder="1000">
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="w-16 text-slate-600 font-medium">Máx</span>
                            <input type="number" [(ngModel)]="nodeProps.reglaDecision.maximo" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 bg-white text-[10px]" placeholder="100000">
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Dentro</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_dentro" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Fuera</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_fuera" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }

                    @if (nodeProps.reglaDecision.tipo_operador === 'multirrama') {
                      <div class="space-y-2 border border-slate-200 bg-slate-50 p-2 rounded-md">
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Campo</span>
                          <input type="text" [(ngModel)]="nodeProps.reglaDecision.campo" (input)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-2 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="tipo_credito">
                        </div>
                        @for (rama of nodeProps.reglaDecision.ramas; track $index) {
                          <div class="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                            <input type="text" [(ngModel)]="rama.valor" (input)="updateNodeVisuals()" class="border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 font-mono text-[10px] bg-white" placeholder="Valor">
                            <select [(ngModel)]="rama.nodo" (change)="updateNodeVisuals()" class="border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                              <option value="">Nodo destino</option>
                              @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                                <option [value]="nodo.id">{{ nodo.nombre }}</option>
                              }
                            </select>
                            @if (nodeProps.reglaDecision.ramas.length > 1) {
                              <button type="button" (click)="eliminarRama($index)" class="text-red-600 font-bold text-[10px]">✕</button>
                            }
                          </div>
                        }
                        <button type="button" (click)="agregarRama()" class="text-[10px] font-bold text-blue-600 hover:underline">+ Agregar rama</button>
                        <div class="flex items-center gap-2">
                          <span class="w-24 text-slate-600 font-medium">Por defecto</span>
                          <select [(ngModel)]="nodeProps.reglaDecision.rama_default" (change)="updateNodeVisuals()" class="flex-1 border border-slate-300 px-1 py-1 outline-none focus:border-blue-500 bg-white text-[10px]">
                            <option value="">Selecciona un nodo</option>
                            @for (nodo of obtenerNodosDisponibles(true); track nodo.id) {
                              <option [value]="nodo.id">{{ nodo.nombre }}</option>
                            }
                          </select>
                        </div>
                      </div>
                    }

                    <div class="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
                      {{ obtenerResumenRegla() }}
                    </div>
                 </div>
               }
            </div>
          </div>

          <!-- Actions -->
          <div class="p-3 bg-slate-50 border-t border-slate-200 mt-2">
            <button (click)="eliminarNodo()" class="w-full py-1.5 bg-white border border-slate-300 shadow-sm text-red-600 text-[11px] font-bold hover:bg-red-50 flex items-center justify-center gap-1 transition-colors">
              <span class="material-symbols-outlined text-[14px]">delete</span> Eliminar Elemento
            </button>
          </div>

        </div>
      </aside>
      }

    </div>
  `,
  styles: [`
    .canvas-grid {
      background-size: 20px 20px;
      background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
    }
    /* Estilos globales para JointJS injectados si es necesario */
    ::ng-deep .joint-paper { overflow: visible; }
    ::ng-deep .joint-element { cursor: move; }
  `]
})
export class DesignerComponent implements OnInit, AfterViewInit {
  @ViewChild('paperContainer', { static: true }) paperContainer!: ElementRef;
  @ViewChild('minimapContainer', { static: true }) minimapContainer!: ElementRef;

  private graph!: joint.dia.Graph;
  private paper!: joint.dia.Paper;
  private minimapPaper!: joint.dia.Paper;

  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  politicaId: string | null = null;
  apiUrl = environment.apiUrl;
  politicasDisponibles: any[] = [];

  // Variables para AutoGuardado
  private autoSaveInterval: any;
  private saveDebounce: any = null;
  isSaving = false;

  /** Guarda silenciosamente 1.5s después del último cambio del usuario */
  private scheduleAutoSave() {
    if (!this.politicaId) return;
    clearTimeout(this.saveDebounce);
    this.saveDebounce = setTimeout(() => this.guardarDiagrama(false), 1500);
  }

  // Toast de notificaciones
  toast = { visible: false, message: '', type: 'success' as 'success' | 'error' };
  private toastTimeout: any;

  showToast(message: string, type: 'success' | 'error' = 'success') {
    clearTimeout(this.toastTimeout);
    this.toast = { visible: true, message, type };
    this.toastTimeout = setTimeout(() => { this.toast.visible = false; }, 3500);
  }

  // Panning & Zooming
  private dragStartPosition: { x: number, y: number } | null = null;
  currentScale = 1;
  private swimlaneDragState: {
    elementId: string;
    startPointer: { x: number; y: number };
    startPosition: { x: number; y: number };
  } | null = null;

  // Estado del panel de propiedades
  selectedNode: joint.dia.Element | null = null;
  nodeProps = {
    nombre: '',
    tipo: '',
    unidad: 'CLIENTE',
    campos: '',
    posX: 0,
    posY: 0,
    ancho: 300,
    alto: 800,
    reglaDecision: {
      tipo_operador: 'simple',
      campo: '',
      condicion: '>=',
      valor_comparacion: '',
      rama_verdadera: '',
      rama_falsa: '',
      operador_logico: 'AND',
      condiciones: [{ campo: '', condicion: '>=', valor: '' }],
      minimo: null,
      maximo: null,
      rama_dentro: '',
      rama_fuera: '',
      ramas: [{ valor: '', nodo: '' }],
      rama_default: ''
    } as any
  };

  // Historial basado en acciones (NO usa fromJSON para no romper el viewport)
  private actionHistory: Array<{ type: 'add' | 'remove' | 'move', cell: joint.dia.Cell, fromPos?: { x: number, y: number }, toPos?: { x: number, y: number } }> = [];
  private redoHistory: Array<{ type: 'add' | 'remove' | 'move', cell: joint.dia.Cell, fromPos?: { x: number, y: number }, toPos?: { x: number, y: number } }> = [];
  private isUndoing = false;
  private historySaveTimeout: any = null;
  private _dragStartPos: { x: number, y: number } | null = null;

  ngOnInit() {
    const routeId = this.route.snapshot.queryParamMap.get('id');
    this.cargarListaPoliticas();

    if (routeId) {
      this.politicaId = routeId;
    }
  }

  ngAfterViewInit() {
    this.initJointJs();
    if (this.politicaId) {
      this.cargarDiagrama();
    }

    // Configurar autoguardado cada 30 segundos
    this.autoSaveInterval = setInterval(() => {
      if (this.politicaId && this.graph.getElements().length > 0) {
        this.guardarDiagrama(false);
      }
    }, 30000);
  }

  ngOnDestroy() {
    if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
    if (this.saveDebounce) clearTimeout(this.saveDebounce);
    // Guardar al salir por si hay cambios pendientes
    if (this.politicaId && this.graph?.getElements().length > 0) {
      this.guardarDiagrama(false);
    }
  }

  cargarListaPoliticas() {
    this.http.get<any[]>(`${this.apiUrl}/politicas`).subscribe({
      next: (data) => {
        this.politicasDisponibles = data;
      },
      error: (err) => console.error('Error cargando políticas', err)
    });
  }

  onPoliticaSeleccionada() {
    if (!this.politicaId) return;
    // Guardar cambios del diagrama actual ANTES de cambiar
    clearTimeout(this.saveDebounce);
    if (this.graph?.getElements().length > 0) {
      this.guardarDiagrama(false);
    }
    // Limpiar el lienzo y el historial
    this.isUndoing = true;
    this.graph.clear();
    this.actionHistory = [];
    this.redoHistory = [];
    this.deseleccionarNodo();
    this.isUndoing = false;
    this.cargarDiagramaDesdeBackend();
  }

  private scheduleHistorySnapshot(delayMs = 180) {
    if (this.isUndoing) return;
    if (this.historySaveTimeout) {
      clearTimeout(this.historySaveTimeout);
    }
    this.historySaveTimeout = setTimeout(() => {
      this.saveHistoryState();
      this.historySaveTimeout = null;
    }, delayMs);
  }

  private centerOnContent() {
    if (!this.paper || !this.graph || !this.paperContainer?.nativeElement) {
      return;
    }

    const elements = this.graph.getElements();
    if (!elements.length) {
      // Posición base cómoda cuando el diagrama está vacío.
      this.paper.translate(150, 100);
      return;
    }

    const focusElements = elements.filter(el => el.prop('customType') !== 'SWIMLANE');
    const elementsToCenter = focusElements.length > 0 ? focusElements : elements;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    elementsToCenter.forEach(el => {
      const b = el.getBBox();
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    });

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      this.paper.translate(150, 100);
      return;
    }

    const bbox = {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
    if (!bbox) {
      return;
    }
    const rect = this.paperContainer.nativeElement.getBoundingClientRect();
    const scale = this.paper.scale();

    const targetTx = rect.width / 2 - (bbox.x + bbox.width / 2) * scale.sx;
    const targetTy = rect.height / 2 - (bbox.y + bbox.height / 2) * scale.sy;
    this.paper.translate(targetTx, targetTy);
  }

  private centerOnElement(element: joint.dia.Element) {
    if (!this.paper || !this.paperContainer?.nativeElement) {
      return;
    }

    const bbox = element.getBBox();
    const rect = this.paperContainer.nativeElement.getBoundingClientRect();
    const scale = this.paper.scale();

    const targetTx = rect.width / 2 - (bbox.x + bbox.width / 2) * scale.sx;
    const targetTy = rect.height / 2 - (bbox.y + bbox.height / 2) * scale.sy;
    this.paper.translate(targetTx, targetTy);
  }


  private resetAndCenterViewport() {
    if (!this.paper || !this.graph || !this.paperContainer?.nativeElement) return;
    // Esperar para que JointJS haya procesado los cambios de fromJSON
    setTimeout(() => {
      const bbox = (this.graph as any).getBBox();
      if (!bbox || !Number.isFinite(bbox.x)) {
        this.paper.translate(150, 100);
        return;
      }

      const containerEl = this.paperContainer.nativeElement;
      const W = containerEl.offsetWidth || 800;
      const H = containerEl.offsetHeight || 600;
      const PADDING = 80;

      // Calcular escala para que todo el contenido entre con padding
      const scaleX = (W - PADDING * 2) / (bbox.width || 1);
      const scaleY = (H - PADDING * 2) / (bbox.height || 1);
      const newScale = Math.max(0.2, Math.min(1.5, Math.min(scaleX, scaleY)));

      this.currentScale = newScale;
      this.paper.scale(newScale, newScale);

      // Centrar en el contenido
      const tx = W / 2 - (bbox.x + bbox.width / 2) * newScale;
      const ty = H / 2 - (bbox.y + bbox.height / 2) * newScale;
      this.paper.translate(tx, ty);
    }, 100);
  }



  private isGraphVisibleInViewport(): boolean {
    if (!this.paper || !this.graph || !this.paperContainer?.nativeElement) {
      return true;
    }

    const elements = this.graph.getElements();
    if (!elements.length) {
      return true;
    }

    const bbox = this.graph.getBBox();
    if (!bbox) {
      return true;
    }
    const scale = this.paper.scale();
    const translate = this.paper.translate();
    const rect = this.paperContainer.nativeElement.getBoundingClientRect();

    const viewLeft = -translate.tx / scale.sx;
    const viewTop = -translate.ty / scale.sy;
    const viewRight = viewLeft + rect.width / scale.sx;
    const viewBottom = viewTop + rect.height / scale.sy;

    const intersects =
      bbox.x < viewRight &&
      bbox.x + bbox.width > viewLeft &&
      bbox.y < viewBottom &&
      bbox.y + bbox.height > viewTop;

    return intersects;
  }

  private ensureViewportShowsContent(retries = 6) {
    if (!this.paper || !this.graph) {
      return;
    }

    if (this.isGraphVisibleInViewport()) {
      return;
    }

    this.currentScale = 1;
    this.paper.scale(this.currentScale, this.currentScale);
    this.centerOnContent();

    if (retries > 0) {
      setTimeout(() => this.ensureViewportShowsContent(retries - 1), 80);
    }
  }

  private snapshotHasCells(snapshot: string | null | undefined): boolean {
    if (!snapshot) return false;
    try {
      const parsed = JSON.parse(snapshot);
      return Array.isArray(parsed?.cells) && parsed.cells.length > 0;
    } catch {
      return false;
    }
  }

  private screenToLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.paperContainer.nativeElement.getBoundingClientRect();
    const scale = this.paper.scale();
    const translate = this.paper.translate();

    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    return {
      x: (screenX - translate.tx) / scale.sx,
      y: (screenY - translate.ty) / scale.sy
    };
  }

  private ensureElementVisible(element: joint.dia.Element) {
    if (!this.paper || !this.paperContainer?.nativeElement) {
      return;
    }

    const bbox = element.getBBox();
    const scale = this.paper.scale();
    const translate = this.paper.translate();
    const rect = this.paperContainer.nativeElement.getBoundingClientRect();

    const viewLeft = -translate.tx / scale.sx;
    const viewTop = -translate.ty / scale.sy;
    const viewRight = viewLeft + rect.width / scale.sx;
    const viewBottom = viewTop + rect.height / scale.sy;

    const margin = 24;
    const visible =
      bbox.x >= viewLeft + margin &&
      bbox.y >= viewTop + margin &&
      bbox.x + bbox.width <= viewRight - margin &&
      bbox.y + bbox.height <= viewBottom - margin;

    if (!visible) {
      this.centerOnContent();
    }
  }

  private getSwimlaneAtPoint(x: number, y: number): joint.dia.Element | null {
    if (!this.graph) return null;

    const swimlanes = this.graph
      .getElements()
      .filter(el => el.prop('customType') === 'SWIMLANE');

    for (let i = swimlanes.length - 1; i >= 0; i--) {
      const lane = swimlanes[i];
      const pos = lane.position();
      const size = lane.size();
      const inside = x >= pos.x && x <= pos.x + size.width && y >= pos.y && y <= pos.y + size.height;
      if (inside) return lane;
    }

    return null;
  }

  private normalizarEsquemaWorkflow(esquema: any): any {
    if (!esquema) {
      return null;
    }

    if (typeof esquema === 'string') {
      try {
        return JSON.parse(esquema);
      } catch {
        return null;
      }
    }

    return esquema;
  }

  initJointJs() {
    this.graph = new joint.dia.Graph();
    this.paper = new joint.dia.Paper({
      el: this.paperContainer.nativeElement,
      model: this.graph,
      width: '100%',
      height: '100%',
      gridSize: 10,
      drawGrid: false, // Usamos el CSS grid de fondo
      background: { color: 'transparent' },
      defaultLink: new joint.shapes.standard.Link({
        attrs: {
          line: {
            stroke: '#333333',
            strokeWidth: 1.5,
            targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 Z' }
          }
        },
        router: { name: 'manhattan' },
        connector: { name: 'rounded' }
      }),
      interactive: (cellView: any) => {
        const model = cellView?.model;
        if (!model) return true;

        if (model.isLink && model.isLink()) {
          return { linkMove: true };
        }

        return true;
      },
      validateConnection: (cellViewS, magnetS, cellViewT, magnetT, end, linkView) => {
        // Prevenir conectar a sí mismo
        if (cellViewS === cellViewT) return false;
        return true;
      }
    });

    // Centrar el paper por defecto para que no empiece arriba
    this.paper.translate(150, 100);

    // Inicializar Minimapa (Navigator)
    this.minimapPaper = new joint.dia.Paper({
      el: this.minimapContainer.nativeElement,
      model: this.graph,
      width: '100%',
      height: '100%',
      gridSize: 1,
      interactive: false,
      background: { color: '#f8fafc' }
    });
    // Escalar el minimapa
    this.minimapPaper.scale(0.15, 0.15);
    this.minimapPaper.translate(50, 50);

    // ---- Historial basado en acciones ----
    // Registrar posición ANTES de mover un elemento
    this.paper.on('element:pointerdown', (elementView: any) => {
      if (!this.isUndoing) {
        const pos = elementView.model.position();
        this._dragStartPos = { x: pos.x, y: pos.y };
      }
    });
    // Registrar MOVIMIENTO al soltar → guardar automáticamente
    this.paper.on('element:pointerup', (elementView: any) => {
      if (!this.isUndoing && this._dragStartPos) {
        const el = elementView.model as joint.dia.Element;
        const newPos = el.position();
        if (newPos.x !== this._dragStartPos.x || newPos.y !== this._dragStartPos.y) {
          this.pushAction({ type: 'move', cell: el, fromPos: this._dragStartPos, toPos: { x: newPos.x, y: newPos.y } });
          this.scheduleAutoSave(); // ← Guardar tras mover
        }
        this._dragStartPos = null;
      }
    });
    // Registrar conexión de flechas → guardar automáticamente
    this.paper.on('link:connect', (linkView: any) => {
      if (!this.isUndoing) {
        this.pushAction({ type: 'add', cell: linkView.model });
        this.scheduleAutoSave(); // ← Guardar tras conectar
      }
    });

    // ---- Panning (Arrastrar el lienzo) ----
    this.paper.on('blank:pointerdown', (evt: any, x: number, y: number) => {
      const swimlane = this.getSwimlaneAtPoint(x, y);
      if (swimlane) {
        const pos = swimlane.position();
        this.swimlaneDragState = {
          elementId: String(swimlane.id),
          startPointer: { x, y },
          startPosition: { x: pos.x, y: pos.y }
        };
        this.seleccionarNodo(swimlane);
        this.paperContainer.nativeElement.style.cursor = 'grabbing';
        return;
      }

      const isMiddleButton = evt.button === 1;
      const isAltDrag = !!evt.altKey;
      if (!isMiddleButton && !isAltDrag) {
        return;
      }

      this.dragStartPosition = { x: evt.clientX, y: evt.clientY };
      this.paperContainer.nativeElement.style.cursor = 'grab';
    });

    this.paper.on('cell:pointerup blank:pointerup', () => {
      this.dragStartPosition = null;
      this.swimlaneDragState = null;
      this.paperContainer.nativeElement.style.cursor = 'crosshair';
    });

    this.paperContainer.nativeElement.addEventListener('mousemove', (evt: MouseEvent) => {
      if (this.swimlaneDragState) {
        const lane = this.graph.getCell(this.swimlaneDragState.elementId) as joint.dia.Element | null;
        if (!lane) {
          this.swimlaneDragState = null;
          return;
        }

        const localPoint = this.screenToLocal(evt.clientX, evt.clientY);
        const dx = localPoint.x - this.swimlaneDragState.startPointer.x;
        const dy = localPoint.y - this.swimlaneDragState.startPointer.y;
        const nextX = this.swimlaneDragState.startPosition.x + dx;
        const nextY = this.swimlaneDragState.startPosition.y + dy;

        lane.position(nextX, nextY);

        if (this.selectedNode?.id === lane.id) {
          this.nodeProps.posX = Math.round(nextX);
          this.nodeProps.posY = Math.round(nextY);
        }

        this.paperContainer.nativeElement.style.cursor = 'grabbing';
        return;
      }

      if (this.dragStartPosition) {
        this.paperContainer.nativeElement.style.cursor = 'grabbing';
        const ctm = this.paper.matrix();
        const dx = evt.clientX - this.dragStartPosition.x;
        const dy = evt.clientY - this.dragStartPosition.y;
        this.paper.translate(ctm.e + dx, ctm.f + dy);
        this.dragStartPosition = { x: evt.clientX, y: evt.clientY };
      }
    });

    // ---- Zooming (Rueda del Ratón) ----
    this.paperContainer.nativeElement.addEventListener('wheel', (evt: WheelEvent) => {
      const selectedType = this.selectedNode?.prop('customType');
      if (selectedType === 'SWIMLANE' && evt.shiftKey) {
        evt.preventDefault();
        const size = this.selectedNode!.size();
        const delta = evt.deltaY > 0 ? -20 : 20;

        // Shift + rueda: cambia altura. Shift + Alt + rueda: cambia ancho.
        const newWidth = evt.altKey ? Math.max(120, size.width + delta) : size.width;
        const newHeight = evt.altKey ? size.height : Math.max(120, size.height + delta);

        this.selectedNode!.resize(newWidth, newHeight);
        this.nodeProps.ancho = Math.round(newWidth);
        this.nodeProps.alto = Math.round(newHeight);
        return;
      }

      evt.preventDefault(); // Evitar scroll de la página
      const delta = Math.sign(evt.deltaY) * -1; // 1 = zoom in, -1 = zoom out
      const oldScale = this.currentScale;

      this.currentScale += delta * 0.1;
      this.currentScale = Math.max(0.2, Math.min(3, this.currentScale)); // Limites de zoom (20% a 300%)

      const localPoint = this.paper.clientToLocalPoint({ x: evt.clientX, y: evt.clientY });

      this.paper.scale(this.currentScale, this.currentScale);

      const newLocalPoint = this.paper.clientToLocalPoint({ x: evt.clientX, y: evt.clientY });
      const currentTranslate = this.paper.translate();

      // Ajustar translación para que el zoom siga al puntero
      this.paper.translate(
        currentTranslate.tx + (newLocalPoint.x - localPoint.x) * this.currentScale,
        currentTranslate.ty + (newLocalPoint.y - localPoint.y) * this.currentScale
      );
    });

    // ---- Minimap Viewport Indicator ----
    const minimapRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    minimapRect.setAttribute('fill', 'rgba(59, 130, 246, 0.15)');
    minimapRect.setAttribute('stroke', '#2563eb');
    minimapRect.setAttribute('stroke-width', '10'); // Escala compensada en el minimapa
    minimapRect.style.pointerEvents = 'auto'; // Hacerlo clickeable/arrastrable
    minimapRect.style.cursor = 'move';
    this.minimapPaper.svg.appendChild(minimapRect);

    let isDraggingMinimap = false;
    let minimapDragStart = { x: 0, y: 0 };
    let paperTranslateStart = { tx: 0, ty: 0 };

    minimapRect.addEventListener('mousedown', (e: MouseEvent) => {
      isDraggingMinimap = true;
      minimapDragStart = { x: e.clientX, y: e.clientY };
      paperTranslateStart = this.paper.translate();
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!isDraggingMinimap) return;
      const dx = e.clientX - minimapDragStart.x;
      const dy = e.clientY - minimapDragStart.y;
      const scale = this.paper.scale();
      const minimapScale = this.minimapPaper.scale();

      // Ajustar translación inversamente proporcional a la escala del minimapa
      const newTx = paperTranslateStart.tx - (dx / minimapScale.sx) * scale.sx;
      const newTy = paperTranslateStart.ty - (dy / minimapScale.sy) * scale.sy;

      this.paper.translate(newTx, newTy);
    });

    window.addEventListener('mouseup', () => {
      isDraggingMinimap = false;
      if (this.swimlaneDragState) {
        this.swimlaneDragState = null;
        this.scheduleHistorySnapshot(0);
      }
    });

    const updateMinimapViewport = () => {
      const scale = this.paper.scale();
      const translation = this.paper.translate();
      const paperRect = this.paperContainer.nativeElement.getBoundingClientRect();

      const x = -translation.tx / scale.sx;
      const y = -translation.ty / scale.sy;
      const w = paperRect.width / scale.sx;
      const h = paperRect.height / scale.sy;

      minimapRect.setAttribute('x', x.toString());
      minimapRect.setAttribute('y', y.toString());
      minimapRect.setAttribute('width', w.toString());
      minimapRect.setAttribute('height', h.toString());
    };

    this.paper.on('translate scale', updateMinimapViewport);
    setTimeout(updateMinimapViewport, 100);

    // ---- Auto-Eliminar Flechas Sueltas (Huérfanas) ----
    this.paper.on('link:pointerup', (linkView: any) => {
      const link = linkView.model;
      if (!link.getTargetElement()) {
        link.remove(); // Destruye la línea si no conectó con nada
      }
    });

    // Cursor visual para swimlane al pasar el mouse
    this.paper.on('element:pointermove', (elementView: any) => {
      const element = elementView.model as joint.dia.Element;
      if (element.prop('customType') === 'SWIMLANE') {
        this.paperContainer.nativeElement.style.cursor = 'move';
      }
    });

    // Eventos de selección para abrir el panel de propiedades
    this.paper.on('element:pointerclick', (elementView: any) => {
      this.seleccionarNodo(elementView.model);
    });

    this.paper.on('blank:pointerclick', () => {
      this.deseleccionarNodo();
    });
  }

  // Historial de acciones
  private pushAction(action: { type: 'add' | 'remove' | 'move', cell: joint.dia.Cell, fromPos?: { x: number, y: number }, toPos?: { x: number, y: number } }) {
    if (this.isUndoing) return;
    this.actionHistory.push(action);
    if (this.actionHistory.length > 100) this.actionHistory.shift();
    this.redoHistory = [];
  }

  saveHistoryState() { /* legacy no-op, no longer used */ }

  undo() {
    if (this.actionHistory.length === 0) return;
    this.isUndoing = true;
    const action = this.actionHistory.pop()!;
    this.redoHistory.push(action);
    switch (action.type) {
      case 'add': action.cell.remove(); break;
      case 'remove': action.cell.addTo(this.graph); break;
      case 'move': (action.cell as joint.dia.Element).position(action.fromPos!.x, action.fromPos!.y); break;
    }
    this.deseleccionarNodo();
    this.isUndoing = false;
  }

  redo() {
    if (this.redoHistory.length === 0) return;
    this.isUndoing = true;
    const action = this.redoHistory.pop()!;
    this.actionHistory.push(action);
    switch (action.type) {
      case 'add': action.cell.addTo(this.graph); break;
      case 'remove': action.cell.remove(); break;
      case 'move': (action.cell as joint.dia.Element).position(action.toPos!.x, action.toPos!.y); break;
    }
    this.deseleccionarNodo();
    this.isUndoing = false;
  }

  zoomIn() { this.currentScale = Math.min(3, this.currentScale + 0.2); this.paper.scale(this.currentScale, this.currentScale); }
  zoomOut() { this.currentScale = Math.max(0.2, this.currentScale - 0.2); this.paper.scale(this.currentScale, this.currentScale); }

  seleccionarNodo(element: joint.dia.Element) {
    this.selectedNode = element;
    const reglasDecision = element.prop('reglas_decision') || element.prop('regla_decision') || element.prop('regla') || {};
    const posicion = element.position();
    const tamano = element.size();
    this.nodeProps = {
      nombre: element.attr('text/text') as string || '',
      tipo: element.prop('customType') || 'TASK',
      unidad: element.prop('unidad') || 'CLIENTE',
      campos: element.prop('campos') || '',
      posX: Math.round(posicion.x || 0),
      posY: Math.round(posicion.y || 0),
      ancho: Math.round(tamano.width || 300),
      alto: Math.round(tamano.height || 800),
      reglaDecision: this.normalizarReglaDecision(reglasDecision)
    };

    // Resaltar elemento visualmente
    this.graph.getElements().forEach(el => {
      const isSelected = el.id === element.id;
      const type = el.prop('customType');

      if (type === 'TASK') {
        el.attr('body/stroke', isSelected ? '#1565C0' : '#FBC02D');
        el.attr('body/strokeWidth', isSelected ? 2.5 : 1.5);
      } else if (type === 'GATEWAY') {
        el.attr('body/stroke', isSelected ? '#1565C0' : '#FBC02D');
        el.attr('body/strokeWidth', isSelected ? 2.5 : 1.5);
      }
    });
  }

  deseleccionarNodo() {
    this.selectedNode = null;
    // Quitar resalto
    this.graph.getElements().forEach(el => {
      const type = el.prop('customType');
      if (type === 'TASK' || type === 'GATEWAY') {
        el.attr('body/stroke', '#FBC02D');
        el.attr('body/strokeWidth', 1.5);
      }
    });
  }

  updateNodeVisuals() {
    if (!this.selectedNode) return;
    this.selectedNode.attr('text/text', this.nodeProps.nombre);
    this.selectedNode.prop('unidad', this.nodeProps.unidad);
    this.selectedNode.prop('campos', this.nodeProps.campos);
    if (this.nodeProps.tipo === 'SWIMLANE') {
      const width = Math.max(120, Number(this.nodeProps.ancho) || 300);
      const height = Math.max(120, Number(this.nodeProps.alto) || 800);
      this.selectedNode.position(Number(this.nodeProps.posX) || 0, Number(this.nodeProps.posY) || 0);
      this.selectedNode.resize(width, height);
      this.nodeProps.ancho = width;
      this.nodeProps.alto = height;
    }
    this.selectedNode.prop('reglas_decision', this.obtenerReglaDecisionSerializada());
    this.selectedNode.prop('regla', this.obtenerResumenRegla());
    this.scheduleAutoSave(); // ← Guardar tras cualquier cambio en el panel de propiedades
  }

  eliminarNodo() {
    if (this.selectedNode) {
      // Guardar en historial ANTES de eliminar para poder restaurar
      this.pushAction({ type: 'remove', cell: this.selectedNode });
      this.selectedNode.remove();
      this.deseleccionarNodo();
    }
  }

  obtenerNodosDisponibles(excluirSeleccionado = false): Array<{ id: string; nombre: string }> {
    if (!this.graph) {
      return [];
    }

    return this.graph.getElements()
      .filter(el => el.prop('customType') !== 'SWIMLANE')
      .filter(el => !excluirSeleccionado || el.id !== this.selectedNode?.id)
      .map(el => ({
        id: String(el.id),
        nombre: (el.attr('text/text') as string) || String(el.id)
      }));
  }

  obtenerResumenRegla(): string {
    if (this.nodeProps.tipo !== 'GATEWAY') {
      return 'El nodo seleccionado no usa reglas de decisión.';
    }

    const regla = this.nodeProps.reglaDecision as any;
    switch (regla.tipo_operador) {
      case 'compuesta':
        return `Regla compuesta ${regla.operador_logico} con ${regla.condiciones?.length || 0} condición(es).`;
      case 'entre':
        return `Evalúa el campo ${regla.campo || '(sin campo)'} entre ${regla.minimo ?? '...'} y ${regla.maximo ?? '...'}.`;
      case 'multirrama':
        return `Regla multirrama sobre ${regla.campo || '(sin campo)'} con ${regla.ramas?.length || 0} rama(s).`;
      default:
        return `Regla simple: ${regla.campo || '(sin campo)'} ${regla.condicion || '>= '} ${regla.valor_comparacion || '(sin valor)'}.`;
    }
  }

  obtenerReglaDecisionSerializada(): any {
    const regla = this.nodeProps.reglaDecision as any;

    if (regla.tipo_operador === 'compuesta') {
      return {
        tipo_operador: 'compuesta',
        operador_logico: regla.operador_logico || 'AND',
        condiciones: (regla.condiciones || []).filter((condicion: any) => condicion.campo || condicion.valor).map((condicion: any) => ({
          campo: condicion.campo || '',
          condicion: condicion.condicion || '>=',
          valor: condicion.valor ?? ''
        })),
        rama_verdadera: regla.rama_verdadera || '',
        rama_falsa: regla.rama_falsa || ''
      };
    }

    if (regla.tipo_operador === 'entre') {
      return {
        tipo_operador: 'entre',
        campo: regla.campo || '',
        minimo: regla.minimo ?? null,
        maximo: regla.maximo ?? null,
        rama_dentro: regla.rama_dentro || '',
        rama_fuera: regla.rama_fuera || ''
      };
    }

    if (regla.tipo_operador === 'multirrama') {
      return {
        tipo_operador: 'multirrama',
        campo: regla.campo || '',
        ramas: (regla.ramas || []).filter((rama: any) => rama.valor || rama.nodo).map((rama: any) => ({
          valor: rama.valor || '',
          nodo: rama.nodo || ''
        })),
        rama_default: regla.rama_default || ''
      };
    }

    return {
      tipo_operador: 'simple',
      campo: regla.campo || '',
      condicion: regla.condicion || '>=',
      valor_comparacion: regla.valor_comparacion ?? '',
      rama_verdadera: regla.rama_verdadera || '',
      rama_falsa: regla.rama_falsa || ''
    };
  }

  normalizarReglaDecision(regla: any): any {
    const base = {
      tipo_operador: 'simple',
      campo: '',
      condicion: '>=',
      valor_comparacion: '',
      rama_verdadera: '',
      rama_falsa: '',
      operador_logico: 'AND',
      condiciones: [{ campo: '', condicion: '>=', valor: '' }],
      minimo: null,
      maximo: null,
      rama_dentro: '',
      rama_fuera: '',
      ramas: [{ valor: '', nodo: '' }],
      rama_default: ''
    };

    if (!regla || typeof regla !== 'object') {
      return base;
    }

    const tipo_operador = regla.tipo_operador || regla.tipo || 'simple';
    const normalizada = { ...base, ...regla, tipo_operador };

    if (!Array.isArray(normalizada.condiciones) || normalizada.condiciones.length === 0) {
      normalizada.condiciones = [{ campo: '', condicion: '>=', valor: '' }];
    }

    if (!Array.isArray(normalizada.ramas) || normalizada.ramas.length === 0) {
      normalizada.ramas = [{ valor: '', nodo: '' }];
    }

    return normalizada;
  }

  agregarCondicion() {
    this.nodeProps.reglaDecision.condiciones.push({ campo: '', condicion: '>=', valor: '' });
    this.updateNodeVisuals();
  }

  agregarRama() {
    this.nodeProps.reglaDecision.ramas.push({ valor: '', nodo: '' });
    this.updateNodeVisuals();
  }

  eliminarRama(index: number) {
    if (this.nodeProps.reglaDecision.ramas.length <= 1) {
      return;
    }
    this.nodeProps.reglaDecision.ramas.splice(index, 1);
    this.updateNodeVisuals();
  }

  onDragStart(event: DragEvent, nodeType: string) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('nodeType', nodeType);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const nodeType = event.dataTransfer?.getData('nodeType');
    if (!nodeType) return;

    const localPoint = this.screenToLocal(event.clientX, event.clientY);
    const x = localPoint.x;
    const y = localPoint.y;

    this.crearNodo(nodeType, x, y);
  }

  crearNodo(tipo: string, x: number, y: number, nombre?: string, id?: string) {
    let el: joint.dia.Element;

    // Configuración de puertos (puntos de conexión para dibujar flechas)
    const commonPorts = {
      groups: {
        'default': {
          position: 'absolute',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#94a3b8',
              strokeWidth: 1.5,
              fill: '#ffffff'
            }
          }
        }
      },
      items: [
        { id: 'top', group: 'default', args: { x: '50%', y: '0%' } },
        { id: 'bottom', group: 'default', args: { x: '50%', y: '100%' } },
        { id: 'left', group: 'default', args: { x: '0%', y: '50%' } },
        { id: 'right', group: 'default', args: { x: '100%', y: '50%' } }
      ]
    };

    switch (tipo) {
      case 'NODO_INICIO':
        el = new joint.shapes.standard.Circle({
          id: id,
          position: { x: x - 20, y: y - 20 },
          size: { width: 40, height: 40 },
          attrs: {
            body: { fill: '#ffffff', stroke: '#10b981', strokeWidth: 3, magnet: false },
            text: { text: nombre || 'Inicio', fill: '#0f172a', fontSize: 11, fontWeight: 'bold', refY: 55 }
          },
          ports: commonPorts
        });
        break;
      case 'NODO_FIN':
        el = new joint.shapes.standard.Circle({
          id: id,
          position: { x: x - 20, y: y - 20 },
          size: { width: 40, height: 40 },
          attrs: {
            body: { fill: '#ffffff', stroke: '#ef4444', strokeWidth: 4, magnet: false },
            text: { text: nombre || 'Fin', fill: '#0f172a', fontSize: 11, fontWeight: 'bold', refY: 55 }
          },
          ports: commonPorts
        });
        break;
      case 'SWIMLANE':
        // Swimlane estilo EA (Vertical o Horizontal)
        el = new joint.shapes.standard.Rectangle({
          id: id,
          position: { x: x, y: y },
          size: { width: 300, height: 800 }, // Tamaño por defecto para autolayout
          attrs: {
            body: { fill: 'rgba(148, 163, 184, 0.08)', stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '5,5', magnet: false, 'pointer-events': 'all', cursor: 'move' },
            text: { text: nombre || 'Calle', fill: '#475569', fontSize: 14, fontWeight: 'bold', fontFamily: 'Arial, sans-serif', refX: 15, refY: 15, textAnchor: 'start' }
          }
        });
        el.toBack(); // Mandar al fondo
        break;
      case 'GATEWAY':
        // Un rombo simple, estilo EA
        el = new joint.shapes.standard.Polygon({
          id: id,
          position: { x: x - 30, y: y - 30 },
          size: { width: 60, height: 60 },
          attrs: {
            body: { fill: '#FFFDE7', stroke: '#FBC02D', strokeWidth: 1.5, refPoints: '0,10 10,0 20,10 10,20', filter: { name: 'dropShadow', args: { dx: 2, dy: 2, blur: 3, color: '#00000030' } }, magnet: false },
            text: { text: nombre || 'Decisión', fill: '#3E2723', fontSize: 11, fontWeight: 'normal', fontFamily: 'Arial, sans-serif', refY: 28 }
          },
          ports: commonPorts
        });
        break;
      case 'TASK':
      default:
        // Estilo EA (Enterprise Architect)
        el = new joint.shapes.standard.Rectangle({
          id: id,
          position: { x: x - 60, y: y - 25 },
          size: { width: 120, height: 50 },
          attrs: {
            body: { fill: '#FFFDE7', stroke: '#FBC02D', strokeWidth: 1.5, rx: 6, ry: 6, filter: { name: 'dropShadow', args: { dx: 2, dy: 2, blur: 3, color: '#00000030' } }, magnet: false },
            text: { text: nombre || 'Nueva Tarea', fill: '#3E2723', fontSize: 11, fontWeight: 'normal', fontFamily: 'Arial, sans-serif' }
          },
          ports: commonPorts
        });
        break;
    }

    el.prop('customType', tipo);
    el.prop('unidad', 'CLIENTE'); // Default
    if (tipo === 'GATEWAY') {
      el.prop('reglas_decision', this.normalizarReglaDecision({}));
      el.prop('regla', 'Regla simple: (sin campo) >= (sin valor)');
    }
    if (tipo === 'TASK') {
      el.prop('esquema_campos', []);
    }
    el.addTo(this.graph);
    this.centerOnElement(el);

    // Seleccionar y registrar en historial solo cuando el usuario arrastra un elemento nuevo
    if (!id) {
      this.seleccionarNodo(el);
      this.pushAction({ type: 'add', cell: el });
      this.scheduleAutoSave(); // ← Guardar tras añadir
    }
  }

  guardarDiagrama(showToast: boolean = true) {
    if (!this.politicaId) {
      if (showToast) this.showToast('Selecciona una política antes de guardar', 'error');
      return;
    }

    const elements = this.graph.getElements();
    const links = this.graph.getLinks();

    const nodos = elements.map(el => {
      const pos = el.position();
      const label = el.attr('text/text') || 'Nodo';
      const tipo = el.prop('customType') || 'TASK';
      const reglasDecision = el.prop('reglas_decision') || el.prop('regla_decision') || null;
      const esquemaCampos = el.prop('esquema_campos') || el.prop('campos_dinamicos') || null;
      return {
        id_visual: el.id,
        tipo: tipo, // Backend @JsonTypeInfo espera 'tipo'
        nombre: label, // Backend espera 'nombre'
        x: pos.x, // Backend espera 'x'
        y: pos.y, // Backend espera 'y'
        width: el.size().width,
        height: el.size().height,
        tipo_nodo: tipo, // Formulario_Nodo
        nombre_nodo: label, // Formulario_Nodo
        posicion_x: pos.x, // Formulario_Nodo
        posicion_y: pos.y, // Formulario_Nodo
        unidad_id: el.prop('unidad') || 'CLIENTE',
        // Propiedades extra para JSON dinámico BSON
        campos_dinamicos: el.prop('campos'),
        esquema_campos: esquemaCampos,
        reglas_decision: tipo === 'GATEWAY' ? reglasDecision : null,
        regla_negocio: el.prop('regla')
      };
    });

    const enlaces = links.map(link => {
      // Usar solo el ID del elemento, no el del puerto, para garantizar
      // que al recargar el diagrama las flechas se restauren correctamente
      const sourceId = link.source().id || null;
      const targetId = link.target().id || null;
      return { from: sourceId, to: targetId };
    }).filter(e => e.from && e.to);

    const payload = {
      version: "2.0",
      nodos: nodos,
      enlaces: enlaces
    };

    this.isSaving = true;
    this.http.put(`${this.apiUrl}/politicas/${this.politicaId}/esquema`, payload).subscribe({
      next: () => {
        this.isSaving = false;
        if (showToast) this.showToast('✅ Diagrama guardado exitosamente');
      },
      error: (err) => {
        this.isSaving = false;
        console.error(err);
        if (showToast) this.showToast('Error al guardar: ' + (err?.error?.message || err?.status || 'Verifica la conexión al servidor'), 'error');
      }
    });
  }

  cargarDiagrama() {
    if (!this.politicaId) return;
    this.cargarDiagramaDesdeBackend();
  }

  cargarDiagramaDesdeBackend() {
    if (!this.politicaId) return;
    this.http.get<any[]>(`${this.apiUrl}/politicas`).subscribe({
      next: (politicas) => {
        // Actualizar la caché con los datos frescos
        this.politicasDisponibles = politicas;
        const pol = politicas.find(p => p.id === this.politicaId);
        const esquema = this.normalizarEsquemaWorkflow(pol?.esquema_workflow);
        if (pol && esquema && esquema.nodos) {
          this.reconstruirGrafo(esquema);
        } else {
          // Diagrama vacío: resetear historial con pizarra limpia
          this.isUndoing = true;
          this.graph.clear();
          this.actionHistory = [];
          this.redoHistory = [];
          this.isUndoing = false;
        }
      },
      error: (err) => console.error('Error cargando diagrama', err)
    });
  }

  reconstruirGrafo(esquema: any) {
    this.isUndoing = true; // Desactivar auto-historial durante la carga
    this.graph.clear();
    if (!esquema || !esquema.nodos) {
      this.isUndoing = false;
      this.actionHistory = [];
      this.redoHistory = [];
      return;
    }

    // Detectar si los nodos necesitan Auto-Layout (ej: generados por IA sin coords)
    const needsLayout = esquema.nodos?.some((n: any) => !n.posicion_x && !n.posicion_y && !n.x && !n.y);

    if (needsLayout) {
      // ---- AUTO-LAYOUT INTELIGENTE (ESTILO PLANTUML) ----
      const unidades = new Set<string>();
      esquema.nodos.forEach((n: any) => unidades.add(n.unidad_id || n.unidad || 'CLIENTE'));
      const unidadesArr = Array.from(unidades);
      const colWidth = 320;

      // 1. Dibujar Swimlanes (Calles)
      unidadesArr.forEach((u, i) => {
        this.crearNodo('SWIMLANE', i * colWidth + 50, 0, u, `swimlane-${u}`);
      });

      // 2. Colocar nodos dentro de sus calles
      const yOffsets: any = {};
      unidadesArr.forEach(u => yOffsets[u] = 100);

      esquema.nodos.forEach((n: any) => {
        const u = n.unidad_id || n.unidad || 'CLIENTE';
        const colIndex = unidadesArr.indexOf(u);
        const tipo = n.tipo || n.tipo_nodo || 'TASK';
        const nombre = n.nombre || n.nombre_nodo || 'Nodo';
        const idVisual = n.id_visual || n.id;
        const x = (colIndex * colWidth) + (colWidth / 2) + 50;
        const y = yOffsets[u];
        this.crearNodo(tipo, x, y, nombre, idVisual);
        // Override position to exact computed value
        const el = this.graph.getCell(idVisual) as joint.dia.Element;
        if (el) {
          el.position(x, y);
          if (n.unidad_id || n.unidad) el.prop('unidad', n.unidad_id || n.unidad);
          if (n.campos_dinamicos) el.prop('campos', n.campos_dinamicos);
          if (n.regla_negocio) el.prop('regla', n.regla_negocio);
        }
        yOffsets[u] += 150;
      });
      // En auto-layout: ajustar calles para que contengan sus nodos
      this.ajustarSwimlanesANodos();
    } else {
      // Carga normal con coordenadas guardadas
      esquema.nodos.forEach((n: any) => {
        const storedX = n.posicion_x ?? n.x ?? 100;
        const storedY = n.posicion_y ?? n.y ?? 100;
        const tipo = n.tipo || n.tipo_nodo || 'TASK';
        const nombre = n.nombre || n.nombre_nodo || 'Nodo';
        const idVisual = n.id_visual || n.id;

        // Crear el elemento (crearNodo aplica offsets para drag-from-palette)
        this.crearNodo(tipo, storedX, storedY, nombre, idVisual);

        const element = this.graph.getCell(idVisual) as joint.dia.Element;
        if (element) {
          // ✅ CORRECCIÓN CRÍTICA: Restaurar la posición EXACTA guardada.
          // crearNodo aplica offsets (x-20, x-60, etc.) diseñados para arrastrar
          // desde la paleta. Al cargar desde BD, la posición ya está correcta.
          element.position(storedX, storedY);

          // Restaurar tamaño si fue guardado
          const w = n.width || n.ancho;
          const h = n.height || n.alto;
          if (w && h) {
            element.resize(Number(w), Number(h));
          }
          if (n.unidad_id || n.unidad) element.prop('unidad', n.unidad_id || n.unidad);
          if (n.campos_dinamicos) element.prop('campos', n.campos_dinamicos);
          if (n.esquema_campos) element.prop('esquema_campos', n.esquema_campos);
          if (n.reglas_decision) element.prop('reglas_decision', this.normalizarReglaDecision(n.reglas_decision));
          if (n.regla_negocio) element.prop('regla', n.regla_negocio);
        }
      });
    }

    if (esquema.enlaces) {
      esquema.enlaces.forEach((e: any) => {
        if (e.from && e.to) {
          const link = new joint.shapes.standard.Link({
            source: { id: e.from },
            target: { id: e.to },
            attrs: {
              line: {
                stroke: '#333333',
                strokeWidth: 1.5,
                targetMarker: { type: 'path', d: 'M 10 -5 0 0 10 5 Z' }
              }
            },
            router: { name: 'manhattan' },
            connector: { name: 'rounded' }
          });
          link.addTo(this.graph);
        }
      });
    }
    // Ajustar calles (ambos paths: auto-layout y carga normal)
    this.ajustarSwimlanesANodos();

    // Reactivar historial y limpiar acciones acumuladas durante la carga
    this.isUndoing = false;
    this.actionHistory = [];
    this.redoHistory = [];
    this.resetAndCenterViewport();
  }

  /**
   * Ajusta automáticamente posición y tamaño de cada swimlane
   * para que contenga exactamente los nodos que caen en su rango X.
   * Tras el ajuste, guarda silenciosamente para que el layout persista.
   */
  private ajustarSwimlanesANodos() {
    const PAD_Y = 40;
    const GAP = 20; // Espacio entre calles
    const swimlanes = this.graph.getElements()
      .filter(el => el.prop('customType') === 'SWIMLANE')
      .sort((a, b) => a.position().x - b.position().x);

    if (swimlanes.length === 0) return;

    const allNodes = this.graph.getElements()
      .filter(el => el.prop('customType') !== 'SWIMLANE');

    // Ancho de cada calle = distancia al siguiente - GAP
    const laneWidths = swimlanes.map((lane, i) => {
      const nextLane = swimlanes[i + 1];
      if (nextLane) return (nextLane.position().x - lane.position().x) - GAP;
      return Math.max(lane.size().width || 300, 300);
    });

    // Altura uniforme: envuelve TODOS los nodos de TODAS las calles
    let globalMinY = Infinity, globalMaxY = -Infinity;
    swimlanes.forEach((lane, i) => {
      const laneX = lane.position().x;
      const laneW = laneWidths[i];
      const laneNodes = allNodes.filter(el => {
        const cx = el.position().x + el.size().width / 2;
        return cx >= laneX && cx < laneX + laneW + GAP;
      });
      laneNodes.forEach(el => {
        globalMinY = Math.min(globalMinY, el.position().y);
        globalMaxY = Math.max(globalMaxY, el.position().y + el.size().height);
      });
    });

    if (!isFinite(globalMinY)) return;
    const uniformTop = globalMinY - PAD_Y;
    const uniformHeight = Math.max(globalMaxY - uniformTop + PAD_Y, 200);

    swimlanes.forEach((lane, i) => {
      lane.position(lane.position().x, uniformTop);
      lane.resize(laneWidths[i], uniformHeight);
      lane.toBack();
    });
  }

  exportarPNG() {
    if (!this.politicaId) return;
    this.showToast('Generando imagen PNG...');
    this.http.get(`${this.apiUrl}/politicas/${this.politicaId}/exportar-png`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diagrama_${this.politicaId}.png`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.showToast('PNG descargado correctamente');
      },
      error: (err) => this.showToast('No se pudo exportar el PNG. Guarda el diagrama primero.', 'error')
    });
  }
}
