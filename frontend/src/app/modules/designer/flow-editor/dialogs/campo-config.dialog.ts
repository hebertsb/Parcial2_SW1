import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CampoFormulario, TipoCampo, OpcionCampo } from '../../../../core/models/flujo.models';

const TIPOS: { valor: TipoCampo; etiqueta: string; icono: string; color: string }[] = [
  { valor: 'texto',       etiqueta: 'Texto',        icono: 'Tr',  color: '#3b82f6' },
  { valor: 'texto_largo', etiqueta: 'Texto largo',  icono: '≡',   color: '#14b8a6' },
  { valor: 'numero',      etiqueta: 'Número',       icono: '#',   color: '#10b981' },
  { valor: 'lista',       etiqueta: 'Lista',        icono: '≔',   color: '#f97316' },
  { valor: 'si_no',       etiqueta: 'Sí / No',      icono: '☑',   color: '#a855f7' },
  { valor: 'fecha',       etiqueta: 'Fecha',        icono: '📅',  color: '#06b6d4' },
  { valor: 'archivo',     etiqueta: 'Archivo',      icono: '📎',  color: '#f59e0b' },
  { valor: 'firma',       etiqueta: 'Firma Digital', icono: '✍',  color: '#ec4899' },
  { valor: 'label',       etiqueta: 'Etiqueta',     icono: '🏷',  color: '#64748b' },
  { valor: 'grid',        etiqueta: 'Tabla / Grid', icono: '⊞',  color: '#8b5cf6' },
];

