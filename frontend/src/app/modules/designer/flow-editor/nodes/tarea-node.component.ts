import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FFlowModule } from '@foblex/flow';
import { Paso, Formulario, TipoCampo } from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-tarea-node',
  standalone: true,
  imports: [CommonModule, FFlowModule],
  template: `
    <!-- ══ CAMPO INLINE ══ -->
    @if (paso.campotipo) {
      <div class="campo-node" [class.selected]="selected" [attr.data-paso-id]="paso.id" [attr.data-paso-tipo]="paso.tipoPaso || 'TAREA'">
        <button type="button" class="node-delete-btn" (mousedown)="onEliminar($event)" title="Eliminar">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="campo-header" fDragHandle
             [style.borderLeftColor]="getCampoColor(paso.campotipo)"
             [style.borderLeftWidth]="'4px'"
             [style.borderLeftStyle]="'solid'">
          <span class="campo-icon" [style.color]="getCampoColor(paso.campotipo)"
                [style.background]="getCampoColor(paso.campotipo) + '22'">
            <span class="material-symbols-outlined">{{ getCampoIcon(paso.campotipo) }}</span>
          </span>
          <div class="campo-header-text">
            <span class="campo-type-label">{{ getCampoTypeName(paso.campotipo) }}</span>
            <span class="campo-name">{{ paso.nombre }}</span>
          </div>
          <button type="button" class="campo-edit-btn" (click)="onEditar($event)" title="Editar etiqueta">
            <span class="material-symbols-outlined">edit</span>
          </button>
        </div>
        <div class="campo-preview-area">{{ getCampoPreview(paso.campotipo) }}</div>
        <div fNodeInput  [fInputId]="paso.id + '-in'"        [fInputMultiple]="true"  class="port input"       title="Entrada"></div>
        <div fNodeOutput [fOutputId]="paso.id + '-out-sig'"  [fOutputMultiple]="true" class="port output next" title="Siguiente"></div>
        <div fNodeOutput [fOutputId]="paso.id + '-out-cond'" [fOutputMultiple]="true" class="port output cond" title="Condicional"></div>
      </div>
    }

    <!-- ══ TAREA (default) ══ -->
    @else {
      <div class="compact-node" [class.selected]="selected" [attr.data-paso-id]="paso.id" [attr.data-paso-tipo]="paso.tipoPaso || 'TAREA'">
        <button type="button" class="node-delete-btn" (mousedown)="onEliminar($event)" title="Eliminar paso">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="compact-header" fDragHandle>
          <div class="compact-icon-box" [style.background]="getHeaderGradient()">
            <span class="material-symbols-outlined text-[14px] text-white">article</span>
          </div>
          <span class="compact-title" [title]="getDisplayName()">{{ getDisplayName() }}</span>
          @if (paso.obligatorio) {
            <span class="material-symbols-outlined text-red-400 text-[14px] ml-1" title="Obligatorio">error</span>
          }
        </div>
        <div class="compact-body">
          @if (paso.formularioId && getFormFields(paso.formularioId).length > 0) {
            <div class="compact-fields">
              @for (c of getFormFields(paso.formularioId).slice(0, 3); track c.id) {
                <div class="compact-field">
                  <span class="cf-name">{{ c.titulo }}:</span>
                  <span class="cf-type" [style.color]="getCampoColor(c.tipo)">[{{ getCampoTypeName(c.tipo) }}]</span>
                </div>
              }
              @if (getFormFields(paso.formularioId).length > 3) {
                <div class="cf-more">+{{ getFormFields(paso.formularioId).length - 3 }} campos adicionales</div>
              }
            </div>
          } @else {
            <div class="compact-empty">Sin formulario — edita el nodo para diseñarlo</div>
          }
        </div>
        <div class="compact-footer">
          <button class="c-btn-icon" (click)="onCondicion($event)" title="Añadir Condición">
            <span class="material-symbols-outlined text-[13px]">call_split</span>
          </button>
          <button class="c-btn-icon" (click)="onEditar($event)" title="Editar Configuración">
            <span class="material-symbols-outlined text-[13px]">edit</span>
          </button>
        </div>
        <div fNodeInput  [fInputId]="paso.id + '-in'"        [fInputMultiple]="true"  class="port input"       title="Entrada"></div>
        <div fNodeOutput [fOutputId]="paso.id + '-out-sig'"  [fOutputMultiple]="true" class="port output next" title="Siguiente Paso"></div>
        <div fNodeOutput [fOutputId]="paso.id + '-out-cond'" [fOutputMultiple]="true" class="port output cond" title="Paso Condicional"></div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; position: relative; }

    .compact-node {
      width: 220px; background: rgba(15,23,42,0.9); backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; color: #f8fafc;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      position: relative; transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
      display: flex; flex-direction: column;
    }
    .compact-node:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(0,0,0,0.6); border-color: rgba(255,255,255,0.2); }
    .compact-node.selected { border: 2px solid #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.2), 0 15px 35px rgba(0,0,0,0.6); }

    .node-delete-btn {
      position: absolute; top: -10px; right: -10px; width: 24px; height: 24px;
      background: linear-gradient(135deg, #ef4444, #dc2626); border: 2px solid #0f172a;
      border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 500; box-shadow: 0 4px 10px rgba(239,68,68,0.5);
      transition: all 0.2s; opacity: 0; transform: scale(0.5);
    }
    .compact-node:hover .node-delete-btn,
    .campo-node:hover .node-delete-btn { opacity: 1; transform: scale(1); }
    .node-delete-btn:hover { transform: scale(1.15) rotate(90deg) !important; }
    .node-delete-btn .material-symbols-outlined { font-size: 14px; font-weight: bold; }

    .compact-header {
      display: flex; align-items: center; gap: 10px; padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.06); cursor: grab;
    }
    .compact-header:active { cursor: grabbing; }
    .compact-icon-box {
      width: 26px; height: 26px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
    }
    .compact-title {
      font-size: 12px; font-weight: 700; color: #e2e8f0;
      flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .compact-body { padding: 10px 12px; min-height: 40px; }
    .compact-fields { display: flex; flex-direction: column; gap: 4px; }
    .compact-field {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; background: rgba(255,255,255,0.03);
      padding: 4px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);
    }
    .cf-name { color: #cbd5e1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
    .cf-type { font-weight: 800; text-transform: uppercase; font-size: 8px; }
    .cf-more { font-size: 9px; color: #64748b; margin-top: 4px; font-style: italic; }
    .compact-empty { font-size: 10px; color: #64748b; font-style: italic; padding: 4px 0; }
    .compact-footer {
      display: flex; justify-content: flex-end; gap: 6px; padding: 6px 10px;
      background: rgba(0,0,0,0.15); border-top: 1px solid rgba(255,255,255,0.04);
      border-radius: 0 0 12px 12px;
    }
    .c-btn-icon {
      background: transparent; border: 1px solid transparent; color: #64748b;
      width: 24px; height: 24px; border-radius: 6px;
      display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;
    }
    .c-btn-icon:hover { background: rgba(255,255,255,0.1); color: #e2e8f0; border-color: rgba(255,255,255,0.15); }

    .campo-node {
      width: 210px; background: rgba(15,23,42,0.88); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px; position: relative; transition: all 0.3s ease;
      box-shadow: 0 8px 24px rgba(0,0,0,0.45); overflow: hidden;
    }
    .campo-node:hover { transform: translateY(-3px); box-shadow: 0 14px 32px rgba(0,0,0,0.6); border-color: rgba(255,255,255,0.18); }
    .campo-node.selected { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.2); }
    .campo-header {
      display: flex; align-items: center; gap: 10px; padding: 12px 12px 10px;
      cursor: grab; border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .campo-header:active { cursor: grabbing; }
    .campo-icon { width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .campo-icon .material-symbols-outlined { font-size: 18px; }
    .campo-header-text { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .campo-type-label { font-size: 8px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; }
    .campo-name { font-size: 12px; font-weight: 700; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .campo-edit-btn {
      background: transparent; border: none; color: #334155; width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center; cursor: pointer;
      border-radius: 4px; flex-shrink: 0; opacity: 0; transition: all 0.2s;
    }
    .campo-header:hover .campo-edit-btn { opacity: 1; color: #94a3b8; }
    .campo-edit-btn:hover { background: rgba(255,255,255,0.08) !important; }
    .campo-edit-btn .material-symbols-outlined { font-size: 14px; }
    .campo-preview-area {
      padding: 10px 14px 12px; font-size: 11px; color: #475569;
      font-family: 'Courier New', monospace; letter-spacing: 0.02em;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }

    .port {
      width: 14px; height: 14px; border-radius: 50%;
      position: absolute; cursor: crosshair; z-index: 100;
      transition: all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);
      border: 2px solid rgba(255,255,255,0.3);
    }
    .port:hover { transform: scale(2); }
    .port.input { left: -7px; top: 50%; transform: translateY(-50%); background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 0 10px rgba(16,185,129,0.7); }
    .port.input:hover { box-shadow: 0 0 20px rgba(16,185,129,1); border-color: rgba(255,255,255,0.6); }
    .port.output.next { right: -7px; top: 35%; transform: translateY(-50%); background: linear-gradient(135deg, #f97316, #ea580c); box-shadow: 0 0 10px rgba(249,115,22,0.7); }
    .port.output.next:hover { box-shadow: 0 0 20px rgba(249,115,22,1); border-color: rgba(255,255,255,0.6); }
    .port.output.cond { right: -7px; top: 65%; transform: translateY(-50%); background: linear-gradient(135deg, #a855f7, #9333ea); box-shadow: 0 0 10px rgba(168,85,247,0.7); }
    .port.output.cond:hover { box-shadow: 0 0 20px rgba(168,85,247,1); border-color: rgba(255,255,255,0.6); }
  `]
})
export class TareaNodeComponent {
  @Input() paso!: Paso;
  @Input() selected = false;
  @Input() formularios: Formulario[] = [];
  @Output() editar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();
  @Output() condicion = new EventEmitter<void>();

