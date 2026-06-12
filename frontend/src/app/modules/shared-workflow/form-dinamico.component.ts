import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges,
  signal, computed, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CampoFormulario } from '../../core/models/flujo.models';
import { Subscription } from 'rxjs';

export interface TramiteCtx {
  empresaId: string;
  politicaId: string;
  tramiteId: string;
  subidoPor: string;
}

@Component({
  selector: 'app-form-dinamico',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div>
    @if (nombrePaso || nombrePolitica) {
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);border-radius:12px 12px 0 0;padding:20px 24px 16px;">
        @if (nombrePolitica) {
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,255,255,0.55);margin:0 0 4px">{{ nombrePolitica }}</p>
        }
        <h3 style="font-size:17px;font-weight:700;color:white;margin:0 0 5px">{{ nombrePaso }}</h3>
        <p style="font-size:11px;color:rgba(255,255,255,0.65);margin:0">Complete los campos (*) y avance al siguiente paso</p>
      </div>
    }
    <form [formGroup]="form" (ngSubmit)="onSubmit()">

      <!-- campos: layout fiel al canvas diseñador (posX exacto, filas agrupadas por proximidad Y) -->
      <div style="width:760px;padding:16px 0 8px;box-sizing:border-box;" class="space-y-3 mb-6">
      @for (fila of filasLayout(); track $index) {
        <div class="flex items-start">
        @for (campo of fila; track campo.id; let j = $index) {
          @if (esVisible(campo)) {
            <div class="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-1.5 flex-shrink-0"
                 [style.width.px]="campo.largoCampo || 240"
                 [style.margin-left.px]="margenIzquierdo(fila, j)">
            <label class="block text-sm font-semibold text-slate-700">
              {{ campo.titulo }}
              @if (campo.obligatorio) { <span class="text-red-500">*</span> }
            </label>
            @if (campo.descripcion) {
              <p style="font-size:11px;color:#64748b;margin:0">{{ campo.descripcion }}</p>
            }

            <!-- SOLO LECTURA -->
            @if (campo.soloLectura) {
              @if (campo.tipo === 'archivo') {
                <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
                  <span class="text-lg">📎</span>
                  <span class="flex-1 truncate">{{ form.get(campo.id)?.value || '(sin archivo)' }}</span>
                  <span class="material-symbols-outlined text-slate-400 text-[16px]">visibility</span>
                </div>
              } @else if (campo.tipo === 'firma') {
                <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500 italic">
                  <span class="material-symbols-outlined text-slate-400 text-[16px]">draw</span>
                  <span>Campo de firma — solo lectura</span>
                  <span class="material-symbols-outlined text-slate-400 text-[16px] ml-auto">lock</span>
                </div>
              } @else if (campo.tipo === 'grid') {
                <div class="overflow-x-auto rounded-lg border border-slate-200">
                  <table class="w-full text-sm border-collapse">
                    <thead class="bg-slate-50">
                      <tr>
                        @for (col of campo.tablaColumnas; track col.id) {
                          <th class="px-3 py-2 border border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">{{ col.titulo }}</th>
                        }
                      </tr>
                    </thead>
                    <tbody>
                      @for (fila of campo.tablaFilas; track fila.id) {
                        <tr>
                          <td class="px-3 py-2 border border-slate-200 bg-slate-50 font-medium text-slate-700">{{ fila.etiqueta }}</td>
                          @for (col of (campo.tablaColumnas ?? []).slice(1); track col.id) {
                            <td class="px-3 py-2 border border-slate-200 text-slate-700">{{ getValorTabla(campo, fila.id, col.id) }}</td>
                          }
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm">
                  <span class="flex-1 text-slate-700">{{ getValorReadonly(campo) }}</span>
                  <span class="material-symbols-outlined text-slate-400 text-[16px]">lock</span>
                </div>
              }
            }

            <!-- TEXTO -->
            @if (!campo.soloLectura && campo.tipo === 'texto') {
              <input
                [formControlName]="campo.id"
                type="text"
                [placeholder]="campo.placeholder || ''"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            }

            <!-- TEXTO_LARGO -->
            @if (!campo.soloLectura && campo.tipo === 'texto_largo') {
              <textarea
                [formControlName]="campo.id"
                [placeholder]="campo.placeholder || ''"
                rows="4"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none">
              </textarea>
            }

            <!-- NUMERO -->
            @if (!campo.soloLectura && campo.tipo === 'numero') {
              <div class="flex items-center gap-2">
                @if (campo.prefijoSufijo) {
                  <span class="text-slate-600 text-sm font-medium">{{ campo.prefijoSufijo }}</span>
                }
                <input
                  [formControlName]="campo.id"
                  type="number"
                  [min]="campo.min ?? null"
                  [max]="campo.max ?? null"
                  [placeholder]="campo.placeholder || '0'"
                  class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
              </div>
            }

            <!-- LISTA (select o checkboxes) -->
            @if (!campo.soloLectura && campo.tipo === 'lista') {
              @if (!campo.multiple) {
                <select
                  [formControlName]="campo.id"
                  class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Seleccione una opción...</option>
                  @for (op of campo.opciones; track op.valor) {
                    <option [value]="op.valor">{{ op.label }}</option>
                  }
                </select>
              } @else {
                <div class="space-y-2">
                  @for (op of campo.opciones; track op.valor) {
                    <label class="flex items-center gap-2 cursor-pointer">
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
            @if (!campo.soloLectura && campo.tipo === 'si_no') {
              <div class="flex gap-2">
                <button type="button"
                  (click)="form.get(campo.id)?.setValue(true)"
                  [class.ring-2]="form.get(campo.id)?.value === true"
                  class="flex-1 py-2 rounded-lg border border-slate-300 text-sm font-semibold transition-all"
                  [class.bg-emerald-50]="form.get(campo.id)?.value === true"
                  [class.border-emerald-400]="form.get(campo.id)?.value === true"
                  [class.text-emerald-700]="form.get(campo.id)?.value === true">
                  ✓ Sí
                </button>
                <button type="button"
                  (click)="form.get(campo.id)?.setValue(false)"
                  [class.ring-2]="form.get(campo.id)?.value === false"
                  class="flex-1 py-2 rounded-lg border border-slate-300 text-sm font-semibold transition-all"
                  [class.bg-red-50]="form.get(campo.id)?.value === false"
                  [class.border-red-400]="form.get(campo.id)?.value === false"
                  [class.text-red-700]="form.get(campo.id)?.value === false">
                  ✗ No
                </button>
              </div>
            }

            <!-- FECHA -->
            @if (!campo.soloLectura && campo.tipo === 'fecha') {
              <input
                [formControlName]="campo.id"
                [type]="campo.incluyeHora ? 'datetime-local' : 'date'"
                class="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
            }

            <!-- ARCHIVO -->
            @if (!campo.soloLectura && campo.tipo === 'archivo') {
              <div class="border-2 border-dashed border-slate-300 rounded-lg px-3 py-2 hover:border-blue-400 transition-colors cursor-pointer">
                <input
                  type="file"
                  [id]="'file-' + campo.id"
                  [accept]="campo.formatos || '*'"
                  [multiple]="(campo.cantidadMaxima || 1) > 1"
                  (change)="onFileChange($event, campo.id)"
                  class="hidden"/>
                <label [for]="'file-' + campo.id" class="cursor-pointer flex items-center gap-2">
                  <span class="text-base text-slate-400">📎</span>
                  <div class="min-w-0">
                    <span class="text-sm text-slate-600 font-medium">Adjuntar archivo</span>
                    @if (campo.formatos) {
                      <span class="text-xs text-slate-400 block truncate">{{ campo.formatos }}</span>
                    }
                  </div>
                </label>
                @if (subiendoArchivo[campo.id]) {
                  <p class="mt-1 text-xs text-blue-600 font-medium flex items-center gap-1">
                    <span class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"></span>
                    Subiendo...
                  </p>
                } @else if (archivosNombres[campo.id]) {
                  <p class="mt-1 text-xs text-emerald-600 font-medium truncate">✅ {{ archivosNombres[campo.id] }}</p>
                }
              </div>
            }

            <!-- FIRMA (canvas) -->
            @if (!campo.soloLectura && campo.tipo === 'firma') {
              <div class="space-y-2">
                @if (campo.rolFirma) {
                  <p class="text-xs text-slate-500">Firma requerida para: <strong>{{ campo.rolFirma }}</strong></p>
                }
                <div class="border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    [id]="'canvas-' + campo.id"
                    width="600" height="150"
                    class="w-full touch-none cursor-crosshair block"
                    (mousedown)="startDraw($event, campo.id)"
                    (mousemove)="draw($event, campo.id)"
                    (mouseup)="stopDraw(campo.id)"
                    (mouseleave)="stopDraw(campo.id)"
                    (touchstart)="startDrawTouch($event, campo.id)"
                    (touchmove)="drawTouch($event, campo.id)"
                    (touchend)="stopDraw(campo.id)"
                    (touchcancel)="stopDraw(campo.id)">
                  </canvas>
                </div>
                <div class="flex items-center justify-between">
                  <button type="button"
                    (click)="limpiarFirma(campo.id)"
                    class="text-xs text-red-500 hover:text-red-700 font-medium">
                    Limpiar
                  </button>
                  @if (firmas[campo.id]) {
                    <span class="text-xs text-emerald-600 font-medium">✓ Firmado</span>
                  }
                </div>
              </div>
            }

            <!-- TABLA / GRID -->
            @if (!campo.soloLectura && campo.tipo === 'grid') {
              <div class="overflow-x-auto rounded-lg border border-slate-200" [formGroupName]="campo.id">
                <table class="w-full text-sm border-collapse">
                  <thead class="bg-slate-50">
                    <tr>
                      @for (col of campo.tablaColumnas; track col.id) {
                        <th class="px-3 py-2 border border-slate-200 text-left text-xs font-semibold text-slate-500 uppercase">{{ col.titulo }}</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of campo.tablaFilas; track fila.id) {
                      <tr [formGroupName]="fila.id">
                        <td class="px-3 py-2 border border-slate-200 bg-slate-50 font-medium text-slate-700">{{ fila.etiqueta }}</td>
                        @for (col of (campo.tablaColumnas ?? []).slice(1); track col.id) {
                          <td class="border border-slate-200 p-1">
                            <input
                              [formControlName]="col.id"
                              [type]="col.tipo === 'numero' ? 'number' : 'text'"
                              class="w-full rounded-md border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/>
                          </td>
                        }
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              @if ((campo.tablaColumnas?.length ?? 0) === 0 || (campo.tablaFilas?.length ?? 0) === 0) {
                <p class="text-xs text-slate-400 italic">Esta tabla aún no tiene columnas o filas configuradas.</p>
              }
            }

            <!-- Error de validación -->
            @if (form.get(campo.id)?.invalid && form.get(campo.id)?.touched) {
              <p class="text-xs text-red-500">Este campo es obligatorio.</p>
            }
            </div>
          }
        }
        </div><!-- /fila row -->
      }
      </div><!-- /campos wrapper -->

      <!-- Botones (dentro del mismo min-width para alinearse con los campos) -->
      <div class="flex gap-3 pt-4 border-t border-slate-200" style="min-width:760px;padding-left:16px;padding-right:16px;box-sizing:border-box;">
        @if (mostrarAnterior) {
          <button type="button"
            (click)="anterior.emit()"
            class="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 font-semibold hover:bg-slate-50 transition-colors">
            ← Anterior
          </button>
        }
        <button type="submit"
          [disabled]="cargando"
          class="flex-1 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
          {{ esUltimoStep ? 'Finalizar ✓' : 'Continuar →' }}
        </button>
      </div>
    </form>
    @if (nombrePaso || nombrePolitica) {
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;padding:10px 24px;display:flex;justify-content:space-between;">
        <span style="font-size:10px;color:#94a3b8">NexusFlow · Sistema de Gestión de Trámites</span>
        <span style="font-size:10px;color:#94a3b8">{{ campos.length }} campo(s)</span>
      </div>
    }
    </div>
  `
})
export class FormDinamicoComponent implements OnInit, OnChanges, OnDestroy {
  @Input() campos: CampoFormulario[] = [];
  @Input() respuestasPrevias: Record<string, any> = {};
  @Input() nombrePaso = '';
  @Input() nombrePolitica = '';
  @Input() mostrarAnterior = false;
  @Input() esUltimoStep = false;
  @Input() cargando = false;
  @Input() tramiteCtx?: TramiteCtx;

  @Output() formularioEnviado = new EventEmitter<Record<string, any>>();
  @Output() anterior = new EventEmitter<void>();
  @Output() archivoSubido = new EventEmitter<void>();

  private http = inject(HttpClient);
  subiendoArchivo: Record<string, boolean> = {};

  private fb = inject(FormBuilder);
  form!: FormGroup;

  firmas: Record<string, string> = {};
  archivosNombres: Record<string, string> = {};
  checkboxValues: Record<string, string[]> = {};

  private drawingState: Record<string, boolean> = {};
  private canvasContexts: Record<string, CanvasRenderingContext2D> = {};
  private subs: Subscription[] = [];

  private _camposSignal = signal<CampoFormulario[]>([]);

  // Always positioned layout. If campos have no posX, auto-compute 2-column grid.
  camposConLayout = computed(() => {
    const sorted = [...this._camposSignal()].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const tienePosicion = sorted.some(c => c.posX !== undefined && c.posX !== null);
    if (!tienePosicion) {
      // None have positions: 2-column grid
      return sorted.map((c, i) => ({
        ...c,
        posX: (i % 2) * 370 + 10,
        posY: Math.floor(i / 2) * 130 + 10,
        largoCampo: c.largoCampo ?? 350,
      }));
    }
    // Some have positions; assign positions to those that don't (place below last positioned row)
    const maxY = sorted.reduce((m, c) => (c.posY != null ? Math.max(m, c.posY) : m), 0);
    let autoRow = 0, autoCol = 0;
    return sorted.map(c => {
      if (c.posX != null && c.posY != null) return c;
      const out = { ...c, posX: autoCol * 370 + 10, posY: maxY + 150 + autoRow * 130, largoCampo: c.largoCampo ?? 350 };
      if (++autoCol >= 2) { autoCol = 0; autoRow++; }
      return out;
    });
  });

  // Keep for backward compat references
  camposOrdenados = computed(() =>
    [...this._camposSignal()].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  );

  // Group camposConLayout into visual rows by Y proximity, preserve posX order within each row
  filasLayout = computed(() => {
    const sorted = [...this.camposConLayout()].sort((a, b) => {
      const dy = (a.posY ?? 0) - (b.posY ?? 0);
      return dy !== 0 ? dy : (a.posX ?? 0) - (b.posX ?? 0);
    });
    const filas: CampoFormulario[][] = [];
    for (const campo of sorted) {
      const y = campo.posY ?? 0;
      const idx = filas.findIndex(f => Math.abs((f[0].posY ?? 0) - y) < 80);
      if (idx >= 0) {
        filas[idx].push(campo);
        filas[idx].sort((a, b) => (a.posX ?? 0) - (b.posX ?? 0));
      } else {
        filas.push([campo]);
      }
    }
    return filas.sort((a, b) => (a[0].posY ?? 0) - (b[0].posY ?? 0));
  });

  alturaCanvas = computed(() => {
    const campos = this.camposConLayout();
    if (!campos.length) return 400;
    return Math.max(400, ...campos.map(c => (c.posY ?? 0) + 140)) + 40;
  });

  // Margen izquierdo de cada campo en la fila: primer campo usa posX; los siguientes
  // usan el gap real entre el borde derecho del anterior y el posX del actual.
  margenIzquierdo(fila: CampoFormulario[], idx: number): number {
    const campo = fila[idx];
    if (idx === 0) return campo.posX ?? 0;
    const prev = fila[idx - 1];
    const gap = (campo.posX ?? 0) - ((prev.posX ?? 0) + (prev.largoCampo || 240));
    return Math.max(0, gap);
  }

  ngOnInit(): void {
    this._camposSignal.set(this.campos);
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['campos'] && !changes['campos'].firstChange) {
      this._camposSignal.set(this.campos);
      this.firmas = {};
      this.archivosNombres = {};
      this.checkboxValues = {};
      this.canvasContexts = {};
      this.subs.forEach(s => s.unsubscribe());
      this.subs = [];
      this.buildForm();
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  getValorTabla(campo: CampoFormulario, filaId: string, columnaId: string): string {
    const val = this.respuestasPrevias?.[campo.id]?.[filaId]?.[columnaId]
      ?? this.form?.get([campo.id, filaId, columnaId])?.value
      ?? '';
    return val === null || val === undefined || val === '' ? '—' : String(val);
  }

  getValorReadonly(campo: CampoFormulario): string {
    const val = this.respuestasPrevias?.[campo.id] ?? this.form?.get(campo.id)?.value ?? '';
    if (val === null || val === undefined || val === '') return '—';
    if (campo.tipo === 'si_no') return val === true || val === 'true' ? 'Sí' : 'No';
    if (campo.tipo === 'lista' && campo.opciones?.length) {
      const opcion = campo.opciones.find(o => o.valor === val || o.label === val);
      return opcion ? opcion.label : String(val);
    }
    return String(val);
  }

  private buildForm(): void {
    const controls: Record<string, any> = {};
    for (const c of this.campos) {
      const prev = this.respuestasPrevias?.[c.id] ?? '';
      if (c.tipo === 'grid') {
        const filasGroup: Record<string, any> = {};
        for (const fila of c.tablaFilas ?? []) {
          const colsGroup: Record<string, any> = {};
          for (const col of (c.tablaColumnas ?? []).slice(1)) {
            colsGroup[col.id] = [{ value: prev?.[fila.id]?.[col.id] ?? '', disabled: !!c.soloLectura }];
          }
          filasGroup[fila.id] = this.fb.group(colsGroup);
        }
        controls[c.id] = this.fb.group(filasGroup);
      } else if (c.soloLectura) {
        controls[c.id] = [{ value: prev, disabled: true }];
      } else {
        const validators = c.obligatorio ? [Validators.required] : [];
        if (c.tipo === 'lista' && c.multiple) {
          this.checkboxValues[c.id] = Array.isArray(prev) ? prev : [];
          controls[c.id] = [this.checkboxValues[c.id], validators];
        } else {
          controls[c.id] = [prev, validators];
        }
      }
    }
    this.form = this.fb.group(controls);

    for (const c of this.campos) {
      if (c.dependeDeCampoId) {
        const sub = this.form.get(c.dependeDeCampoId)?.valueChanges.subscribe(() => {
          // Recalcular visibilidad
        });
        if (sub) this.subs.push(sub);
      }
    }
  }

  esVisible(campo: CampoFormulario): boolean {
    if (!campo.dependeDeCampoId) return true;
    const valorPadre = this.form?.get(campo.dependeDeCampoId)?.value;
    return String(valorPadre ?? '').toLowerCase() === String(campo.dependeDeValor ?? '').toLowerCase();
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
    if (!input.files?.length) return;

    const files = Array.from(input.files);
    const nombre = files.map(f => f.name).join(', ');
    this.archivosNombres[campoId] = nombre;
    this.form.get(campoId)?.setValue(nombre);

    if (!this.tramiteCtx) return;

    const ctx = this.tramiteCtx;
    const fd = new FormData();
    fd.append('archivo', files[0], files[0].name);
    fd.append('empresa_id', ctx.empresaId);
    fd.append('politica_id', ctx.politicaId);
    fd.append('tramite_id', ctx.tramiteId);
    fd.append('subido_por', ctx.subidoPor);

    this.subiendoArchivo[campoId] = true;
    this.http.post<any>('/ai/documentos/subir', fd).subscribe({
      next: (res) => {
        this.subiendoArchivo[campoId] = false;
        this.form.get(campoId)?.setValue(res.key ?? nombre);
        this.archivoSubido.emit();
      },
      error: () => {
        this.subiendoArchivo[campoId] = false;
      }
    });
  }

  private getCtx(campoId: string): CanvasRenderingContext2D | null {
    if (this.canvasContexts[campoId]) return this.canvasContexts[campoId];
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    this.canvasContexts[campoId] = ctx;
    return ctx;
  }

  // Touch support for mobile signature
  private coordsFromTouch(e: TouchEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0] || e.changedTouches[0];
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
  }

  startDrawTouch(e: TouchEvent, campoId: string): void {
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = this.getCtx(campoId);
    if (!ctx) return;
    this.drawingState[campoId] = true;
    const { x, y } = this.coordsFromTouch(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.preventDefault();
  }

  drawTouch(e: TouchEvent, campoId: string): void {
    if (!this.drawingState[campoId]) return;
    const ctx = this.getCtx(campoId);
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!ctx || !canvas) return;
    const { x, y } = this.coordsFromTouch(e, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  }

  private coordsFromEvent(e: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
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

  limpiarFirma(campoId: string): void {
    const canvas = document.getElementById('canvas-' + campoId) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = this.getCtx(campoId);
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    delete this.firmas[campoId];
    this.form.get(campoId)?.setValue('');
  }

  onSubmit(): void {
    this.form.markAllAsTouched();

    const camposInvalidosVisibles = this.camposConLayout().filter(c => {
      if (!this.esVisible(c)) return false;
      if (c.tipo === 'firma') return c.obligatorio && !this.firmas[c.id];
      return c.obligatorio && this.form.get(c.id)?.invalid;
    });

    if (camposInvalidosVisibles.length > 0) return;

    const valores: Record<string, any> = {};
    const labels: Record<string, string> = {};
    for (const c of this.camposConLayout()) {
      if (!this.esVisible(c)) continue;
      labels[c.id] = c.titulo ?? c.id;
      if (c.tipo === 'firma') {
        valores[c.id] = this.firmas[c.id] ?? null;
      } else if (c.tipo === 'grid') {
        valores[c.id] = (this.form.get(c.id) as FormGroup)?.getRawValue() ?? null;
        // Store row/column labels so the historial view can render a proper table
        const meta: { col0Header: string; filas: Record<string, string>; columnas: Record<string, string> } = {
          col0Header: (c.tablaColumnas ?? [])[0]?.titulo ?? 'Concepto',
          filas: {},
          columnas: {}
        };
        for (const fila of c.tablaFilas ?? []) meta.filas[fila.id] = fila.etiqueta ?? fila.id;
        for (const col of (c.tablaColumnas ?? []).slice(1)) meta.columnas[col.id] = col.titulo ?? col.id;
        valores[`__GRID_META__${c.id}`] = meta;
      } else {
        valores[c.id] = this.form.get(c.id)?.value ?? null;
      }
    }
    this.formularioEnviado.emit({ ...valores, __LABELS__: labels, __labels__: labels });
  }
}
