/**
 * Modal "Editar condición de la conexión" (CU-10).
 *
 * Diseñado para usuarios de negocio — no para programadores.
 * Ejemplo: Campo "Tipo de crédito" → Valor "Vivienda" → rama vivienda.
 * El operador se oculta en "Opciones avanzadas" (95% de casos es "igual").
 */

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampoFormulario,
  FuenteCondicion,
  OperadorCondicion,
  ReglaCondicion,
  VariableSistemaCondicion,
} from '../../../../core/models/flujo.models';

@Component({
  selector: 'app-condicion-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
      (click)="cerrar.emit()"
    >
      <div
        class="w-full max-w-md bg-[#0f172a]/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.6)] p-6 text-slate-100"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-center gap-2 mb-1">
          <span class="material-symbols-outlined text-purple-400">rule</span>
          <h3 class="text-lg font-bold">Condición de la rama</h3>
        </div>
        <p class="text-xs text-slate-400 mb-5">
          Define cuándo el trámite debe seguir por esta rama.
        </p>

        <div class="space-y-4">

          <!-- FUENTE DE LA CONDICIÓN -->
          <div>
            <label class="text-[11px] uppercase tracking-wider text-slate-400">
              ¿Qué se evalúa?
            </label>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                (click)="cambiarFuente('campo_formulario')"
                class="border rounded-md px-2 py-2 text-xs font-semibold transition-all"
                [ngClass]="model.fuente !== 'variable_sistema'
                  ? 'border-purple-400 bg-purple-900/40 text-purple-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'"
              >
                Campo del formulario
              </button>
              <button
                type="button"
                (click)="cambiarFuente('variable_sistema')"
                class="border rounded-md px-2 py-2 text-xs font-semibold transition-all"
                [ngClass]="model.fuente === 'variable_sistema'
                  ? 'border-purple-400 bg-purple-900/40 text-purple-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'"
              >
                Variable del sistema
              </button>
            </div>
          </div>

          <!-- CAMPO DEL FORMULARIO -->
          <div *ngIf="model.fuente !== 'variable_sistema' && camposPadre.length > 0">
            <label class="text-[11px] uppercase tracking-wider text-slate-400">
              ¿Qué campo del formulario se evalúa?
            </label>
            <select
              [(ngModel)]="model.campoId"
              (ngModelChange)="onCampoChange()"
              class="w-full mt-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
            >
              <option [ngValue]="''">— Ninguno (etiqueta libre) —</option>
              <option *ngFor="let c of camposPadre; trackBy: trackByCampo" [ngValue]="c.id">{{ c.titulo }}</option>
            </select>
          </div>

          <!-- VARIABLE DE SISTEMA -->
          <div *ngIf="model.fuente === 'variable_sistema'">
            <label class="text-[11px] uppercase tracking-wider text-slate-400">
              Variable del sistema
            </label>
            <select
              [(ngModel)]="model.variableSistema"
              (ngModelChange)="onVariableSistemaChange()"
              class="w-full mt-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm"
            >
              <option [ngValue]="'estado_anterior'">Estado anterior del trámite</option>
              <option [ngValue]="'rol_solicitante'">Rol del solicitante</option>
              <option [ngValue]="'departamento_solicitante'">Departamento del solicitante</option>
              <option [ngValue]="'dias_transcurridos'">Días transcurridos</option>
              <option [ngValue]="'fecha_actual'">Fecha actual</option>
            </select>
          </div>

          <!-- VALOR ESPERADO -->
          <div>
            <label class="text-[11px] uppercase tracking-wider text-slate-400">
              ¿Qué valor activa esta rama?
            </label>

            <!-- Si el campo es tipo Lista → botones de selección -->
            <div *ngIf="opcionesValor.length > 0; else campoTexto"
                 class="grid grid-cols-2 gap-2 mt-2">
              <div *ngFor="let op of opcionesValor; trackBy: trackByOpcion"
                   (click)="model.valorEsperado = op"
                   class="border rounded-lg px-3 py-2.5 text-sm font-medium transition-all text-left flex items-center gap-2 cursor-pointer"
                   [ngClass]="model.valorEsperado === op
                     ? 'border-purple-400 bg-purple-900/40 text-purple-300'
                     : 'border-slate-700 text-slate-300 hover:border-slate-500'"
              >
                <span class="material-symbols-outlined text-[16px]"
                      [ngClass]="model.valorEsperado === op ? 'text-purple-400' : 'text-slate-600'"
                >{{ model.valorEsperado === op ? 'check_circle' : 'radio_button_unchecked' }}</span>
                {{ op }}
              </div>
            </div>

            <ng-template #campoTexto>
              <input
                [(ngModel)]="model.valorEsperado"
                [type]="tipoInputValor"
                class="w-full mt-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="Ej: Vivienda, Aprobado, Urgente, ..."
              />
            </ng-template>

            <!-- Preview contextual -->
            <div *ngIf="model.valorEsperado && campoSeleccionado"
                 class="mt-2 bg-purple-900/30 border border-purple-500/20 rounded-lg p-3">
              <p class="text-[11px] text-purple-300 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">info</span>
                Si "{{ campoSeleccionado.titulo }}" {{ operadorTexto }}
                <strong>"{{ model.valorEsperado }}"</strong>
                &rarr; el trámite sigue por esta rama
              </p>
            </div>
            <div *ngIf="model.valorEsperado && !campoSeleccionado"
                 class="mt-2 bg-purple-900/30 border border-purple-500/20 rounded-lg p-3">
              <p class="text-[11px] text-purple-300 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[14px]">info</span>
                Esta rama se activa cuando el resultado es
                <strong>"{{ model.valorEsperado }}"</strong>
              </p>
            </div>
          </div>

          <!-- OPCIONES AVANZADAS (operador) — colapsable -->
          <div>
            <span
              (click)="mostrarAvanzado = !mostrarAvanzado"
              class="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors cursor-pointer select-none"
            >
              <span class="material-symbols-outlined text-[14px]">{{ mostrarAvanzado ? 'expand_less' : 'expand_more' }}</span>
              Opciones avanzadas
            </span>
            <div *ngIf="mostrarAvanzado" class="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <label class="text-[10px] uppercase tracking-wider text-slate-500">
                Tipo de comparación
              </label>
              <div class="grid grid-cols-3 gap-1.5 mt-1.5">
                <div *ngFor="let op of operadoresDisponibles; trackBy: trackByOperador"
                     (click)="model.operador = op.valor"
                     class="border rounded-md px-2 py-1.5 text-xs font-medium transition-all text-center cursor-pointer"
                     [ngClass]="model.operador === op.valor
                       ? 'border-purple-400 bg-purple-900/40 text-purple-300'
                       : 'border-slate-700 text-slate-400 hover:border-slate-500'"
                >
                  {{ op.etiqueta }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex gap-3 mt-6">
          <button
            type="button"
            (click)="cerrar.emit()"
            class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm font-semibold transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            (click)="onGuardar()"
            [disabled]="!model.valorEsperado"
            class="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white rounded-xl py-2.5 text-sm font-semibold shadow-[0_4px_15px_rgba(168,85,247,0.4)] transition-all transform hover:-translate-y-0.5 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Guardar condición
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CondicionEditDialogComponent {
  @Input() set condicion(value: ReglaCondicion | null | undefined) {
    this.model = {
      fuente: value?.fuente ?? (value?.variableSistema ? 'variable_sistema' : 'campo_formulario'),
      campoId: value?.campoId ?? '',
      variableSistema: value?.variableSistema ?? 'estado_anterior',
      valorEsperado: value?.valorEsperado ?? '',
      operador: value?.operador ?? '=',
    };
    this.asegurarOperadorCompatible();
  }
  @Input() camposPadre: CampoFormulario[] = [];

  @Output() guardar = new EventEmitter<ReglaCondicion | null>();
  @Output() cerrar = new EventEmitter<void>();

  model: ReglaCondicion = {
    fuente: 'campo_formulario',
    campoId: '',
    variableSistema: 'estado_anterior',
    valorEsperado: '',
    operador: '=',
  };
  mostrarAvanzado = false;

  operadores: Array<{ valor: OperadorCondicion; etiqueta: string }> = [
    { valor: '=', etiqueta: 'Es igual' },
    { valor: '!=', etiqueta: 'Es distinto' },
    { valor: '>', etiqueta: 'Mayor que' },
    { valor: '<', etiqueta: 'Menor que' },
    { valor: '>=', etiqueta: 'Mayor o igual' },
    { valor: '<=', etiqueta: 'Menor o igual' },
  ];

  get campoSeleccionado(): CampoFormulario | undefined {
    return this.camposPadre.find((c) => c.id === this.model.campoId);
  }

  get tipoDatoActivo(): 'texto' | 'numero' | 'fecha' | 'booleano' {
    if (this.model.fuente === 'variable_sistema') {
      switch (this.model.variableSistema) {
        case 'dias_transcurridos': return 'numero';
        case 'fecha_actual': return 'fecha';
        default: return 'texto';
      }
    }

    switch (this.campoSeleccionado?.tipo) {
      case 'numero': return 'numero';
      case 'fecha': return 'fecha';
      case 'si_no': return 'booleano';
      default: return 'texto';
    }
  }

  get tipoInputValor(): 'text' | 'number' | 'date' {
    switch (this.tipoDatoActivo) {
      case 'numero': return 'number';
      case 'fecha': return 'date';
      default: return 'text';
    }
  }

  get opcionesValor(): string[] {
    if (this.model.fuente === 'variable_sistema') {
      if (this.model.variableSistema === 'estado_anterior') {
        return ['APROBADO', 'OBSERVADO', 'RECHAZADO'];
      }
      return [];
    }

    if (this.campoSeleccionado?.tipo === 'lista' && this.campoSeleccionado.opciones?.length) {
      return this.campoSeleccionado.opciones.map(o => o.valor);
    }

    if (this.campoSeleccionado?.tipo === 'si_no') {
      return ['SI', 'NO'];
    }

    return [];
  }

  get operadoresDisponibles(): Array<{ valor: OperadorCondicion; etiqueta: string }> {
    const base = this.tipoDatoActivo;
    if (base === 'numero' || base === 'fecha') {
      return this.operadores;
    }
    return this.operadores.filter((op) => op.valor === '=' || op.valor === '!=');
  }

  get operadorTexto(): string {
    switch (this.model.operador) {
      case '=': return 'es';
      case '!=': return 'no es';
      case '>': return 'es mayor que';
      case '<': return 'es menor que';
      case '>=': return 'es mayor o igual a';
      case '<=': return 'es menor o igual a';
      default: return 'es';
    }
  }

  cambiarFuente(fuente: FuenteCondicion): void {
    this.model.fuente = fuente;
    if (fuente === 'campo_formulario') {
      this.model.variableSistema = 'estado_anterior';
    } else {
      this.model.campoId = '';
      if (!this.model.variableSistema) {
        this.model.variableSistema = 'estado_anterior';
      }
    }
    this.model.valorEsperado = '';
    this.asegurarOperadorCompatible();
  }

  onVariableSistemaChange(): void {
    this.model.valorEsperado = '';
    this.asegurarOperadorCompatible();
  }

  onCampoChange(): void {
    this.model.valorEsperado = '';
    this.asegurarOperadorCompatible();
  }

  private asegurarOperadorCompatible(): void {
    const permitido = this.operadoresDisponibles.map((o) => o.valor);
    if (!this.model.operador || !permitido.includes(this.model.operador)) {
      this.model.operador = permitido[0] ?? '=';
    }
  }

  trackByCampo(_: number, c: CampoFormulario) { return c.id; }
  trackByOpcion(i: number, op: string) { return op; }
  trackByOperador(i: number, op: { valor: OperadorCondicion; etiqueta: string }) { return op.valor; }

  onGuardar() {
    if (!this.model.valorEsperado?.trim()) {
      this.guardar.emit(null);
      return;
    }
    this.asegurarOperadorCompatible();
    this.guardar.emit({ ...this.model });
  }
}
