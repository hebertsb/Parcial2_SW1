import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Formulario, Paso } from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-paso-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
      (click)="cerrar.emit()"
    >
      <div
        class="w-full max-w-sm bg-[#0f172a]/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] p-6 text-slate-100"
        (click)="$event.stopPropagation()"
      >
        <!-- Header -->
        <div class="flex items-center gap-2 mb-6">
          <span class="material-symbols-outlined text-blue-400">edit_note</span>
          <h3 class="text-base font-bold">Editar nodo</h3>
        </div>

        <div class="space-y-5">
          <!-- Título del nodo -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Título</label>
            <input
              [(ngModel)]="model.nombre"
              placeholder="Nombre del nodo"
              class="w-full mt-1.5 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:bg-slate-800 transition-all"
            />
          </div>

          <!-- Flujo padre -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Flujo padre <span class="normal-case text-slate-600">(vacío = raíz)</span></label>
            <select
              [(ngModel)]="model.padreId"
              class="w-full mt-1.5 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all"
            >
              <option [ngValue]="null">— Sin padre (raíz) —</option>
              @for (p of pasosDisponibles; track p.id) {
                @if (p.id !== model.id) {
                  <option [ngValue]="p.id">{{ p.nombre }}</option>
                }
              }
            </select>
          </div>

          <!-- Formulario del nodo -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Formulario del nodo</label>
            <div class="flex gap-2 mt-1.5">
              @if (model.formularioId) {
                <button
                  type="button"
                  (click)="abrirFormulario.emit(model.formularioId)"
                  class="w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg px-3 py-2.5 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                  title="Abrir el diseñador de formulario de este nodo"
                >
                  <span class="material-symbols-outlined text-[18px]">dashboard_customize</span>
                  Diseñar formulario
                </button>
              } @else {
                <button
                  type="button"
                  (click)="crearFormulario.emit(model.nombre)"
                  class="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg px-3 py-2.5 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
                  title="Crear y abrir el diseñador de formulario para este nodo"
                >
                  <span class="material-symbols-outlined text-[18px]">add_box</span>
                  Diseñar formulario
                </button>
              }
            </div>
          </div>

          <!-- Checkboxes -->
          <div class="flex gap-6 pt-1">
            <label class="flex items-center gap-2.5 text-xs cursor-pointer select-none group">
              <input
                type="checkbox"
                [(ngModel)]="model.obligatorio"
                class="accent-blue-500 w-4 h-4 cursor-pointer rounded"
              />
              <span class="text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest text-[10px] font-semibold">
                Obligatorio
              </span>
            </label>

            <label class="flex items-center gap-2.5 text-xs cursor-pointer select-none group">
              <input
                type="checkbox"
                [(ngModel)]="model.esUltimo"
                class="accent-emerald-500 w-4 h-4 cursor-pointer rounded"
              />
              <span class="text-slate-300 group-hover:text-white transition-colors uppercase tracking-widest text-[10px] font-semibold">
                Fin de flujo
              </span>
            </label>
          </div>
        </div>

        <!-- Botones -->
        <div class="flex gap-3 mt-8">
          <button
            (click)="cerrar.emit()"
            class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            (click)="onGuardar()"
            class="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold shadow-[0_4px_15px_rgba(59,130,246,0.4)] transition-all hover:-translate-y-0.5"
          >
            Actualizar
          </button>
        </div>
      </div>
    </div>
  `,
})
export class PasoEditDialogComponent {
  @Input() set paso(value: Paso) {
    this.model = { ...value };
    if (this._initialPadreId !== undefined) {
      this.model.padreId = this._initialPadreId;
    }
  }

  private _initialPadreId: string | null | undefined = undefined;
  @Input() set padreIdInicial(value: string | null) {
    this._initialPadreId = value;
    if (this.model) this.model.padreId = value;
  }

  @Input() formulariosDisponibles: Formulario[] = [];
  @Input() pasosDisponibles: Paso[] = [];
  @Input() departamentos: { id: string; nombre: string }[] = [];

  @Output() guardar = new EventEmitter<{ paso: Paso; padreId: string | null }>();
  @Output() cerrar = new EventEmitter<void>();
  @Output() crearFormulario = new EventEmitter<string>();
  @Output() abrirFormulario = new EventEmitter<string>();

  model: Paso & { padreId?: string | null } = {} as any;

  onGuardar() {
    const { padreId, ...paso } = this.model;
    this.guardar.emit({ paso: paso as Paso, padreId: padreId ?? null });
  }
}
