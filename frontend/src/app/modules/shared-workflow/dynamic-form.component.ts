import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy,
  AfterViewInit, signal, computed, inject, ElementRef, ViewChildren, QueryList
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { CampoFormulario } from '../../core/models/flujo.models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-form-dinamico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-6">

      @for (campo of camposOrdenados(); track campo.id) {
        @if (esVisible(campo)) {
          <div class="space-y-1.5">
            <label class="block text-sm font-semibold text-slate-700">
              {{ campo.titulo }}
              @if (campo.obligatorio) { <span class="text-red-500">*</span> }
            </label>
            @if (campo.descripcion) {
              <p class="text-xs text-slate-500">{{ campo.descripcion }}</p>
            }

            <!-- TEXTO -->
            @if (campo.tipo === 'texto') {
              <input
                [formControlName]="campo.id"
                type="text"
                [placeholder]="campo.placeholder || ''"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            }

            <!-- TEXTO_LARGO -->
            @if (campo.tipo === 'texto_largo') {
              <textarea
                [formControlName]="campo.id"
                [placeholder]="campo.placeholder || ''"
                rows="4"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none">
              </textarea>
            }

            <!-- NUMERO -->
            @if (campo.tipo === 'numero') {
              <div class="flex items-center gap-2">
                @if (campo.prefijoSufijo) {
                  <span class="text-slate-500 text-sm font-medium bg-slate-100 px-3 py-3 rounded-xl border border-slate-200">
                    {{ campo.prefijoSufijo }}
                  </span>
                }
                <input
                  [formControlName]="campo.id"
                  type="number"
                  [min]="campo.min ?? null"
                  [max]="campo.max ?? null"
                  [placeholder]="campo.placeholder || '0'"
                  class="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            }

            <!-- LISTA (select o checkboxes) -->
            @if (campo.tipo === 'lista') {
              @if (!campo.multiple) {
                <select
                  [formControlName]="campo.id"
                  class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccione una opción...</option>
                  @for (op of campo.opciones; track op.valor) {
                    <option [value]="op.valor">{{ op.label }}</option>
                  }
                  @if (campo.permitirOtro) {
                    <option value="__otro__">Otro...</option>
                  }
                </select>
              } @else {
                <div class="space-y-2">
                  @for (op of campo.opciones; track op.valor) {
                    <label class="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox"
                        [checked]="isChecked(campo.id, op.valor)"
                        (change)="toggleCheck(campo.id, op.valor)"
                        class="w-4 h-4 rounded border-slate-300 text-blue-600"/>
                      <span class="text-sm text-slate-700">{{ op.label }}</span>
                    </label>
                  }
                </div>
              }
            }

            <!-- SI_NO (confirmación) -->
            @if (campo.tipo === 'si_no') {
              <div class="flex gap-3">
                <button type="button"
                  (click)="form.get(campo.id)?.setValue(true)"
                  [class.ring-2]="form.get(campo.id)?.value === true"
                  class="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold transition-all"
                  [class.bg-emerald-50]="form.get(campo.id)?.value === true"
                  [class.border-emerald-400]="form.get(campo.id)?.value === true"
                  [class.text-emerald-700]="form.get(campo.id)?.value === true">
                  ✓ Sí
                </button>
                <button type="button"
                  (click)="form.get(campo.id)?.setValue(false)"
                  [class.ring-2]="form.get(campo.id)?.value === false"
                  class="flex-1 py-3 rounded-xl border border-slate-200 text-sm font-semibold transition-all"
                  [class.bg-red-50]="form.get(campo.id)?.value === false"
                  [class.border-red-400]="form.get(campo.id)?.value === false"
                  [class.text-red-700]="form.get(campo.id)?.value === false">
                  ✗ No
                </button>
              </div>
            }

            <!-- FECHA -->
            @if (campo.tipo === 'fecha') {
              <input
                [formControlName]="campo.id"
                [type]="campo.incluyeHora ? 'datetime-local' : 'date'"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            }

            <!-- ARCHIVO -->
            @if (campo.tipo === 'archivo') {
              <div class="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-300 transition-colors">
                <input
                  type="file"
                  [id]="'file-' + campo.id"
                  [accept]="campo.formatos || '*'"
                  [multiple]="(campo.cantidadMaxima || 1) > 1"
                  (change)="onFileChange($event, campo.id)"
                  class="hidden"/>
                <label [for]="'file-' + campo.id" class="cursor-pointer flex flex-col items-center gap-2">
                  <span class="material-symbols-outlined text-4xl text-slate-400">upload_file</span>
                  <span class="text-sm text-slate-600 font-medium">Haz clic para adjuntar archivo</span>
                  @if (campo.formatos) {
                    <span class="text-xs text-slate-400">Formatos: {{ campo.formatos }}</span>
                  }
                </label>
                @if (archivosNombres[campo.id]) {
                  <p class="mt-2 text-xs text-emerald-600 font-medium">✓ {{ archivosNombres[campo.id] }}</p>
                }
              </div>
            }

            <!-- FIRMA (canvas) -->
            @if (campo.tipo === 'firma') {
              <div class="space-y-2">
                @if (campo.rolFirma) {
                  <p class="text-xs text-slate-500">Firma requerida para: <strong>{{ campo.rolFirma }}</strong></p>
                }
                <div class="border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <canvas
                    [id]="'canvas-' + campo.id"
                    width="600" height="160"
                    class="w-full touch-none cursor-crosshair"
                    (mousedown)="startDraw($event, campo.id)"
                    (mousemove)="draw($event, campo.id)"
                    (mouseup)="stopDraw(campo.id)"
                    (mouseleave)="stopDraw(campo.id)"
                    (touchstart)="onTouchStart($event, campo.id)"
                    (touchmove)="onTouchMove($event, campo.id)"
                    (touchend)="stopDraw(campo.id)">
                  </canvas>
                </div>
                <div class="flex items-center justify-between">
                  <button type="button"
                    (click)="limpiarFirma(campo.id)"
                    class="text-xs text-red-500 hover:text-red-700 font-medium">
                    Limpiar firma
                  </button>
                  @if (firmas[campo.id]) {
                    <span class="text-xs text-emerald-600 font-medium">✓ Firma capturada</span>
                  }
                </div>
                @if (campo.registrarFechaHora && firmas[campo.id]) {
                  <p class="text-xs text-slate-400">Firmado: {{ fechaActual() }}</p>
                }
              </div>
            }

            <!-- Error de validación -->
            @if (form.get(campo.id)?.invalid && form.get(campo.id)?.touched) {
              <p class="text-xs text-red-500">Este campo es obligatorio.</p>
            }
          </div>
        }
      }

      <!-- Botones -->
      <div class="flex gap-3 pt-4 border-t border-slate-100">
        @if (mostrarAnterior) {
          <button type="button"
            (click)="anterior.emit()"
            class="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
            ← Anterior
          </button>
        }
        <button type="button"
          (click)="onGuardarBorrador()"
          class="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm">
          Guardar borrador
        </button>
        <button type="submit"
          [disabled]="cargando"
          class="flex-1 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          @if (cargando) {
            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          }
          {{ esUltimoStep ? 'Finalizar trámite' : 'Enviar y continuar →' }}
        </button>
      </div>
    </form>
  `
})
export class FormDinamicoComponent implements OnInit, OnDestroy {
  @Input() campos: CampoFormulario[] = [];
  @Input() respuestasPrevias: Record<string, any> = {};
  @Input() mostrarAnterior = false;
  @Input() esUltimoStep = false;
  @Input() cargando = false;

  @Output() formularioEnviado = new EventEmitter<Record<string, any>>();
  @Output() borrador = new EventEmitter<Record<string, any>>();
  @Output() anterior = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  form!: FormGroup;

  firmas: Record<string, string> = {};
  archivosNombres: Record<string, string> = {};
  checkboxValues: Record<string, string[]> = {};

  private drawingState: Record<string, boolean> = {};
  private canvasContexts: Record<string, CanvasRenderingContext2D> = {};
  private subs: Subscription[] = [];

  camposOrdenados = computed(() =>
    [...this.campos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  );

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  fechaActual(): string {
    return new Date().toLocaleString('es-BO');
  }

  private buildForm(): void {
    const controls: Record<string, any> = {};
    for (const c of this.campos) {
      const prev = this.respuestasPrevias?.[c.id] ?? '';
      const validators = c.obligatorio ? [Validators.required] : [];
      if (c.tipo === 'lista' && c.multiple) {
        this.checkboxValues[c.id] = Array.isArray(prev) ? prev : [];
        controls[c.id] = [this.checkboxValues[c.id], validators];
      } else {
        controls[c.id] = [prev, validators];
      }
    }
    this.form = this.fb.group(controls);

    // Suscribirse a cambios para visibilidad condicional
    for (const c of this.campos) {
      if (c.dependeDeCampoId) {
        const sub = this.form.get(c.dependeDeCampoId)?.valueChanges.subscribe(() => {
          // La visibilidad se recalcula automáticamente en esVisible()
        });
        if (sub) this.subs.push(sub);
      }
    }
  }

  esVisible(campo: CampoFormulario): boolean {
    if (!campo.dependeDeCampoId) return true;
    const valorPadre = this.form?.get(campo.dependeDeCampoId)?.value;
    if (valorPadre === null || valorPadre === undefined || valorPadre === '') return false;
    return String(valorPadre).toLowerCase() === String(campo.dependeDeValor ?? '').toLowerCase();
  }

  isChecked(campoId: string, valor: string): boolean {
    return (this.checkboxValues[campoId] ?? []).includes(valor);
  }

  toggleCheck(campoId: string, valor: string): void {
    const arr = this.checkboxValues[campoId] ?? [];
    const idx = arr.indexOf(valor);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(valor);
    this.checkboxValues[campoId] = [...arr];
    this.form.get(campoId)?.setValue(this.checkboxValues[campoId]);
  }

  onFileChange(event: Event, campoId: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const nombre = Array.from(input.files).map(f => f.name).join(', ');
      this.archivosNombres[campoId] = nombre;
      this.form.get(campoId)?.setValue(nombre);
    }
  }

  // ── Firma canvas ────────────────────────────────────────────────
  private getCtx(campoId: string): CanvasRenderingContext2D | null {
    if (this.canvasContexts[campoId]) return this.canvasContexts[campoId];
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    this.canvasContexts[campoId] = ctx;
    return ctx;
  }

  private coordsFromEvent(e: MouseEvent | Touch, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  startDraw(e: MouseEvent, campoId: string): void {
    const ctx = this.getCtx(campoId);
    if (!ctx) return;
    this.drawingState[campoId] = true;
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    const { x, y } = this.coordsFromEvent(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  draw(e: MouseEvent, campoId: string): void {
    if (!this.drawingState[campoId]) return;
    const ctx = this.getCtx(campoId);
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!ctx || !canvas) return;
    const { x, y } = this.coordsFromEvent(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  stopDraw(campoId: string): void {
    if (!this.drawingState[campoId]) return;
    this.drawingState[campoId] = false;
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (canvas) {
      const data = canvas.toDataURL('image/png');
      this.firmas[campoId] = data;
      this.form.get(campoId)?.setValue(data);
    }
  }

  onTouchStart(e: TouchEvent, campoId: string): void {
    e.preventDefault();
    const ctx = this.getCtx(campoId);
    if (!ctx) return;
    this.drawingState[campoId] = true;
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    const { x, y } = this.coordsFromEvent(e.touches[0], canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  onTouchMove(e: TouchEvent, campoId: string): void {
    e.preventDefault();
    if (!this.drawingState[campoId]) return;
    const ctx = this.getCtx(campoId);
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!ctx || !canvas) return;
    const { x, y } = this.coordsFromEvent(e.touches[0], canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  limpiarFirma(campoId: string): void {
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = this.getCtx(campoId);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    delete this.firmas[campoId];
    this.form.get(campoId)?.setValue('');
  }

  // ── Submit ───────────────────────────────────────────────────────
  onSubmit(): void {
    // Marcar todos como touched para mostrar errores
    this.form.markAllAsTouched();

    // Validar campos visibles solamente
    const camposInvalidosVisibles = this.camposOrdenados().filter(c => {
      if (!this.esVisible(c)) return false;
      if (c.tipo === 'firma') return c.obligatorio && !this.firmas[c.id];
      return c.obligatorio && this.form.get(c.id)?.invalid;
    });

    if (camposInvalidosVisibles.length > 0) return;

    const valores: Record<string, any> = {};
    const labels: Record<string, string> = {};
    for (const c of this.camposOrdenados()) {
      if (!this.esVisible(c)) continue;
      labels[c.id] = c.titulo ?? c.id;
      if (c.tipo === 'firma') {
        valores[c.id] = this.firmas[c.id] ?? null;
      } else {
        valores[c.id] = this.form.get(c.id)?.value ?? null;
      }
    }
    this.formularioEnviado.emit({ ...valores, __LABELS__: labels, __labels__: labels });
  }

  onGuardarBorrador(): void {
    const valores: Record<string, any> = {};
    for (const c of this.camposOrdenados()) {
      valores[c.id] = c.tipo === 'firma' ? (this.firmas[c.id] ?? null) : this.form.get(c.id)?.value;
    }
    this.borrador.emit(valores);
  }
}
