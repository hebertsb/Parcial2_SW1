import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { Paso } from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-fin-node',
  standalone: true,
  imports: [FFlowModule],
  template: `
    <div class="uml-end" fDragHandle [attr.data-paso-id]="paso.id" [attr.data-paso-tipo]="paso.tipoPaso">
      <div class="bullseye"><div class="bullseye-dot"></div></div>
      <span class="uml-label">{{ paso.nombre }}</span>
      <button type="button" class="uml-delete-btn" (mousedown)="onEliminar($event)" title="Eliminar">
        <span class="material-symbols-outlined">close</span>
      </button>
      <div fNodeInput [fInputId]="paso.id + '-in'" [fInputMultiple]="true"
           class="port uml-in-left" title="Entrada"></div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .uml-end {
      display: flex; flex-direction: column; align-items: center;
      gap: 10px; padding: 8px 12px; position: relative; cursor: grab;
    }
    .uml-end:active { cursor: grabbing; }
    .bullseye {
      width: 52px; height: 52px; border-radius: 50%;
      border: 4px solid #94a3b8;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 18px rgba(148,163,184,0.5); transition: all 0.3s;
    }
    .bullseye-dot {
      width: 26px; height: 26px; background: #94a3b8;
      border-radius: 50%; transition: all 0.3s;
    }
    .uml-end:hover .bullseye { border-color: #cbd5e1; box-shadow: 0 0 28px rgba(148,163,184,0.8); }
    .uml-end:hover .bullseye-dot { background: #cbd5e1; }
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
    .uml-end:hover .uml-delete-btn { opacity: 1; transform: scale(1); }
    .uml-delete-btn:hover { transform: scale(1.2) rotate(90deg) !important; }
    .uml-delete-btn .material-symbols-outlined { font-size: 13px; font-weight: bold; }
    .port.uml-in-left {
      position: absolute; left: -7px; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      border: 2px solid rgba(255,255,255,0.3); cursor: crosshair; z-index: 100; transition: all 0.3s;
    }
    .port.uml-in-left:hover { transform: translateY(-50%) scale(1.8); }
  `]
})
export class FinNodeComponent {
  @Input() paso!: Paso;
  @Output() editar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  onEliminar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.eliminar.emit(); }
}