  getFormFields(id: string): any[] {
    const form = this.formularios.find(f => f.id === id);
    return form?.campos && Array.isArray(form.campos) ? form.campos : [];
  }

  getHeaderGradient(): string {
    return this.paso.formularioId
      ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
      : 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)';
  }

  getDisplayName(): string {
    return (this.paso.nombre || '').trim() || 'Nueva Tarea';
  }

  onEditar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.editar.emit(); }
  onEliminar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.eliminar.emit(); }
  onCondicion(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.condicion.emit(); }

  getCampoColor(tipo: TipoCampo): string {
    const m: Record<TipoCampo, string> = {
      texto: '#3b82f6', texto_largo: '#14b8a6', numero: '#10b981',
      lista: '#f97316', si_no: '#a855f7', fecha: '#06b6d4',
      firma: '#ec4899', archivo: '#f59e0b', label: '#64748b', grid: '#8b5cf6',
    };
    return m[tipo] ?? '#64748b';
  }

  getCampoIcon(tipo: TipoCampo): string {
    const m: Record<TipoCampo, string> = {
      texto: 'text_fields', texto_largo: 'notes', numero: 'pin',
      lista: 'format_list_bulleted', si_no: 'toggle_on', fecha: 'calendar_month',
      firma: 'draw', archivo: 'attach_file', label: 'label', grid: 'table_chart',
    };
    return m[tipo] ?? 'input';
  }

  getCampoTypeName(tipo: TipoCampo): string {
    const m: Record<TipoCampo, string> = {
      texto: 'Texto', texto_largo: 'Texto largo', numero: 'Número',
      lista: 'Lista', si_no: 'Sí / No', fecha: 'Fecha',
      firma: 'Firma', archivo: 'Archivo', label: 'Etiqueta', grid: 'Tabla',
    };
    return m[tipo] ?? tipo;
  }

  getCampoPreview(tipo: TipoCampo): string {
    const m: Record<TipoCampo, string> = {
      texto: '[ ___________________ ]', texto_largo: '[ __________________ ]',
      numero: '[ ______ 0 _________ ]', lista: '[ Seleccionar...    ▾ ]',
      si_no: '◉ Sí   ○ No', fecha: '[ DD / MM / AAAA  📅 ]',
      firma: '✍  ________________________', archivo: '📎  Adjuntar archivo...',
      label: '— Etiqueta informativa —', grid: '⊞  Tabla de datos',
    };
    return m[tipo] ?? '';
  }
}
