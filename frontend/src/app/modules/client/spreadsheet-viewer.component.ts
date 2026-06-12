import {
  Component, Input, Output, EventEmitter, OnInit, OnDestroy, inject,
  signal, computed, ChangeDetectorRef, NgZone, ViewChild, ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';

interface CellData {
  v: string;
  f?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  bg?: string;
  align?: string;
  valign?: string;
  font?: string;
  fontSize?: number;
}
interface SheetData {
  name: string;
  rows: CellData[][];
  col_widths: number[];
  max_row: number;
  max_col: number;
}
interface CtxMenu { x: number; y: number; row: number; col: number; }

@Component({
  selector: 'app-spreadsheet-viewer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="xl-shell" (click)="closeCtxOnOutside($event)">

      <!-- ── Ribbon ── -->
      <div class="xl-ribbon">
        <!-- Tab bar -->
        <div class="xl-ribbon-tabs">
          <button class="xl-rtab" [class.xl-rtab-active]="activeTab()==='inicio'"   (click)="activeTab.set('inicio')">Inicio</button>
          <button class="xl-rtab" [class.xl-rtab-active]="activeTab()==='insertar'" (click)="activeTab.set('insertar')">Insertar</button>
          <button class="xl-rtab" [class.xl-rtab-active]="activeTab()==='formulas'" (click)="activeTab.set('formulas')">Fórmulas</button>
          <button class="xl-rtab" [class.xl-rtab-active]="activeTab()==='datos'"    (click)="activeTab.set('datos')">Datos</button>
          <button class="xl-rtab" [class.xl-rtab-active]="activeTab()==='vista'"    (click)="activeTab.set('vista')">Vista</button>
        </div>

        <!-- Ribbon body -->
        <div class="xl-ribbon-body">

          <!-- ── INICIO ──────────────────────────── -->
          @if (activeTab()==='inicio') {

            <!-- Portapapeles -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Pegar (Ctrl+V)">
                  <span class="material-symbols-outlined" style="font-size:28px">content_paste</span>
                  <span class="xl-rbtn-lbl">Pegar</span>
                </button>
                <div class="xl-rbtn-sm-col">
                  <button class="xl-rbtn xl-rbtn-sm" title="Cortar (Ctrl+X)">
                    <span class="material-symbols-outlined">content_cut</span> Cortar
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Copiar (Ctrl+C)">
                    <span class="material-symbols-outlined">content_copy</span> Copiar
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Copiar formato">
                    <span class="material-symbols-outlined">format_paint</span> Copiar formato
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Portapapeles</div>
            </div>
            <div class="xl-rsep"></div>

            <!-- Fuente -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content" style="flex-direction:column;gap:2px;">
                <div class="xl-rrow">
                  <select class="xl-font-sel" (change)="setFontFamily($event)" title="Fuente">
                    <option>Calibri</option>
                    <option>Arial</option>
                    <option>Times New Roman</option>
                    <option>Courier New</option>
                    <option>Verdana</option>
                    <option>Georgia</option>
                  </select>
                  <select class="xl-size-sel" (change)="setFontSize($event)" title="Tamaño de fuente">
                    <option>8</option><option>9</option><option>10</option>
                    <option selected>11</option><option>12</option><option>14</option>
                    <option>16</option><option>18</option><option>20</option>
                    <option>24</option><option>28</option><option>36</option><option>48</option>
                  </select>
                </div>
                <div class="xl-rrow">
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellBold()"      (click)="toggleBold()"    title="Negrita"><strong>B</strong></button>
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellItalic()"    (click)="toggleItalic()"  title="Cursiva"><em>I</em></button>
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellUnderline()" (click)="toggleUnderline()" title="Subrayado"><u>U</u></button>
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellStrike()"    (click)="toggleStrike()"  title="Tachado"><s>S</s></button>
                  <div class="xl-rsep-v"></div>
                  <label class="xl-rbtn xl-rbtn-ic xl-color-wrap" title="Color de texto">
                    <span class="material-symbols-outlined" style="font-size:14px">format_color_text</span>
                    <input type="color" (change)="setTextColor($event)" value="#000000" class="xl-color-input">
                  </label>
                  <label class="xl-rbtn xl-rbtn-ic xl-color-wrap" title="Color de relleno">
                    <span class="material-symbols-outlined" style="font-size:14px">format_color_fill</span>
                    <input type="color" (change)="setBgColor($event)" value="#ffffff" class="xl-color-input">
                  </label>
                </div>
              </div>
              <div class="xl-rgroup-label">Fuente</div>
            </div>
            <div class="xl-rsep"></div>

            <!-- Alineación -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content" style="flex-direction:column;gap:2px;">
                <div class="xl-rrow">
                  <button class="xl-rbtn xl-rbtn-ic" (click)="setValign('top')"    title="Alinear arriba">
                    <span class="material-symbols-outlined" style="font-size:14px">vertical_align_top</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" (click)="setValign('middle')" title="Centrar verticalmente">
                    <span class="material-symbols-outlined" style="font-size:14px">vertical_align_center</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" (click)="setValign('bottom')" title="Alinear abajo">
                    <span class="material-symbols-outlined" style="font-size:14px">vertical_align_bottom</span>
                  </button>
                  <div class="xl-rsep-v"></div>
                  <button class="xl-rbtn xl-rbtn-ic" title="Ajustar texto">
                    <span class="material-symbols-outlined" style="font-size:14px">wrap_text</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" title="Combinar y centrar">
                    <span class="material-symbols-outlined" style="font-size:14px">table_rows_narrow</span>
                  </button>
                </div>
                <div class="xl-rrow">
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellAlign()==='left'"   (click)="setAlign('left')"   title="Alinear a la izquierda">
                    <span class="material-symbols-outlined" style="font-size:14px">format_align_left</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellAlign()==='center'" (click)="setAlign('center')" title="Centrar">
                    <span class="material-symbols-outlined" style="font-size:14px">format_align_center</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="selCellAlign()==='right'"  (click)="setAlign('right')"  title="Alinear a la derecha">
                    <span class="material-symbols-outlined" style="font-size:14px">format_align_right</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" title="Justificar">
                    <span class="material-symbols-outlined" style="font-size:14px">format_align_justify</span>
                  </button>
                  <div class="xl-rsep-v"></div>
                  <button class="xl-rbtn xl-rbtn-ic" title="Aumentar sangría">
                    <span class="material-symbols-outlined" style="font-size:14px">format_indent_increase</span>
                  </button>
                  <button class="xl-rbtn xl-rbtn-ic" title="Disminuir sangría">
                    <span class="material-symbols-outlined" style="font-size:14px">format_indent_decrease</span>
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Alineación</div>
            </div>
            <div class="xl-rsep"></div>

            <!-- Número -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content" style="flex-direction:column;gap:2px;">
                <div class="xl-rrow">
                  <select class="xl-numfmt-sel" title="Formato de número">
                    <option>General</option>
                    <option>Número</option>
                    <option>Moneda</option>
                    <option>Porcentaje</option>
                    <option>Fecha corta</option>
                    <option>Texto</option>
                  </select>
                </div>
                <div class="xl-rrow">
                  <button class="xl-rbtn xl-rbtn-ic" (click)="setNumFormat2('currency')" title="Formato moneda" style="font-size:12px;font-weight:700">$</button>
                  <button class="xl-rbtn xl-rbtn-ic" (click)="setNumFormat2('percent')"  title="Porcentaje"    style="font-size:12px;font-weight:700">%</button>
                  <button class="xl-rbtn xl-rbtn-ic" title="Estilo de millares"           style="font-size:12px;font-weight:700">,</button>
                  <div class="xl-rsep-v"></div>
                  <button class="xl-rbtn xl-rbtn-ic" title="Aumentar decimales" style="font-size:10px">.0→</button>
                  <button class="xl-rbtn xl-rbtn-ic" title="Disminuir decimales" style="font-size:10px">←.0</button>
                </div>
              </div>
              <div class="xl-rgroup-label">Número</div>
            </div>
            <div class="xl-rsep"></div>

            <!-- Celdas -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <div class="xl-rbtn-sm-col" style="justify-content:flex-start;gap:1px;">
                  <button class="xl-rbtn xl-rbtn-sm" (click)="insertRowAboveAt(selRow())" [disabled]="selRow()<0" title="Insertar fila arriba">
                    <span class="material-symbols-outlined">add</span> Fila arriba
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" (click)="insertRowBelowAt(selRow())" [disabled]="selRow()<0" title="Insertar fila abajo">
                    <span class="material-symbols-outlined">add</span> Fila abajo
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" (click)="insertColLeftAt(selCol())"  [disabled]="selCol()<0" title="Insertar columna izq">
                    <span class="material-symbols-outlined">add</span> Columna izq
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" (click)="insertColRightAt(selCol())" [disabled]="selCol()<0" title="Insertar columna der">
                    <span class="material-symbols-outlined">add</span> Columna der
                  </button>
                </div>
                <div class="xl-rbtn-sm-col" style="justify-content:flex-start;gap:1px;">
                  <button class="xl-rbtn xl-rbtn-sm xl-danger" (click)="deleteRowAt(selRow())" [disabled]="selRow()<0" title="Eliminar fila">
                    <span class="material-symbols-outlined">remove</span> Elim. fila
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm xl-danger" (click)="deleteColAt(selCol())" [disabled]="selCol()<0" title="Eliminar columna">
                    <span class="material-symbols-outlined">remove</span> Elim. col
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Celdas</div>
            </div>
            <div class="xl-rsep"></div>

            <!-- Edición -->
            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" (click)="autoSum()" title="Autosuma">
                  <span class="material-symbols-outlined" style="font-size:28px">functions</span>
                  <span class="xl-rbtn-lbl">Autosuma</span>
                </button>
                <div class="xl-rbtn-sm-col">
                  <button class="xl-rbtn xl-rbtn-sm" (click)="sortAZ()" title="Ordenar A→Z" [disabled]="selCol()<0">
                    <span class="material-symbols-outlined">sort_by_alpha</span> Orden A→Z
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" (click)="sortZA()" title="Ordenar Z→A" [disabled]="selCol()<0">
                    <span class="material-symbols-outlined">sort</span> Orden Z→A
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" (click)="clearCell()" title="Borrar contenido" [disabled]="selRow()<0">
                    <span class="material-symbols-outlined">backspace</span> Borrar
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Edición</div>
            </div>
          }

          <!-- ── INSERTAR ──────────────────────────── -->
          @if (activeTab()==='insertar') {

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Tabla">
                  <span class="material-symbols-outlined" style="font-size:28px">table</span>
                  <span class="xl-rbtn-lbl">Tabla</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Tablas</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Gráfico de columnas">
                  <span class="material-symbols-outlined" style="font-size:28px">bar_chart</span>
                  <span class="xl-rbtn-lbl">Columnas</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Gráfico de líneas">
                  <span class="material-symbols-outlined" style="font-size:28px">show_chart</span>
                  <span class="xl-rbtn-lbl">Líneas</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Gráfico circular">
                  <span class="material-symbols-outlined" style="font-size:28px">pie_chart</span>
                  <span class="xl-rbtn-lbl">Circular</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Gráficos</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Insertar imagen">
                  <span class="material-symbols-outlined" style="font-size:28px">image</span>
                  <span class="xl-rbtn-lbl">Imagen</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Insertar formas">
                  <span class="material-symbols-outlined" style="font-size:28px">category</span>
                  <span class="xl-rbtn-lbl">Formas</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Ilustraciones</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Cuadro de texto">
                  <span class="material-symbols-outlined" style="font-size:28px">text_fields</span>
                  <span class="xl-rbtn-lbl">Cuadro de texto</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Encabezado y pie">
                  <span class="material-symbols-outlined" style="font-size:28px">import_contacts</span>
                  <span class="xl-rbtn-lbl">Encab. y pie</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Texto</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Insertar símbolo">
                  <span style="font-size:24px;font-family:serif;line-height:1">Ω</span>
                  <span class="xl-rbtn-lbl">Símbolo</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Símbolos</div>
            </div>
          }

          <!-- ── FÓRMULAS ──────────────────────────── -->
          @if (activeTab()==='formulas') {

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Insertar función">
                  <span class="material-symbols-outlined" style="font-size:28px">calculate</span>
                  <span class="xl-rbtn-lbl">Insertar función</span>
                </button>
                <div class="xl-rbtn-sm-col">
                  <button class="xl-rbtn xl-rbtn-sm" (click)="autoSum()" title="Autosuma">
                    <span class="material-symbols-outlined">functions</span> Autosuma
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Funciones recientes">
                    <span class="material-symbols-outlined">history</span> Recientes
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Matemáticas">
                    <span class="material-symbols-outlined">calculate</span> Matemáticas
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Biblioteca de funciones</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" [class.xl-tb-on]="showFormulasMode()" (click)="toggleShowFormulas()" title="Mostrar fórmulas">
                  <span class="material-symbols-outlined" style="font-size:28px">functions</span>
                  <span class="xl-rbtn-lbl">Mostrar fórmulas</span>
                </button>
                <div class="xl-rbtn-sm-col">
                  <button class="xl-rbtn xl-rbtn-sm" title="Rastrear precedentes">
                    <span class="material-symbols-outlined">arrow_forward</span> Precedentes
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Rastrear dependientes">
                    <span class="material-symbols-outlined">arrow_back</span> Dependientes
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Auditoría de fórmulas</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Calcular ahora">
                  <span class="material-symbols-outlined" style="font-size:28px">play_arrow</span>
                  <span class="xl-rbtn-lbl">Calcular ahora</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Cálculo</div>
            </div>
          }

          <!-- ── DATOS ──────────────────────────────── -->
          @if (activeTab()==='datos') {

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Obtener datos externos">
                  <span class="material-symbols-outlined" style="font-size:28px">cloud_download</span>
                  <span class="xl-rbtn-lbl">Obtener datos</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Actualizar todo">
                  <span class="material-symbols-outlined" style="font-size:28px">refresh</span>
                  <span class="xl-rbtn-lbl">Actualizar todo</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Obtener y transformar datos</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" (click)="sortAZ()" [disabled]="selCol()<0" title="Ordenar A a Z">
                  <span class="material-symbols-outlined" style="font-size:28px">sort_by_alpha</span>
                  <span class="xl-rbtn-lbl">Ordenar A→Z</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" (click)="sortZA()" [disabled]="selCol()<0" title="Ordenar Z a A">
                  <span class="material-symbols-outlined" style="font-size:28px">sort</span>
                  <span class="xl-rbtn-lbl">Ordenar Z→A</span>
                </button>
                <div class="xl-rbtn-sm-col">
                  <button class="xl-rbtn xl-rbtn-sm" title="Filtro automático">
                    <span class="material-symbols-outlined">filter_alt</span> Filtro
                  </button>
                  <button class="xl-rbtn xl-rbtn-sm" title="Borrar filtro">
                    <span class="material-symbols-outlined">filter_alt_off</span> Borrar filtro
                  </button>
                </div>
              </div>
              <div class="xl-rgroup-label">Ordenar y filtrar</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Validación de datos">
                  <span class="material-symbols-outlined" style="font-size:28px">rule</span>
                  <span class="xl-rbtn-lbl">Validación</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Quitar duplicados">
                  <span class="material-symbols-outlined" style="font-size:28px">deselect</span>
                  <span class="xl-rbtn-lbl">Sin duplicados</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Herramientas de datos</div>
            </div>
          }

          <!-- ── VISTA ──────────────────────────────── -->
          @if (activeTab()==='vista') {

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <button class="xl-rbtn xl-rbtn-lg" title="Vista normal">
                  <span class="material-symbols-outlined" style="font-size:28px">grid_on</span>
                  <span class="xl-rbtn-lbl">Normal</span>
                </button>
                <button class="xl-rbtn xl-rbtn-lg" title="Vista previa de salto de página">
                  <span class="material-symbols-outlined" style="font-size:28px">preview</span>
                  <span class="xl-rbtn-lbl">Diseño de página</span>
                </button>
              </div>
              <div class="xl-rgroup-label">Vistas del libro</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content" style="flex-direction:column;gap:2px;justify-content:center;">
                <div class="xl-rrow">
                  <button class="xl-rbtn xl-rbtn-ic" [class.xl-tb-on]="showFormulasMode()" (click)="toggleShowFormulas()" title="Mostrar fórmulas">
                    <span class="material-symbols-outlined" style="font-size:14px">functions</span>
                  </button>
                  <span style="font-size:11px;color:#444">Mostrar fórmulas</span>
                </div>
              </div>
              <div class="xl-rgroup-label">Mostrar</div>
            </div>
            <div class="xl-rsep"></div>

            <div class="xl-rgroup">
              <div class="xl-rgroup-content">
                <div class="xl-zoom-controls">
                  <button class="xl-zoom-btn" (click)="zoomStep(-10)" [disabled]="zoom()<=30">−</button>
                  <span class="xl-zoom-pct">{{ zoom() }}%</span>
                  <button class="xl-zoom-btn" (click)="zoomStep(+10)" [disabled]="zoom()>=200">+</button>
                  <input type="range" min="30" max="200" step="10" [value]="zoom()" (input)="onZoomSlider($event)" class="xl-zoom-slider">
                </div>
              </div>
              <div class="xl-rgroup-label">Zoom</div>
            </div>
          }

        </div>
      </div>

      <!-- ── Formula bar ── -->
      <div class="xl-formula-bar">
        <div class="xl-name-box">{{ cellName() || '—' }}</div>
        <div class="xl-fx-label">
          <span class="material-symbols-outlined" style="font-size:14px;color:#1a73e8">functions</span>
        </div>
        <input #formulaInput
               class="xl-formula-input"
               [disabled]="readOnly"
               [(ngModel)]="formulaBarText"
               (focus)="formulaBarFocused=true"
               (keydown)="onFormulaKeydown($event)"
               (blur)="onFormulaBlur()"
               placeholder="Selecciona una celda — escribe valor o =FORMULA(...)">
        <div class="xl-zoom-controls">
          <button class="xl-zoom-btn" (click)="zoomStep(-10)" [disabled]="zoom()<=30">−</button>
          <span class="xl-zoom-pct">{{ zoom() }}%</span>
          <button class="xl-zoom-btn" (click)="zoomStep(+10)" [disabled]="zoom()>=200">+</button>
          <input type="range" min="30" max="200" step="10" [value]="zoom()" (input)="onZoomSlider($event)" class="xl-zoom-slider">
        </div>
      </div>

      <!-- ── Grid ── -->
      <div class="xl-grid-wrap" #gridWrap tabindex="0"
           (keydown)="onGridKeydown($event)"
           (mousemove)="onGridMouseMove($event)"
           (mouseup)="onGridMouseUp()"
           (mouseleave)="onGridMouseUp()"
           (click)="gridWrap.focus()">
        @if (cargando()) {
          <div class="xl-empty">
            <div class="xl-spinner"></div>
            Cargando planilla…
          </div>
        } @else if (!currentSheet()) {
          <div class="xl-empty">Sin datos</div>
        } @else {
          <div class="xl-grid-inner" [style.zoom]="zoom()/100">
            <table class="xl-table">

              <thead class="xl-thead">
                <tr>
                  <th class="xl-corner"
                      (contextmenu)="onCornerRightClick($event)"></th>
                  @for (col of colHeaders(); track $index; let ci = $index) {
                    <th class="xl-col-header"
                        [style.width.px]="colWidths()[ci]"
                        [style.min-width.px]="colWidths()[ci]"
                        [class.xl-col-hl]="isColInRange(ci)"
                        (contextmenu)="onColHeaderCtx($event, ci)">
                      <span class="xl-col-label">{{ col }}</span>
                      <span class="xl-resize-handle" (mousedown)="startResize($event, ci)"></span>
                    </th>
                  }
                </tr>
              </thead>

              <tbody>
                @for (row of currentSheet()!.rows; track $index; let ri = $index) {
                  <tr [class.xl-row-hl]="isRowInRange(ri)">
                    <td class="xl-row-num"
                        [class.xl-row-num-sel]="isRowInRange(ri)"
                        (contextmenu)="onRowNumCtx($event, ri)">{{ ri + 1 }}</td>
                    @for (cell of row; track $index; let ci = $index) {
                      <td class="xl-cell"
                          [attr.data-ri]="ri"
                          [attr.data-ci]="ci"
                          [class.xl-cell-sel]="isAnchorCell(ri, ci) && editRow()<0"
                          [class.xl-cell-range]="!isAnchorCell(ri, ci) && isInRange(ri, ci) && editRow()<0"
                          [class.xl-cell-edit]="editRow()===ri && editCol()===ci"
                          [class.xl-cell-ref]="refCell()?.row===ri && refCell()?.col===ci"
                          [style.width.px]="colWidths()[ci]"
                          [style.min-width.px]="colWidths()[ci]"
                          [style.font-weight]="cell.bold ? '700' : ''"
                          [style.font-style]="cell.italic ? 'italic' : ''"
                          [style.text-decoration]="(cell.underline ? 'underline ' : '') + (cell.strike ? 'line-through' : '')"
                          [style.font-family]="cell.font || ''"
                          [style.font-size.px]="cell.fontSize || null"
                          [style.color]="cell.color || ''"
                          [style.background-color]="cell.bg || ''"
                          [style.text-align]="cell.align || 'left'"
                          [style.vertical-align]="cell.valign || 'middle'"
                          (mousedown)="onCellMouseDown(ri, ci, $event)"
                          (click)="onCellClick(ri, ci, $event)"
                          (dblclick)="onCellDblClick(ri, ci)"
                          (contextmenu)="onCellCtx($event, ri, ci)"
                          [title]="(cell.f ?? cell.v)">
                        @if (editRow()===ri && editCol()===ci) {
                          <input #inlineInput
                                 class="xl-inline-input"
                                 [(ngModel)]="formulaBarText"
                                 (focus)="formulaBarFocused=false"
                                 (keydown)="onInlineKeydown($event, ri, ci)"
                                 (blur)="commitEdit()">
                        } @else {
                          {{ showFormulasMode() ? (cell.f ?? cell.v) : cell.v }}
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>

            </table>
          </div>
        }
      </div>

      <!-- ── Context menu ── -->
      @if (ctxMenu()) {
        <div class="xl-ctx-menu"
             [style.left.px]="ctxMenu()!.x"
             [style.top.px]="ctxMenu()!.y">
          <div class="xl-ctx-item" (click)="insertRowAboveAt(ctxMenu()!.row)">
            <span class="material-symbols-outlined">add</span> Insertar fila arriba
          </div>
          <div class="xl-ctx-item" (click)="insertRowBelowAt(ctxMenu()!.row)">
            <span class="material-symbols-outlined">add</span> Insertar fila abajo
          </div>
          <div class="xl-ctx-item xl-ctx-danger" (click)="deleteRowAt(ctxMenu()!.row)">
            <span class="material-symbols-outlined">remove</span> Eliminar fila {{ ctxMenu()!.row + 1 }}
          </div>
          <div class="xl-ctx-sep"></div>
          <div class="xl-ctx-item" (click)="insertColLeftAt(ctxMenu()!.col)">
            <span class="material-symbols-outlined">add</span> Insertar columna izquierda
          </div>
          <div class="xl-ctx-item" (click)="insertColRightAt(ctxMenu()!.col)">
            <span class="material-symbols-outlined">add</span> Insertar columna derecha
          </div>
          <div class="xl-ctx-item xl-ctx-danger" (click)="deleteColAt(ctxMenu()!.col)">
            <span class="material-symbols-outlined">remove</span> Eliminar columna {{ colLetter(ctxMenu()!.col) }}
          </div>
          <div class="xl-ctx-sep"></div>
          <div class="xl-ctx-item" (click)="clearCell()">
            <span class="material-symbols-outlined">backspace</span> Borrar contenido
          </div>
        </div>
      }

      <!-- ── Sheet tabs ── -->
      <div class="xl-tabbar">
        <div class="xl-tab-scroll">
          @for (sheet of sheets(); track $index; let i = $index) {
            <div class="xl-tab" [class.xl-tab-active]="activeIdx()===i" (click)="switchSheet(i)">
              <span class="material-symbols-outlined" style="font-size:13px;opacity:0.7">table</span>
              {{ sheet.name }}
            </div>
          }
        </div>
        <div class="xl-tab-right">
          <span class="xl-stat">
            {{ currentSheet()?.max_row ?? 0 }} filas × {{ currentSheet()?.max_col ?? 0 }} col
          </span>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }

    .xl-shell { display: flex; flex-direction: column; flex: 1; min-height: 0;
      font-family: Calibri, 'Segoe UI', Arial, sans-serif; background: #f0f0f0; position: relative; }

    /* ── Ribbon ─────────────────────────────────── */
    .xl-ribbon { flex-shrink: 0; }

    .xl-ribbon-tabs { display: flex; align-items: flex-end; background: #217346;
      padding: 0 8px; gap: 0; height: 28px; }
    .xl-rtab { height: 24px; padding: 0 14px; background: transparent; border: none;
      color: rgba(255,255,255,0.85); font-size: 12px; font-family: inherit;
      cursor: pointer; border-radius: 3px 3px 0 0; white-space: nowrap; }
    .xl-rtab:hover { background: rgba(255,255,255,0.18); color: #fff; }
    .xl-rtab.xl-rtab-active { background: #fff; color: #217346; font-weight: 600;
      height: 26px; }

    .xl-ribbon-body { display: flex; align-items: stretch; background: #fff;
      padding: 2px 4px 0; min-height: 86px; overflow-x: auto; flex-shrink: 0;
      border-top: 2px solid #217346; border-bottom: 1px solid #c8c8c8; }
    .xl-ribbon-body::-webkit-scrollbar { height: 4px; }
    .xl-ribbon-body::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 2px; }

    .xl-rgroup { display: flex; flex-direction: column; padding: 4px 6px 0;
      min-width: max-content; }
    .xl-rgroup-content { flex: 1; display: flex; align-items: flex-start; gap: 2px; }
    .xl-rgroup-label { text-align: center; font-size: 10px; color: #666;
      padding: 2px 0 2px; border-top: 1px solid #e4e4e4; margin-top: 2px; white-space: nowrap; }
    .xl-rsep { width: 1px; background: #d8d8d8; margin: 6px 3px 6px; flex-shrink: 0; }
    .xl-rsep-v { width: 1px; height: 20px; background: #d4d4d4; margin: 0 2px; flex-shrink: 0; align-self: center; }

    /* Ribbon buttons */
    .xl-rbtn { border: 1px solid transparent; background: transparent; cursor: pointer;
      border-radius: 3px; font-family: inherit; color: #1a1a1a; display: flex;
      align-items: center; justify-content: center; overflow: hidden; }
    .xl-rbtn:hover:not(:disabled) { background: #e3f0e8; border-color: #217346; }
    .xl-rbtn:disabled { opacity: 0.35; cursor: default; }
    .xl-rbtn.xl-tb-on { background: #c8e6d0; border-color: #217346; color: #1a5c2e; }
    .xl-rbtn.xl-danger { color: #c62828; }
    .xl-rbtn.xl-danger:hover:not(:disabled) { background: #fdecea; border-color: #c62828; }

    /* Large ribbon button: icon above + text below */
    .xl-rbtn-lg { flex-direction: column; gap: 2px; width: 58px; min-height: 68px;
      padding: 4px 2px 2px; font-size: 11px; flex-shrink: 0; }
    .xl-rbtn-lbl { font-size: 10px; text-align: center; white-space: normal;
      line-height: 1.2; width: 54px; overflow: hidden; }

    /* Small ribbon button: icon + text inline */
    .xl-rbtn-sm { flex-direction: row; gap: 4px; height: 22px; padding: 0 6px;
      font-size: 11px; white-space: nowrap; justify-content: flex-start; }
    .xl-rbtn-sm .material-symbols-outlined { font-size: 14px; flex-shrink: 0; }

    /* Icon-only tiny button */
    .xl-rbtn-ic { width: 26px; height: 26px; padding: 0; font-size: 13px; flex-shrink: 0; }
    .xl-rbtn-ic .material-symbols-outlined { font-size: 14px; }

    /* Column of small buttons */
    .xl-rbtn-sm-col { display: flex; flex-direction: column; justify-content: flex-start; gap: 1px; }

    /* Row helper */
    .xl-rrow { display: flex; align-items: center; gap: 2px; }

    /* Selects */
    .xl-font-sel { height: 22px; font-size: 11px; font-family: inherit; border: 1px solid #c8c8c8;
      border-radius: 3px; background: white; cursor: pointer; padding: 0 4px; min-width: 100px; }
    .xl-size-sel { height: 22px; font-size: 11px; font-family: inherit; border: 1px solid #c8c8c8;
      border-radius: 3px; background: white; cursor: pointer; padding: 0 4px; width: 48px; }
    .xl-numfmt-sel { height: 22px; font-size: 11px; font-family: inherit; border: 1px solid #c8c8c8;
      border-radius: 3px; background: white; cursor: pointer; padding: 0 4px; min-width: 110px; }

    /* Color picker wrapper */
    .xl-color-wrap { position: relative; overflow: hidden; cursor: pointer; }
    .xl-color-input { position: absolute; opacity: 0; width: 0; height: 0; top: 0; left: 0; }

    /* ── Formula bar ─────────────────────────────── */
    .xl-formula-bar { display: flex; align-items: center; height: 30px;
      background: white; border-bottom: 1px solid #d0d0d0; flex-shrink: 0; }
    .xl-name-box { width: 72px; border-right: 2px solid #c0c0c0; height: 100%;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 600; flex-shrink: 0; }
    .xl-fx-label { width: 34px; border-right: 1px solid #e0e0e0; height: 100%;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .xl-formula-input { flex: 1; padding: 0 8px; font-size: 12px; color: #1a1a1a;
      border: none; outline: none; background: transparent; }
    .xl-formula-input:focus { background: #f0f7ff; }
    .xl-zoom-controls { display: flex; align-items: center; gap: 5px; padding: 0 10px;
      flex-shrink: 0; border-left: 1px solid #e0e0e0; }
    .xl-zoom-btn { width: 22px; height: 22px; border: 1px solid #d0d0d0; background: white;
      border-radius: 3px; cursor: pointer; font-size: 15px; display: flex;
      align-items: center; justify-content: center; color: #444; }
    .xl-zoom-btn:hover:not(:disabled) { background: #f1f3f4; border-color: #1a73e8; color: #1a73e8; }
    .xl-zoom-btn:disabled { opacity: 0.35; cursor: default; }
    .xl-zoom-pct { font-size: 11px; color: #5f6368; min-width: 36px; text-align: center; }
    .xl-zoom-slider { width: 80px; accent-color: #1a73e8; cursor: pointer; }

    /* ── Grid ───────────────────────────────────── */
    .xl-grid-wrap { flex: 1; overflow: auto; min-height: 0; background: #e8e8e8; outline: none; }
    .xl-grid-inner { display: inline-block; min-width: 100%; }
    .xl-empty { display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 200px; gap: 12px; font-size: 14px; color: #888; }
    .xl-spinner { width: 28px; height: 28px; border: 3px solid #e0e0e0;
      border-top-color: #1a73e8; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .xl-table { border-collapse: collapse; table-layout: fixed; font-size: 12px; background: white; }

    .xl-thead { position: sticky; top: 0; z-index: 12; }
    .xl-corner { width: 52px; min-width: 52px; background: #f2f2f2;
      border: 1px solid #c0c0c0; position: sticky; left: 0; z-index: 13; cursor: pointer; }
    .xl-corner:hover { background: #e0e0e0; }

    .xl-col-header { background: #f2f2f2; border: 1px solid #c0c0c0; font-size: 11px;
      color: #595959; font-weight: 600; text-align: center; padding: 0;
      position: relative; user-select: none; white-space: nowrap; }
    .xl-col-header.xl-col-hl { background: #d6e8ce; color: #1d6c28; }
    .xl-col-label { display: block; padding: 4px 6px; }
    .xl-resize-handle { position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
      cursor: col-resize; z-index: 1; }
    .xl-resize-handle:hover { background: #1a73e8; }

    .xl-row-num { width: 52px; min-width: 52px; background: #f2f2f2; border: 1px solid #c0c0c0;
      text-align: center; font-size: 11px; color: #595959; padding: 2px 4px;
      position: sticky; left: 0; z-index: 5; user-select: none; cursor: pointer; }
    .xl-row-num:hover { background: #e0e0e0; }
    .xl-row-num-sel { background: #d6e8ce !important; color: #1d6c28; font-weight: 700; }

    .xl-cell { border: 1px solid #d0d0d0; padding: 0 6px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis; height: 21px; font-size: 12px; color: #1a1a1a;
      cursor: cell; vertical-align: middle; }
    .xl-cell:hover:not(.xl-cell-sel):not(.xl-cell-edit) { background-color: #f0f7ff !important; }
    .xl-cell-sel { background-color: #cce8ff !important; outline: 2px solid #1a73e8; outline-offset: -2px; position: relative; z-index: 1; }
    .xl-cell-range { background-color: #dbeeff !important; position: relative; z-index: 1; outline: 1px solid rgba(26,115,232,0.35); outline-offset: -1px; }
    .xl-cell-edit { background-color: white !important; outline: 2px solid #1a73e8; outline-offset: -2px; padding: 0; position: relative; z-index: 2; }
    .xl-cell-ref { outline: 2px dashed #1a73e8 !important; background-color: #e8f4ff !important; position: relative; z-index: 1; }
    .xl-row-hl .xl-cell:not(.xl-cell-sel):not(.xl-cell-edit):not(.xl-cell-range) { background-color: #ebf5e9 !important; }

    .xl-inline-input { width: 100%; height: 100%; border: none; outline: none; padding: 0 6px;
      font-size: 12px; font-family: inherit; background: transparent; color: #1a1a1a; }

    /* ── Context menu ───────────────────────────── */
    .xl-ctx-menu { position: fixed; z-index: 9999; background: white;
      border: 1px solid #e0e0e0; border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,0.18);
      min-width: 220px; overflow: hidden; }
    .xl-ctx-item { display: flex; align-items: center; gap: 8px; padding: 8px 14px;
      font-size: 13px; color: #333; cursor: pointer; user-select: none; }
    .xl-ctx-item .material-symbols-outlined { font-size: 16px; color: #666; }
    .xl-ctx-item:hover { background: #f1f3f4; }
    .xl-ctx-item.xl-ctx-danger { color: #c62828; }
    .xl-ctx-item.xl-ctx-danger .material-symbols-outlined { color: #c62828; }
    .xl-ctx-item.xl-ctx-danger:hover { background: #fdecea; }
    .xl-ctx-sep { height: 1px; background: #e0e0e0; margin: 3px 0; }

    /* ── Sheet tabs ─────────────────────────────── */
    .xl-tabbar { height: 33px; background: #d8d8d8; border-top: 1px solid #b8b8b8;
      flex-shrink: 0; display: flex; align-items: stretch; }
    .xl-tab-scroll { display: flex; align-items: flex-end; overflow-x: auto;
      gap: 2px; padding: 4px 4px 0; flex: 1; }
    .xl-tab-scroll::-webkit-scrollbar { height: 4px; }
    .xl-tab-scroll::-webkit-scrollbar-thumb { background: #b0b0b0; border-radius: 2px; }
    .xl-tab { padding: 0 14px; height: 25px; background: #b8b8b8; border: 1px solid #a0a0a0;
      border-bottom: none; border-radius: 4px 4px 0 0; font-size: 12px; color: #444;
      cursor: pointer; display: flex; align-items: center; gap: 5px;
      white-space: nowrap; user-select: none; flex-shrink: 0; }
    .xl-tab:hover:not(.xl-tab-active) { background: #ccc; }
    .xl-tab-active { background: white; color: #1a1a1a; font-weight: 600; border-color: #c0c0c0; }
    .xl-tab-right { display: flex; align-items: center; border-left: 1px solid #c0c0c0; }
    .xl-stat { font-size: 11px; color: #888; padding: 0 12px; }
  `]
})
export class SpreadsheetViewerComponent implements OnInit, OnDestroy {
  @Input() documentoKey = '';
  @Input() nombreDoc = '';
  /** Bloquea toda mutación de celdas/estructura (cliente sin permiso de edición) */
  @Input() readOnly = false;
  @Output() sheetsChange = new EventEmitter<SheetData[]>();

  private _applyingRemote = false;
  private _dataLoaded = false;

  @Input() set externalUpdate(val: SheetData[] | null) {
    if (!val || this._applyingRemote) return;
    this._applyingRemote = true;
    this.zone.run(() => {
      this.sheets.set(val.map(s => ({
        ...s,
        rows: s.rows.map(r => r.map(c => ({ ...c })))
      })));
      const idx = Math.min(this.activeIdx(), val.length - 1);
      if (val[idx]) this.colWidths.set([...val[idx].col_widths]);
      this.cdr.detectChanges();
    });
    setTimeout(() => { this._applyingRemote = false; });
  }

  @ViewChild('formulaInput') formulaInputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('gridWrap') gridWrapEl!: ElementRef<HTMLDivElement>;

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private destroy$ = new Subject<void>();

  sheets = signal<SheetData[]>([]);
  activeIdx = signal(0);
  cargando = signal(true);
  zoom = signal(100);
  selRow = signal(-1);
  selCol = signal(-1);
  selRowEnd = signal(-1);
  selColEnd = signal(-1);
  editRow = signal(-1);
  editCol = signal(-1);
  colWidths = signal<number[]>([]);
  ctxMenu = signal<CtxMenu | null>(null);

  formulaBarText = '';
  formulaBarFocused = false;
  refCell = signal<{ row: number; col: number } | null>(null);

  private isDragging = false;
  private dragAnchorRow = -1;
  private dragAnchorCol = -1;
  private wasDrag = false;
  private resizingCol: number | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;
  private boundMM: ((e: MouseEvent) => void) | null = null;
  private boundMU: (() => void) | null = null;

  currentSheet = computed(() => this.sheets()[this.activeIdx()] ?? null);

  colHeaders = computed(() => {
    const s = this.currentSheet();
    if (!s) return [];
    return Array.from({ length: s.max_col }, (_, i) => this.colLetter(i));
  });

  cellName = computed(() => {
    const r1 = this.selRow(), c1 = this.selCol();
    if (r1 < 0 || c1 < 0) return '';
    const r2 = this.selRowEnd(), c2 = this.selColEnd();
    if (r2 >= 0 && c2 >= 0 && (r2 !== r1 || c2 !== c1)) {
      const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
      const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
      return `${this.colLetter(minC)}${minR + 1}:${this.colLetter(maxC)}${maxR + 1}`;
    }
    return `${this.colLetter(c1)}${r1 + 1}`;
  });

  selCellBold = computed(() => {
    const s = this.currentSheet(); const r = this.selRow(); const c = this.selCol();
    return s?.rows[r]?.[c]?.bold ?? false;
  });
  selCellItalic = computed(() => {
    const s = this.currentSheet(); const r = this.selRow(); const c = this.selCol();
    return s?.rows[r]?.[c]?.italic ?? false;
  });
  selCellUnderline = computed(() => {
    const s = this.currentSheet(); const r = this.selRow(); const c = this.selCol();
    return s?.rows[r]?.[c]?.underline ?? false;
  });
  selCellAlign = computed(() => {
    const s = this.currentSheet(); const r = this.selRow(); const c = this.selCol();
    return s?.rows[r]?.[c]?.align ?? 'left';
  });
  selCellStrike = computed(() => {
    const s = this.currentSheet(); const r = this.selRow(); const c = this.selCol();
    return s?.rows[r]?.[c]?.strike ?? false;
  });

  isInRange(ri: number, ci: number): boolean {
    const r1 = this.selRow(), c1 = this.selCol();
    if (r1 < 0 || c1 < 0) return false;
    const r2 = this.selRowEnd(), c2 = this.selColEnd();
    if (r2 < 0 || c2 < 0) return ri === r1 && ci === c1;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    return ri >= minR && ri <= maxR && ci >= minC && ci <= maxC;
  }

  isAnchorCell(ri: number, ci: number): boolean {
    return ri === this.selRow() && ci === this.selCol();
  }

  isRowInRange(ri: number): boolean {
    const r1 = this.selRow(), r2 = this.selRowEnd();
    if (r1 < 0) return false;
    if (r2 < 0) return ri === r1;
    return ri >= Math.min(r1, r2) && ri <= Math.max(r1, r2);
  }

  isColInRange(ci: number): boolean {
    const c1 = this.selCol(), c2 = this.selColEnd();
    if (c1 < 0) return false;
    if (c2 < 0) return ci === c1;
    return ci >= Math.min(c1, c2) && ci <= Math.max(c1, c2);
  }

  activeTab = signal('inicio');
  showFormulasMode = signal(false);

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.http.get<{ sheets: SheetData[] }>(`/ai/documentos/excel-data/${this.documentoKey}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.zone.run(() => {
            const sheets = res.sheets ?? [];
            // Deep-copy so all cells are mutable objects
            this.sheets.set(sheets.map(s => ({
              ...s,
              rows: s.rows.map(r => r.map(c => ({ ...c })))
            })));
            this.activeIdx.set(0);
            if (sheets[0]) this.colWidths.set([...sheets[0].col_widths]);
            this.cargando.set(false);
            this._dataLoaded = true;
            this.cdr.detectChanges();
          });
        },
        error: () => {
          this.zone.run(() => { this.cargando.set(false); this.cdr.detectChanges(); });
        }
      });
  }

  // ── Cell selection & editing ───────────────────────────────────────────────

  onCellMouseDown(ri: number, ci: number, event: MouseEvent): void {
    if (this.formulaBarText.startsWith('=') && (this.formulaBarFocused || this.editRow() >= 0)) {
      event.preventDefault();
      this.insertCellRef(ri, ci);
      return;
    }
    // Start range selection drag
    this.refCell.set(null);
    this.dragAnchorRow = ri;
    this.dragAnchorCol = ci;
    this.isDragging = true;
    this.wasDrag = false;
    this.selRowEnd.set(-1);
    this.selColEnd.set(-1);
  }

  onGridMouseMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    const el = (event.target as HTMLElement).closest('[data-ri]') as HTMLElement | null;
    if (!el) return;
    const ri = parseInt(el.dataset['ri'] ?? '-1', 10);
    const ci = parseInt(el.dataset['ci'] ?? '-1', 10);
    if (ri < 0 || ci < 0) return;
    if (ri !== this.dragAnchorRow || ci !== this.dragAnchorCol) {
      this.wasDrag = true;
    }
    this.selRow.set(this.dragAnchorRow);
    this.selCol.set(this.dragAnchorCol);
    this.selRowEnd.set(ri === this.dragAnchorRow && ci === this.dragAnchorCol ? -1 : ri);
    this.selColEnd.set(ri === this.dragAnchorRow && ci === this.dragAnchorCol ? -1 : ci);
    event.preventDefault();
  }

  onGridMouseUp(): void {
    this.isDragging = false;
  }

  onCellClick(ri: number, ci: number, event: MouseEvent): void {
    event.stopPropagation();
    if (this.formulaBarText.startsWith('=') && (this.formulaBarFocused || this.editRow() >= 0)) return;
    // If this click was the end of a drag, don't reset to single-cell
    if (this.wasDrag) { this.wasDrag = false; return; }
    if (this.editRow() >= 0) this.commitEdit();
    this.editRow.set(-1); this.editCol.set(-1);
    this.refCell.set(null);
    this.selRow.set(ri); this.selCol.set(ci);
    this.selRowEnd.set(-1); this.selColEnd.set(-1);
    const cell = this.currentSheet()?.rows[ri]?.[ci];
    this.formulaBarText = cell?.f ?? cell?.v ?? '';
    this.ctxMenu.set(null);
  }

  onCellDblClick(ri: number, ci: number): void {
    if (this.readOnly) return;
    this.selRow.set(ri); this.selCol.set(ci);
    this.selRowEnd.set(-1); this.selColEnd.set(-1);
    this.editRow.set(ri); this.editCol.set(ci);
    const cell = this.currentSheet()?.rows[ri]?.[ci];
    this.formulaBarText = cell?.f ?? cell?.v ?? '';
    setTimeout(() => {
      const input = this.gridWrapEl?.nativeElement.querySelector('.xl-inline-input') as HTMLInputElement | null;
      if (input) { input.focus(); input.select(); }
    });
  }

  onFormulaKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') { this.commitEdit(); this.gridWrapEl?.nativeElement.focus(); }
    if (event.key === 'Escape') { this.cancelEdit(); this.gridWrapEl?.nativeElement.focus(); }
  }

  onFormulaBlur(): void {
    this.formulaBarFocused = false;
    // Delay: if blur was caused by mousedown on a cell (formula ref insert),
    // the cell's mousedown handler has already run — don't commit yet.
    setTimeout(() => {
      if (!this.formulaBarFocused && this.selRow() >= 0) {
        this.commitEdit();
        this.refCell.set(null);
      }
    }, 150);
  }

  onInlineKeydown(event: KeyboardEvent, _ri: number, _ci: number): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitEdit();
      this.editRow.set(-1); this.editCol.set(-1);
      this.moveSelection(1, 0);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      this.commitEdit();
      this.editRow.set(-1); this.editCol.set(-1);
      this.moveSelection(0, event.shiftKey ? -1 : 1);
    } else if (event.key === 'Escape') {
      this.cancelEdit();
      this.editRow.set(-1); this.editCol.set(-1);
      this.gridWrapEl?.nativeElement.focus();
    }
  }

  private insertCellRef(ri: number, ci: number): void {
    const ref = `${this.colLetter(ci)}${ri + 1}`;
    // Highlight the referenced cell with dashed border (like Excel)
    this.refCell.set({ row: ri, col: ci });

    // Find the active input (formula bar or inline input)
    const input: HTMLInputElement | null = this.formulaBarFocused
      ? this.formulaInputEl?.nativeElement
      : (this.gridWrapEl?.nativeElement.querySelector('.xl-inline-input') as HTMLInputElement | null);

    if (input) {
      const start = input.selectionStart ?? this.formulaBarText.length;
      const end = input.selectionEnd ?? start;
      this.formulaBarText =
        this.formulaBarText.slice(0, start) + ref + this.formulaBarText.slice(end);
      // Restore focus and position cursor after inserted ref
      setTimeout(() => {
        input.focus();
        const newPos = start + ref.length;
        input.setSelectionRange(newPos, newPos);
      });
    } else {
      this.formulaBarText += ref;
      // Re-focus formula bar
      setTimeout(() => this.formulaInputEl?.nativeElement.focus());
    }
  }

  commitEdit(): void {
    const ri = this.selRow(); const ci = this.selCol();
    if (ri < 0 || ci < 0) return;
    const rawVal = this.formulaBarText;
    let displayVal = rawVal;
    let formula: string | undefined;
    if (rawVal.startsWith('=')) {
      formula = rawVal;
      displayVal = this.evaluateFormula(rawVal);
    }
    this.refCell.set(null);
    this.updateCellProp(ri, ci, cell => ({ ...cell, v: displayVal, f: formula }));
  }

  cancelEdit(): void {
    const ri = this.selRow(); const ci = this.selCol();
    const cell = this.currentSheet()?.rows[ri]?.[ci];
    this.formulaBarText = cell?.f ?? cell?.v ?? '';
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  onGridKeydown(event: KeyboardEvent): void {
    if (this.editRow() >= 0) return; // inline edit handles keys
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT') return;

    switch (event.key) {
      case 'ArrowUp':    event.preventDefault(); this.moveSelection(-1, 0); break;
      case 'ArrowDown':  event.preventDefault(); this.moveSelection(1, 0); break;
      case 'ArrowLeft':  event.preventDefault(); this.moveSelection(0, -1); break;
      case 'ArrowRight': event.preventDefault(); this.moveSelection(0, 1); break;
      case 'Tab':        event.preventDefault(); this.moveSelection(0, event.shiftKey ? -1 : 1); break;
      case 'Enter':      event.preventDefault(); this.moveSelection(1, 0); break;
      case 'F2':
        event.preventDefault();
        if (this.selRow() >= 0) this.onCellDblClick(this.selRow(), this.selCol());
        break;
      case 'Delete': case 'Backspace':
        if (this.selRow() >= 0) {
          this.formulaBarText = '';
          this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, v: '', f: undefined }));
        }
        break;
      default:
        // Any printable character starts editing
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (this.selRow() >= 0) {
            this.formulaBarText = event.key;
            this.onCellDblClick(this.selRow(), this.selCol());
          }
        }
    }
  }

  private moveSelection(dRow: number, dCol: number): void {
    const sheet = this.currentSheet();
    if (!sheet) return;
    const maxR = sheet.max_row - 1;
    const maxC = sheet.max_col - 1;
    let r = Math.max(0, Math.min(maxR, (this.selRow() < 0 ? 0 : this.selRow()) + dRow));
    let c = Math.max(0, Math.min(maxC, (this.selCol() < 0 ? 0 : this.selCol()) + dCol));
    this.selRow.set(r); this.selCol.set(c);
    this.selRowEnd.set(-1); this.selColEnd.set(-1);
    const cell = sheet.rows[r]?.[c];
    this.formulaBarText = cell?.f ?? cell?.v ?? '';
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  toggleBold(): void      { this.toggleProp('bold'); }
  toggleItalic(): void    { this.toggleProp('italic'); }
  toggleUnderline(): void { this.toggleProp('underline'); }
  toggleStrike(): void    { this.toggleProp('strike'); }

  setAlign(dir: string): void {
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, align: dir }));
  }
  setValign(dir: string): void {
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, valign: dir }));
  }
  setTextColor(event: Event): void {
    const col = (event.target as HTMLInputElement).value;
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, color: col }));
  }
  setBgColor(event: Event): void {
    const col = (event.target as HTMLInputElement).value;
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, bg: col }));
  }
  setFontFamily(event: Event): void {
    const font = (event.target as HTMLSelectElement).value;
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, font }));
  }
  setFontSize(event: Event): void {
    const size = parseInt((event.target as HTMLSelectElement).value, 10);
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, fontSize: size }));
  }
  setNumFormat2(fmt: string): void {
    const ri = this.selRow(); const ci = this.selCol();
    const cell = this.currentSheet()?.rows[ri]?.[ci];
    if (!cell) return;
    let v = parseFloat(cell.v);
    if (isNaN(v)) return;
    let display = '';
    if (fmt === 'percent') display = (v * 100).toFixed(2) + '%';
    else if (fmt === 'currency') display = '$' + v.toLocaleString('es-BO', { minimumFractionDigits: 2 });
    else display = cell.v;
    this.updateCellProp(ri, ci, c => ({ ...c, v: display }));
  }

  autoSum(): void {
    if (this.readOnly) return;
    const ri = this.selRow(); const ci = this.selCol();
    if (ri < 0 || ci < 0) return;
    const sheet = this.currentSheet();
    if (!sheet) return;
    // Find contiguous numeric cells above
    let startRi = ri - 1;
    while (startRi >= 0) {
      const v = parseFloat(sheet.rows[startRi]?.[ci]?.v ?? '');
      if (isNaN(v)) break;
      startRi--;
    }
    startRi++;
    if (startRi >= ri) return;
    const colL = this.colLetter(ci);
    const formula = `=SUM(${colL}${startRi + 1}:${colL}${ri})`;
    this.formulaBarText = formula;
    this.commitEdit();
  }

  sortAZ(): void {
    if (this.readOnly) return;
    const ci = this.selCol();
    if (ci < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) => {
      if (si !== ai) return s;
      const sorted = [...s.rows].sort((a, b) => (a[ci]?.v ?? '').localeCompare(b[ci]?.v ?? ''));
      return { ...s, rows: sorted };
    }));
  }

  sortZA(): void {
    if (this.readOnly) return;
    const ci = this.selCol();
    if (ci < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) => {
      if (si !== ai) return s;
      const sorted = [...s.rows].sort((a, b) => (b[ci]?.v ?? '').localeCompare(a[ci]?.v ?? ''));
      return { ...s, rows: sorted };
    }));
  }

  toggleShowFormulas(): void { this.showFormulasMode.update(v => !v); }

  private toggleProp(prop: 'bold' | 'italic' | 'underline' | 'strike'): void {
    const cell = this.currentSheet()?.rows[this.selRow()]?.[this.selCol()];
    if (!cell) return;
    this.updateCellProp(this.selRow(), this.selCol(), c => ({ ...c, [prop]: !c[prop] }));
  }

  private updateCellProp(ri: number, ci: number, fn: (c: CellData) => CellData): void {
    if (this.readOnly) return;
    if (ri < 0 || ci < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) =>
      si !== ai ? s : {
        ...s,
        rows: s.rows.map((row, r) =>
          r !== ri ? row : row.map((cell, col) => col !== ci ? cell : fn(cell))
        )
      }
    ));
    this.emitSheets();
  }

  private emitSheets(): void {
    if (!this._applyingRemote && this._dataLoaded) {
      this.sheetsChange.emit(this.sheets());
    }
  }

  clearCell(): void {
    const ri = this.ctxMenu() ? this.ctxMenu()!.row : this.selRow();
    const ci = this.ctxMenu() ? this.ctxMenu()!.col : this.selCol();
    if (ri < 0 || ci < 0) return;
    this.updateCellProp(ri, ci, c => ({ ...c, v: '', f: undefined }));
    this.ctxMenu.set(null);
  }

  // ── Row / Column operations ────────────────────────────────────────────────

  insertRowAboveAt(ri: number): void {
    if (this.readOnly) return;
    if (ri < 0) return;
    const ai = this.activeIdx();
    const cols = this.currentSheet()?.max_col ?? 0;
    const empty: CellData[] = Array.from({ length: cols }, () => ({ v: '' }));
    this.sheets.update(sheets => sheets.map((s, si) =>
      si !== ai ? s : { ...s, rows: [...s.rows.slice(0, ri), empty, ...s.rows.slice(ri)], max_row: s.max_row + 1 }
    ));
    this.ctxMenu.set(null);
    this.emitSheets();
  }

  insertRowBelowAt(ri: number): void {
    this.insertRowAboveAt(ri + 1);
  }

  deleteRowAt(ri: number): void {
    if (this.readOnly) return;
    if (ri < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) =>
      si !== ai ? s : { ...s, rows: s.rows.filter((_, i) => i !== ri), max_row: Math.max(0, s.max_row - 1) }
    ));
    if (this.selRow() === ri) { this.selRow.set(-1); this.selCol.set(-1); }
    this.ctxMenu.set(null);
    this.emitSheets();
  }

  insertColLeftAt(ci: number): void {
    if (this.readOnly) return;
    if (ci < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) =>
      si !== ai ? s : {
        ...s,
        rows: s.rows.map(row => [...row.slice(0, ci), { v: '' }, ...row.slice(ci)]),
        col_widths: [...s.col_widths.slice(0, ci), 80, ...s.col_widths.slice(ci)],
        max_col: s.max_col + 1
      }
    ));
    this.colWidths.update(ws => [...ws.slice(0, ci), 80, ...ws.slice(ci)]);
    this.ctxMenu.set(null);
    this.emitSheets();
  }

  insertColRightAt(ci: number): void {
    this.insertColLeftAt(ci + 1);
  }

  deleteColAt(ci: number): void {
    if (this.readOnly) return;
    if (ci < 0) return;
    const ai = this.activeIdx();
    this.sheets.update(sheets => sheets.map((s, si) =>
      si !== ai ? s : {
        ...s,
        rows: s.rows.map(row => row.filter((_, i) => i !== ci)),
        col_widths: s.col_widths.filter((_, i) => i !== ci),
        max_col: Math.max(0, s.max_col - 1)
      }
    ));
    this.colWidths.update(ws => ws.filter((_, i) => i !== ci));
    if (this.selCol() === ci) { this.selRow.set(-1); this.selCol.set(-1); }
    this.ctxMenu.set(null);
    this.emitSheets();
  }

  // ── Formula evaluation ─────────────────────────────────────────────────────

  private evaluateFormula(formula: string): string {
    try {
      const expr = formula.slice(1).trim().toUpperCase();
      const sheet = this.currentSheet();
      if (!sheet) return '#REF!';

      // ── Helper: replace cell refs with their numeric values ──────────
      const resolveCellRefs = (s: string): string =>
        s.replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
          const ci = this.colIndex(col);
          const ri = parseInt(row, 10) - 1;
          const rawCell = sheet.rows[ri]?.[ci];
          // Recursively evaluate if cell itself has a formula
          let val = rawCell?.f ? this.evaluateFormula(rawCell.f) : rawCell?.v ?? '0';
          const n = parseFloat(val);
          return isNaN(n) ? '0' : String(n);
        });

      const evalArith = (s: string): string | null => {
        const resolved = resolveCellRefs(s);
        if (/^[0-9+\-*/.() ]+$/.test(resolved)) {
          // eslint-disable-next-line no-new-func
          const r = (new Function(`"use strict"; return (${resolved})`))() as number;
          return this.fmt(r);
        }
        return null;
      };

      // ── Function call pattern: FUNC(inner) ───────────────────────────
      const funcM = expr.match(/^(SUM|SUMA|AVERAGE|PROMEDIO|COUNT|CONTAR|CONTARA|MAX|MAXIMO|MIN|MINIMO)\((.+)\)$/);
      if (funcM) {
        const [, fn, args] = funcM;

        // Case 1: Single arithmetic expression inside function e.g., SUMA(C6+D6*2)
        if (!args.includes(',') && /[+\-*/]/.test(args)) {
          const arith = evalArith(args.trim());
          if (arith !== null) return arith;
        }

        // Case 2: Range / comma-separated cells (standard behavior)
        const nums = this.resolveRangeNums(args.trim(), sheet.rows);
        if (!nums.length) return '0';
        switch (fn) {
          case 'SUM': case 'SUMA':
            return this.fmt(nums.reduce((a, b) => a + b, 0));
          case 'AVERAGE': case 'PROMEDIO':
            return this.fmt(nums.reduce((a, b) => a + b, 0) / nums.length);
          case 'COUNT': case 'CONTAR': case 'CONTARA':
            return String(nums.length);
          case 'MAX': case 'MAXIMO':
            return this.fmt(Math.max(...nums));
          case 'MIN': case 'MINIMO':
            return this.fmt(Math.min(...nums));
        }
      }

      // ── Nested IF: =SI(cond, val_true, val_false) ────────────────────
      const ifM = expr.match(/^SI\((.+),(.+),(.+)\)$/) || expr.match(/^IF\((.+),(.+),(.+)\)$/);
      if (ifM) {
        const cond = evalArith(ifM[1].trim());
        return (cond !== null && parseFloat(cond) !== 0)
          ? (evalArith(ifM[2].trim()) ?? ifM[2].trim())
          : (evalArith(ifM[3].trim()) ?? ifM[3].trim());
      }

      // ── Simple arithmetic / cell refs: =A1+B1*2 ─────────────────────
      const arith = evalArith(expr);
      if (arith !== null) return arith;

      return '#ERROR!';
    } catch {
      return '#ERROR!';
    }
  }

  private resolveRangeNums(rangeStr: string, rows: CellData[][]): number[] {
    // Split by comma first (handles multiple args / ranges)
    const parts = rangeStr.split(',');
    const result: number[] = [];

    for (const part of parts) {
      const p = part.trim();

      // Range: A1:B5
      const rangeM = p.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
      if (rangeM) {
        const [, c1, r1, c2, r2] = rangeM;
        const ci1 = this.colIndex(c1), ri1 = parseInt(r1, 10) - 1;
        const ci2 = this.colIndex(c2), ri2 = parseInt(r2, 10) - 1;
        for (let ri = ri1; ri <= ri2; ri++)
          for (let ci = ci1; ci <= ci2; ci++) {
            const v = parseFloat(rows[ri]?.[ci]?.v ?? '');
            if (!isNaN(v)) result.push(v);
          }
        continue;
      }

      // Single cell: A1
      const cellM = p.match(/^([A-Z]+)(\d+)$/);
      if (cellM) {
        const v = parseFloat(rows[parseInt(cellM[2], 10) - 1]?.[this.colIndex(cellM[1])]?.v ?? '');
        if (!isNaN(v)) result.push(v);
        continue;
      }

      // Literal number
      const n = parseFloat(p);
      if (!isNaN(n)) result.push(n);
    }

    return result;
  }

  private fmt(n: number): string {
    if (!isFinite(n)) return '#NUM!';
    return `${parseFloat(n.toFixed(10))}`;
  }

  private colIndex(colStr: string): number {
    let idx = 0;
    for (let i = 0; i < colStr.length; i++) idx = idx * 26 + (colStr.charCodeAt(i) - 64);
    return idx - 1;
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  onCellCtx(event: MouseEvent, ri: number, ci: number): void {
    event.preventDefault();
    this.selRow.set(ri); this.selCol.set(ci);
    this.ctxMenu.set({ x: event.clientX, y: event.clientY, row: ri, col: ci });
  }

  onRowNumCtx(event: MouseEvent, ri: number): void {
    event.preventDefault();
    this.selRow.set(ri);
    this.ctxMenu.set({ x: event.clientX, y: event.clientY, row: ri, col: this.selCol() < 0 ? 0 : this.selCol() });
  }

  onColHeaderCtx(event: MouseEvent, ci: number): void {
    event.preventDefault();
    this.selCol.set(ci);
    this.ctxMenu.set({ x: event.clientX, y: event.clientY, row: this.selRow() < 0 ? 0 : this.selRow(), col: ci });
  }

  onCornerRightClick(event: MouseEvent): void { event.preventDefault(); }

  closeCtxOnOutside(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.xl-ctx-menu')) this.ctxMenu.set(null);
  }

  // ── Sheet switching ───────────────────────────────────────────────────────

  switchSheet(idx: number): void {
    if (this.editRow() >= 0) this.commitEdit();
    this.activeIdx.set(idx);
    const sheet = this.sheets()[idx];
    if (sheet) this.colWidths.set([...sheet.col_widths]);
    this.selRow.set(-1); this.selCol.set(-1);
    this.selRowEnd.set(-1); this.selColEnd.set(-1);
    this.editRow.set(-1); this.editCol.set(-1);
    this.formulaBarText = '';
  }

  // ── Zoom ─────────────────────────────────────────────────────────────────

  zoomStep(delta: number): void { this.zoom.update(z => Math.max(30, Math.min(200, z + delta))); }
  onZoomSlider(event: Event): void { this.zoom.set(parseInt((event.target as HTMLInputElement).value)); }

  // ── Column resize ─────────────────────────────────────────────────────────

  startResize(event: MouseEvent, ci: number): void {
    event.preventDefault();
    this.resizingCol = ci;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.colWidths()[ci] ?? 80;

    this.boundMM = (e: MouseEvent) => {
      if (this.resizingCol === null) return;
      const newW = Math.max(28, this.resizeStartWidth + (e.clientX - this.resizeStartX));
      this.zone.run(() => this.colWidths.update(ws => {
        const c = [...ws]; c[this.resizingCol!] = newW; return c;
      }));
    };
    this.boundMU = () => {
      this.resizingCol = null;
      if (this.boundMM) document.removeEventListener('mousemove', this.boundMM);
      if (this.boundMU) document.removeEventListener('mouseup', this.boundMU);
    };
    document.addEventListener('mousemove', this.boundMM);
    document.addEventListener('mouseup', this.boundMU);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  colLetter(i: number): string {
    let s = '';
    while (i >= 0) { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; }
    return s;
  }

  ngOnDestroy(): void {
    if (this.boundMM) document.removeEventListener('mousemove', this.boundMM);
    if (this.boundMU) document.removeEventListener('mouseup', this.boundMU);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