@Component({
  selector: 'app-campo-config-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black/70 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
         (click)="cerrar.emit()">
      <div class="w-full max-w-md bg-[#0f0f1a] border border-white/10 rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.7)] text-slate-100 overflow-hidden"
           (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="px-6 pt-5 pb-4 border-b border-white/8 flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-purple-400"
               style="background:rgba(168,85,247,0.15)">
            <span class="material-symbols-outlined text-[18px]">add_circle</span>
          </div>
          <h3 class="text-base font-bold">{{ campo ? 'Editar campo' : 'Nuevo campo' }}</h3>
        </div>

        <div class="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          <!-- Tipo de campo -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Tipo de campo *</label>
            <div class="grid grid-cols-4 gap-2 mt-2">
              @for (t of tipos; track t.valor) {
                <button type="button"
                        class="tipo-btn"
                        [class.activo]="model.tipo === t.valor"
                        [style.--c]="t.color"
                        (click)="model.tipo = t.valor">
                  <span class="tipo-icon">{{ t.icono }}</span>
                  <span class="tipo-label">{{ t.etiqueta }}</span>
                </button>
              }
            </div>
          </div>

          <!-- Título del campo -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Título del campo *</label>
            <input [(ngModel)]="model.titulo"
                   placeholder="Ej: Nombre completo, Tipo de crédito..."
                   class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-all" />
          </div>

          <!-- Descripción -->
          <div>
            <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Descripción / instrucciones</label>
            <input [(ngModel)]="model.descripcion"
                   placeholder="Ej: Ingrese NIT sin puntos ni guiones"
                   class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-all" />
          </div>

          @if (model.tipo === 'texto' || model.tipo === 'texto_largo') {
            <div>
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Placeholder / ayuda visible</label>
              <input [(ngModel)]="model.placeholder"
                     placeholder="Ej: Escriba aquí..."
                     class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-purple-500 transition-all" />
            </div>
          }

          <!-- Opciones extra por tipo -->
          @if (model.tipo === 'lista') {
            <div>
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Opciones (una por línea)</label>
              <textarea [(ngModel)]="opcionesText" rows="4"
                        placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                        class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-purple-500 resize-none"></textarea>
              <label class="flex items-center gap-2 mt-2 text-xs cursor-pointer select-none text-slate-400">
                <input type="checkbox" [(ngModel)]="model.multiple" class="accent-purple-500" />
                Permitir selección múltiple
              </label>
              <label class="flex items-center gap-2 mt-1 text-xs cursor-pointer select-none text-slate-400">
                <input type="checkbox" [(ngModel)]="model.permitirOtro" class="accent-purple-500" />
                Permitir opción "Otro"
              </label>
            </div>
          }

          @if (model.tipo === 'numero') {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Valor mínimo</label>
                <input type="number" [(ngModel)]="model.min"
                       class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Valor máximo</label>
                <input type="number" [(ngModel)]="model.max"
                       class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div class="col-span-2">
                <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Prefijo / unidad (Bs., %, m²)</label>
                <input [(ngModel)]="model.prefijoSufijo"
                       placeholder="Ej: Bs., $, %"
                       class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              </div>
            </div>
          }

          @if (model.tipo === 'fecha') {
            <div>
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Formato de fecha</label>
              <div class="flex gap-2 mt-2">
                <label class="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer text-xs">
                  <span>Corta</span>
                  <input type="radio" name="formatoFecha" [(ngModel)]="model.formatoFecha" value="corta" class="accent-cyan-500" />
                </label>
                <label class="flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-700 bg-slate-800/50 cursor-pointer text-xs">
                  <span>Larga</span>
                  <input type="radio" name="formatoFecha" [(ngModel)]="model.formatoFecha" value="larga" class="accent-cyan-500" />
                </label>
              </div>
              <label class="flex items-center gap-2 mt-2 text-xs cursor-pointer select-none text-slate-400">
                <input type="checkbox" [(ngModel)]="model.incluyeHora" class="accent-cyan-500" />
                Incluir selector de hora
              </label>
            </div>
          }

          @if (model.tipo === 'archivo') {
            <div>
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Formatos permitidos</label>
              <input [(ngModel)]="model.formatos"
                     placeholder=".pdf,.jpg,.png,.docx,.xlsx"
                     class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-3 block">Cantidad máxima de archivos</label>
              <input type="number"
                     [(ngModel)]="model.cantidadMaxima"
                     min="1"
                     class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
            </div>
          }

          @if (model.tipo === 'firma') {
            <div>
              <label class="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Rol que firma</label>
              <input [(ngModel)]="model.rolFirma"
                     placeholder="Ej: Cliente, Gerente, Aprobador"
                     class="w-full mt-1.5 bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500" />
              <label class="flex items-center gap-2 mt-2 text-xs cursor-pointer select-none text-slate-400">
                <input type="checkbox" [(ngModel)]="model.registrarFechaHora" class="accent-pink-500" />
                Registrar fecha y hora de la firma
              </label>
            </div>
          }

          @if (model.tipo === 'fecha') {
            <div>
              <label class="flex items-center gap-2 mt-1 text-xs cursor-pointer select-none text-slate-400">
                <input type="checkbox" [(ngModel)]="model.incluyeHora" class="accent-cyan-500" />
                Incluir selector de hora
              </label>
            </div>
          }

          @if (model.tipo === 'grid') {
            <div class="space-y-3 p-3 bg-slate-900/40 border border-slate-700 rounded-xl">
              <p class="text-[10px] text-slate-400">
                Arma una tabla tipo recibo: define columnas (cabeceras) y filas predefinidas. El cliente rellenará cada celda.
              </p>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] uppercase text-slate-500 tracking-wider font-bold">Columnas</label>
                  <button type="button" (click)="agregarColumna()" class="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">add</span> Columna
                  </button>
                </div>
                <div class="space-y-1">
                  @for (col of (model.tablaColumnas ?? []); track $index; let ci = $index) {
                    <div class="flex gap-1 items-center">
                      <input [(ngModel)]="col.titulo"
                             [placeholder]="ci === 0 ? 'Ej: Concepto' : 'Ej: Cantidad'"
                             class="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs"/>
                      <select [(ngModel)]="col.tipo" class="bg-slate-800 border border-slate-700 rounded-md px-1 py-1.5 text-xs">
                        <option value="texto">Texto</option>
                        <option value="numero">Número</option>
                      </select>
                      <button type="button" (click)="eliminarColumna(ci)" class="text-slate-500 hover:text-red-400">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  }
                  @if (!model.tablaColumnas?.length) {
                    <p class="text-[10px] text-slate-600">Sin columnas. La primera columna será la cabecera de cada fila.</p>
                  }
                </div>
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] uppercase text-slate-500 tracking-wider font-bold">Filas predefinidas</label>
                  <button type="button" (click)="agregarFila()" class="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]">add</span> Fila
                  </button>
                </div>
                <div class="space-y-1">
                  @for (fila of (model.tablaFilas ?? []); track $index; let fi = $index) {
                    <div class="flex gap-1 items-center">
                      <input [(ngModel)]="fila.etiqueta"
                             placeholder="Ej: Lectura anterior (kWh)"
                             class="flex-1 bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs"/>
                      <button type="button" (click)="eliminarFila(fi)" class="text-slate-500 hover:text-red-400">
                        <span class="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  }
                  @if (!model.tablaFilas?.length) {
                    <p class="text-[10px] text-slate-600">Sin filas. Agrega una fila por cada concepto que el cliente debe llenar.</p>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Campo obligatorio -->
          <label class="flex items-center gap-3 cursor-pointer select-none group">
            <input type="checkbox" [(ngModel)]="model.obligatorio" class="accent-purple-500 w-4 h-4" />
            <div>
              <span class="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">Campo obligatorio</span>
              <p class="text-[10px] text-slate-500">El usuario debe completarlo para avanzar</p>
            </div>
          </label>

          <!-- Solo lectura -->
          @if (model.tipo !== 'label') {
            <label class="flex items-center gap-3 cursor-pointer select-none group">
              <input type="checkbox" [(ngModel)]="model.soloLectura" class="accent-cyan-500 w-4 h-4" />
              <div>
                <span class="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">Solo lectura</span>
                <p class="text-[10px] text-slate-500">El usuario verá el contenido pero no podrá modificarlo</p>
              </div>
            </label>
          }

          <!-- Lógica condicional -->
          @if (camposDisponibles.length > 0) {
            <div class="border border-purple-500/20 rounded-xl p-4 bg-purple-500/5">
              <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-purple-400 text-[16px]">visibility</span>
                <span class="text-[10px] uppercase tracking-widest text-purple-400 font-bold">Lógica condicional (opcional)</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-[9px] uppercase text-slate-500 tracking-widest">Mostrar si el campo...</label>
                  <select [(ngModel)]="model.dependeDeCampoId"
                          class="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-purple-500">
                    <option [ngValue]="undefined">(Siempre visible)</option>
                    @for (c of camposDisponibles; track c.id) {
                      <option [ngValue]="c.id">{{ c.titulo }}</option>
                    }
                  </select>
                </div>
                <div>
                  <label class="text-[9px] uppercase text-slate-500 tracking-widest">... sea igual a:</label>
                  <input [(ngModel)]="model.dependeDeValor"
                         placeholder="Ej: Sí, Solicitante, etc"
                         [disabled]="!model.dependeDeCampoId"
                         class="w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-purple-500 disabled:opacity-40" />
                </div>
              </div>
              <p class="text-[10px] text-slate-600 mt-2">El campo solo aparecerá si el valor coincide.</p>
            </div>
          }

        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-white/8 flex gap-3">
          <button (click)="cerrar.emit()"
                  class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-sm font-semibold transition-all">
            Cancelar
          </button>
          <button (click)="onGuardar()"
                  [disabled]="!model.titulo?.trim()"
                  class="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-40"
                  style="background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white">
            {{ campo ? 'Actualizar' : 'Agregar campo' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tipo-btn {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 10px 4px;
      background: rgba(255,255,255,0.03);
      border: 1.5px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      cursor: pointer; transition: all 0.2s;
      color: #64748b; font-size: 11px; font-weight: 600;
    }
    .tipo-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #e2e8f0; }
    .tipo-btn.activo {
      background: color-mix(in srgb, var(--c) 18%, transparent);
      border-color: var(--c);
      color: var(--c);
      box-shadow: 0 0 12px color-mix(in srgb, var(--c) 30%, transparent);
    }
    .tipo-icon { font-size: 18px; line-height: 1; }
    .tipo-label { font-size: 9px; text-align: center; line-height: 1.2; }
  `]
})
export class CampoConfigDialogComponent implements OnInit {
  readonly tipos = TIPOS;

  @Input() tipoInicial: TipoCampo = 'texto';
  @Input() campo: CampoFormulario | null = null;
  @Input() camposDisponibles: CampoFormulario[] = [];

  @Output() guardar = new EventEmitter<CampoFormulario>();
  @Output() cerrar = new EventEmitter<void>();

  model: Partial<CampoFormulario> = {};
  opcionesText = '';

  ngOnInit(): void {
    if (this.campo) {
      this.model = { ...this.campo };
      this.opcionesText = (this.campo.opciones ?? []).map(o => o.label).join('\n');
    } else {
      this.model = {
        tipo: this.tipoInicial,
        titulo: '',
        obligatorio: false,
        orden: 0,
        ...(this.tipoInicial === 'archivo' ? { formatos: '.pdf,.jpg,.png,.docx,.xlsx' } : {}),
        ...(this.tipoInicial === 'grid' ? { tablaColumnas: [], tablaFilas: [] } : {}),
      };
    }
  }

  // ----- Tabla / Grid -----

  agregarColumna(): void {
    if (!this.model.tablaColumnas) this.model.tablaColumnas = [];
    const cols = this.model.tablaColumnas;
    cols.push({ id: cryptoIdLocal(), titulo: cols.length === 0 ? 'Concepto' : '', tipo: 'texto' });
  }

  eliminarColumna(idx: number): void {
    this.model.tablaColumnas?.splice(idx, 1);
  }

  agregarFila(): void {
    if (!this.model.tablaFilas) this.model.tablaFilas = [];
    this.model.tablaFilas.push({ id: cryptoIdLocal(), etiqueta: '' });
  }

  eliminarFila(idx: number): void {
    this.model.tablaFilas?.splice(idx, 1);
  }

  onGuardar(): void {
    if (!this.model.titulo?.trim()) return;
    const opciones: OpcionCampo[] = this.model.tipo === 'lista'
      ? this.opcionesText.split('\n').filter(l => l.trim()).map(l => ({ label: l.trim(), valor: l.trim().toLowerCase().replace(/\s+/g, '_') }))
      : [];
    const campo: CampoFormulario = {
      id: this.campo?.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'c-' + Math.random().toString(36).substring(2, 11)),
      formularioId: this.campo?.formularioId ?? '',
      tipo: this.model.tipo!,
      titulo: this.model.titulo!.trim(),
      descripcion: this.model.descripcion,
      obligatorio: this.model.obligatorio ?? false,
      orden: this.campo?.orden ?? 0,
      opciones: opciones.length ? opciones : undefined,
      multiple: this.model.multiple,
      formatos: this.model.formatos,
      min: this.model.min,
      max: this.model.max,
      prefijoSufijo: this.model.prefijoSufijo,
      permitirOtro: this.model.permitirOtro,
      placeholder: this.model.placeholder,
      incluyeHora: this.model.incluyeHora,
      formatoFecha: this.model.formatoFecha,
      cantidadMaxima: this.model.cantidadMaxima,
      rolFirma: this.model.rolFirma,
      registrarFechaHora: this.model.registrarFechaHora,
      dependeDeCampoId: this.model.dependeDeCampoId,
      dependeDeValor: this.model.dependeDeValor,
      soloLectura: this.model.soloLectura ?? false,
      tablaColumnas: this.model.tipo === 'grid' ? this.model.tablaColumnas : undefined,
      tablaFilas: this.model.tipo === 'grid' ? this.model.tablaFilas : undefined,
    };
    this.guardar.emit(campo);
  }
}

function cryptoIdLocal(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'c-' + Math.random().toString(36).substring(2, 11);
}
