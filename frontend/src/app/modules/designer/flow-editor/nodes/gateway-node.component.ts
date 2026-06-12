import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FFlowModule } from '@foblex/flow';
import { Paso } from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-gateway-node',
  standalone: true,
  imports: [FFlowModule],
  template: `
    <div class="uml-gateway" [attr.data-paso-id]="paso.id" [attr.data-paso-tipo]="paso.tipoPaso">
      <button type="button" class="uml-delete-btn gw-delete" (mousedown)="onEliminar($event)" title="Eliminar">
        <span class="material-symbols-outlined">close</span>
      </button>
      <div class="diamond-wrapper" fDragHandle>
        <div class="diamond">
          <span class="diamond-text">{{ paso.nombre }}</span>
        </div>
      </div>
      <button type="button" class="gw-edit-btn" (mousedown)="onEditar($event)" title="Editar">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <div fNodeInput  [fInputId]="paso.id + '-in'"        [fInputMultiple]="true"  class="port gw-in"      title="Entrada"></div>
      <div fNodeOutput [fOutputId]="paso.id + '-out-sig'"  [fOutputMultiple]="true" class="port gw-out-yes" title="Sí / Siguiente"></div>
      <div fNodeOutput [fOutputId]="paso.id + '-out-cond'" [fOutputMultiple]="true" class="port gw-out-no"  title="No / Condicional"></div>
    </div>
  `,
  styles: [`
    :host { display: block; position: relative; }
    .uml-gateway { position: relative; width: 130px; height: 130px; }
    .diamond-wrapper {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center; cursor: grab;
    }
    .diamond-wrapper:active { cursor: grabbing; }
    .diamond {
      width: 96px; height: 96px;
      background: rgba(249,115,22,0.12); border: 2.5px solid #f97316;
      transform: rotate(45deg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 20px rgba(249,115,22,0.3), inset 0 0 15px rgba(249,115,22,0.05);
      transition: all 0.3s;
    }
    .uml-gateway:hover .diamond {
      background: rgba(249,115,22,0.2); box-shadow: 0 0 30px rgba(249,115,22,0.5); border-color: #fb923c;
    }
    .diamond-text {
      transform: rotate(-45deg); font-size: 10px; font-weight: 700; color: #fb923c;
      text-align: center; max-width: 64px; line-height: 1.2; word-break: break-word;
    }
    .gw-edit-btn {
      position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%);
      background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3);
      border-radius: 6px; color: #fb923c; width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; opacity: 0; transition: all 0.2s; z-index: 10;
    }
    .uml-gateway:hover .gw-edit-btn { opacity: 1; }
    .gw-edit-btn .material-symbols-outlined { font-size: 14px; }
    .uml-delete-btn {
      position: absolute; width: 24px; height: 24px;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 2px solid #0f172a; border-radius: 50%; color: white;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; z-index: 500; opacity: 0; transform: scale(0.5);
      transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .gw-delete { top: -10px; right: -10px; }
    .uml-gateway:hover .uml-delete-btn { opacity: 1; transform: scale(1); }
    .uml-delete-btn:hover { transform: scale(1.2) rotate(90deg) !important; }
    .uml-delete-btn .material-symbols-outlined { font-size: 13px; font-weight: bold; }
    .port.gw-in {
      position: absolute; left: -7px; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: linear-gradient(135deg, #10b981, #059669);
      border: 2px solid rgba(255,255,255,0.3); cursor: crosshair; z-index: 100; transition: all 0.3s;
    }
    .port.gw-out-yes {
      position: absolute; right: -7px; top: 50%; transform: translateY(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: linear-gradient(135deg, #f97316, #ea580c);
      border: 2px solid rgba(255,255,255,0.3); cursor: crosshair; z-index: 100; transition: all 0.3s;
    }
    .port.gw-out-no {
      position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
      width: 14px; height: 14px; border-radius: 50%;
      background: linear-gradient(135deg, #a855f7, #9333ea);
      border: 2px solid rgba(255,255,255,0.3); cursor: crosshair; z-index: 100; transition: all 0.3s;
    }
    .port.gw-in:hover, .port.gw-out-yes:hover { transform: translateY(-50%) scale(1.8); }
    .port.gw-out-no:hover { transform: translateX(-50%) scale(1.8); }
  `]
})
export class GatewayNodeComponent {
  @Input() paso!: Paso;
  @Output() editar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();

  onEditar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.editar.emit(); }
  onEliminar(e: MouseEvent): void { e.preventDefault(); e.stopPropagation(); this.eliminar.emit(); }
}
