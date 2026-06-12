import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { Paso } from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-inicio-node',
  standalone: true,
  imports: [FFlowModule],
  template: `
    <div class="uml-start" fDragHandle [attr.data-paso-id]="paso.id" [attr.data-paso-tipo]="paso.tipoPaso">
      <div class="start-circle"></div>
      <span class="uml-label">{{ paso.nombre }}</span>
      <button type="button" class="uml-delete-btn" (mousedown)="onEliminar($event)" title="Eliminar">
        <span class="material-symbols-outlined">close</span>
      </button>
      <div fNodeOutput [fOutputId]="paso.id + '-out-sig'" [fOutputMultiple]="true"
           class="port uml-out-right" title="Salida"></div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .uml-start {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 8px 12px; position: relative; cursor: grab;
    }
    .uml-start:active { cursor: grabbing; }
    .start-circle {
      width: 52px; height: 52px; background: #1e293b;
      border: 4px solid #94a3b8; border-radius: 50%;
      box-shadow: 0 0 18px rgba(148,163,184,0.5), inset 0 2px 4px rgba(0,0,0,0.4);
      transition: all 0.3s;
    }
    .uml-start:hover .start-circle {
      border-color: #cbd5e1; box-shadow: 0 0 28px rgba(148,163,184,0.8);
    }
    .uml-label {
      font-size: 11px; font-weight: 600; color: #64748b;
      text-align: center; max-width: 110px; word-break: break-word; line-height: 1.3;
    }
    .uml-delete-btn {
      position: absolute; top: -10px; right: -10px;
      width: 24px; height: 24px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 2px solid #0f172a; border-radius: 50%; color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 500; opacity: 0; transform: scale(0.5);
      transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .uml-start:hover .uml-delete-btn { opacity: 1; transform: scale(1); }
    .uml-delete-btn:hover { transform: scale(1.2) rotate(90deg) !important; }
    .uml-delete-btn .material-symbols-outlined { font-size: 13px; font-weight: bold; }
    .port.uml-out-right {
      position: absolute; right: -7px; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border: 2px solid rgba(255,255,255,0.3); cursor: crosshair; z-index: 100; transition: all 0.3s;
    }
    .port.uml-out-right:hover { transform: translateY(-50%) scale(1.8); }
  `]
})
export class InicioNodeComponent {
  @Input() paso!: Paso;
  @Output() editar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  onEliminar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.eliminar.emit(); }
}
