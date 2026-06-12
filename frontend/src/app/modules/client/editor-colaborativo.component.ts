import {
  Component, OnInit, OnDestroy, Input, Output, EventEmitter,
  inject, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, debounceTime } from 'rxjs';
import { SpreadsheetViewerComponent } from './spreadsheet-viewer.component';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { Image } from '@tiptap/extension-image';

const TableCellStyled = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('style'), renderHTML: (attrs: Record<string, any>) => attrs['style'] ? { style: attrs['style'] } : {} }
    };
  }
});
const TableHeaderStyled = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      style: { default: null, parseHTML: (el: HTMLElement) => el.getAttribute('style'), renderHTML: (attrs: Record<string, any>) => attrs['style'] ? { style: attrs['style'] } : {} }
    };
  }
});
import Placeholder from '@tiptap/extension-placeholder';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { NotificacionService } from '../../core/services/notificacion.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-editor-colaborativo',
  standalone: true,
  imports: [CommonModule, FormsModule, SpreadsheetViewerComponent],
  template: `
    <div class="gdoc-wrapper">

      <!-- Topbar -->
      <div class="gdoc-topbar">
        <div class="gdoc-file-info">
          <div class="gdoc-icon">
            <span class="material-symbols-outlined" style="font-size:28px;color:#4285f4">
              {{ esExcel() ? 'table_chart' : esImagen() ? 'image' : 'description' }}
            </span>
          </div>
          <div>
            <div class="gdoc-filename">{{ nombreDoc }}</div>
            <div class="gdoc-status">
              @if (guardando) { <span class="status-saving">Guardando...</span> }
              @else if (ultimaGuarda) { <span class="status-saved">&#10003; Guardado en NexusFlow</span> }
              @else { <span class="status-idle">NexusFlow Docs</span> }
              <small style="color:#bbb;margin-left:4px">[{{ docIdDebug }}]</small>
            </div>
          </div>
        </div>
        <div class="gdoc-users">
          @if (sincronizado) {
            <span class="badge-connected">&#9679; En linea</span>
          } @else {
            <span class="badge-offline">&#9679; Sin conexion</span>
          }
          @for (u of usuariosConectados; track u.id) {
            <div class="user-chip" [style.background]="u.color" [title]="u.nombre">
              <span class="user-initial">{{ u.nombre[0]?.toUpperCase() ?? '?' }}</span>
              <span class="user-name-label">{{ u.nombre.split(' ')[0] }}</span>
            </div>
          }
          <div class="user-chip self" [style.background]="miColor" [title]="miNombre">
            <span class="user-initial">{{ miNombre[0]?.toUpperCase() ?? '?' }}</span>
            <span class="user-name-label">{{ miNombre.split(' ')[0] }}</span>
          </div>
          <button class="notif-btn" (click)="solicitarEdicion()"
            [title]="esCliente
              ? 'Notificar al funcionario para que entre a revisar este documento'
              : (destinoSolicitud === 'funcionarios'
                  ? 'Notificar al funcionario del nodo anterior para revisar juntos este documento'
                  : 'Notificar al cliente que debe corregir el documento (le habilita la edición)')">
            <span class="material-symbols-outlined" style="font-size:16px">edit_notifications</span>
            {{ esCliente ? 'Solicitar revisión' : (destinoSolicitud === 'funcionarios' ? 'Solicitar revisión' : 'Solicitar corrección') }}
          </button>
          @if (!esCliente) {
            <button class="notif-btn ia-toggle-btn" [class.ia-on]="iaPanelAbierto" (click)="toggleIaPanel()"
              title="Asistente IA: analiza el trámite, la política/flujo y el documento para ayudar a resolver observaciones">
              <span class="material-symbols-outlined" style="font-size:16px">smart_toy</span>
              Asistente IA
            </button>
          }
        </div>
      </div>

      <!-- Banner modo visualización (cliente sin permiso de edición) -->
      @if (soloLectura) {
        <div class="readonly-banner">
          <span class="material-symbols-outlined" style="font-size:16px">visibility</span>
          Modo visualización — podrás editar cuando el funcionario te envíe una solicitud de corrección
        </div>
      }

      <!-- Panel Asistente IA (revisión entre funcionarios) -->
      @if (iaPanelAbierto) {
        <div class="ia-colab-panel">
          <div class="ia-colab-header">
            <span class="material-symbols-outlined" style="font-size:18px">smart_toy</span>
            <span class="ia-colab-title">Asistente de revisión</span>
            <button class="ia-colab-close" (click)="iaPanelAbierto = false">
              <span class="material-symbols-outlined" style="font-size:18px">close</span>
            </button>
          </div>
          <div class="ia-colab-body">
            @if (iaMensajes.length === 0) {
              <div class="ia-colab-intro">
                🤖 Conozco el <b>trámite</b> (datos de la BD), la <b>política/flujo</b> y este <b>documento</b>.
                <br><br>Pregúntame, por ejemplo:
                <ul>
                  <li>"¿Los datos del documento coinciden con el trámite?"</li>
                  <li>"¿Qué falta para aprobar este nodo?"</li>
                  <li>"¿Qué unidad debe corregir esto?"</li>
                </ul>
              </div>
            }
            @for (m of iaMensajes; track $index) {
              <div class="ia-colab-msg" [class.ia-colab-msg-user]="m.rol === 'user'">
                {{ m.texto }}
              </div>
            }
            @if (iaCargando) {
              <div class="ia-colab-msg ia-colab-typing">Analizando trámite y documento…</div>
            }
          </div>
          <div class="ia-colab-footer">
            <input class="ia-colab-input" [(ngModel)]="iaInput"
              (keydown.enter)="enviarIa()"
              placeholder="Pregunta sobre el trámite o el documento…">
            <button class="ia-colab-send" (click)="enviarIa()" [disabled]="iaCargando || !iaInput.trim()">
              <span class="material-symbols-outlined" style="font-size:18px">send</span>
            </button>
          </div>
        </div>
      }

      @if (esExcel()) {
        <!-- ═══ MODO PLANILLA Excel ═══ -->
        <div #excelWrap class="excel-collab-wrap" (mousemove)="onMouseMove($event)">
          <app-spreadsheet-viewer
            [documentoKey]="documentoKey"
            [nombreDoc]="nombreDoc"
            [readOnly]="soloLectura"
            [externalUpdate]="remoteExcelSheets"
            (sheetsChange)="onExcelSheetsChanged($event)"
            style="flex:1;min-height:0;display:flex;flex-direction:column;">
          </app-spreadsheet-viewer>
          <!-- Overlay cursores remotos (igual que documento) -->
          <div #cursorOverlayExcel class="cursor-overlay"></div>
        </div>
      } @else {
        <!-- ═══ MODO DOCUMENTO TipTap ═══ -->

        <!-- ── Word Ribbon ── -->
        <div class="wd-ribbon">
          <!-- Tab bar -->
          <div class="wd-ribbon-tabs">
            <button class="wd-rtab" [class.wd-rtab-active]="docTab==='inicio'"   (click)="docTab='inicio'">Inicio</button>
            <button class="wd-rtab" [class.wd-rtab-active]="docTab==='insertar'" (click)="docTab='insertar'">Insertar</button>
            <button class="wd-rtab" [class.wd-rtab-active]="docTab==='formato'"  (click)="docTab='formato'">Formato</button>
            <button class="wd-rtab" [class.wd-rtab-active]="docTab==='vista'"    (click)="docTab='vista'">Vista</button>
          </div>

          <!-- Ribbon body -->
          <div class="wd-ribbon-body">

            <!-- ── INICIO ── -->
            @if (docTab==='inicio') {

              <!-- Portapapeles -->
              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Pegar (Ctrl+V)">
                    <span class="material-symbols-outlined" style="font-size:28px">content_paste</span>
                    <span class="wd-rbtn-lbl">Pegar</span>
                  </button>
                  <div class="wd-rbtn-sm-col">
                    <button class="wd-rbtn wd-rbtn-sm" title="Cortar (Ctrl+X)">
                      <span class="material-symbols-outlined">content_cut</span> Cortar
                    </button>
                    <button class="wd-rbtn wd-rbtn-sm" title="Copiar (Ctrl+C)">
                      <span class="material-symbols-outlined">content_copy</span> Copiar
                    </button>
                    <button class="wd-rbtn wd-rbtn-sm" title="Copiar formato">
                      <span class="material-symbols-outlined">format_paint</span> Copiar formato
                    </button>
                  </div>
                </div>
                <div class="wd-rgroup-label">Portapapeles</div>
              </div>
              <div class="wd-rsep"></div>

              <!-- Fuente -->
              <div class="wd-rgroup">
                <div class="wd-rgroup-content" style="flex-direction:column;gap:3px;">
                  <div class="wd-rrow">
                    <select class="wd-font-sel" title="Fuente">
                      <option>Calibri</option><option>Arial</option>
                      <option>Times New Roman</option><option>Georgia</option>
                      <option>Verdana</option><option>Courier New</option>
                    </select>
                    <select class="wd-size-sel" (change)="setFontSize($event)" title="Tamaño">
                      <option>8</option><option>9</option><option>10</option><option>11</option>
                      <option selected>12</option><option>14</option><option>16</option>
                      <option>18</option><option>20</option><option>24</option>
                      <option>28</option><option>36</option>
                    </select>
                  </div>
                  <div class="wd-rrow">
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('bold')"      (click)="cmd('toggleBold')"    title="Negrita"><strong>B</strong></button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('italic')"    (click)="cmd('toggleItalic')"  title="Cursiva"><em>I</em></button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('underline')" (click)="cmd('toggleUnderline')" title="Subrayado"><u>U</u></button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('strike')"    (click)="cmd('toggleStrike')"  title="Tachado"><s>S</s></button>
                    <div class="wd-rsep-v"></div>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('highlight')" (click)="cmd('toggleHighlight')" title="Resaltar texto">
                      <span class="material-symbols-outlined" style="font-size:14px">ink_highlighter</span>
                    </button>
                    <label class="wd-rbtn wd-rbtn-ic wd-color-wrap" title="Color de texto">
                      <span class="material-symbols-outlined" style="font-size:14px">format_color_text</span>
                      <input type="color" (change)="setColor($event)" value="#000000" class="wd-color-input">
                    </label>
                    <label class="wd-rbtn wd-rbtn-ic wd-color-wrap" title="Color de resaltado">
                      <span class="material-symbols-outlined" style="font-size:14px">format_color_fill</span>
                      <input type="color" (change)="setHighlightColor($event)" value="#FFFF00" class="wd-color-input">
                    </label>
                  </div>
                </div>
                <div class="wd-rgroup-label">Fuente</div>
              </div>
              <div class="wd-rsep"></div>

              <!-- Párrafo -->
              <div class="wd-rgroup">
                <div class="wd-rgroup-content" style="flex-direction:column;gap:3px;">
                  <div class="wd-rrow">
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive({ textAlign: 'left' })"    (click)="align('left')"    title="Alinear izquierda">
                      <span class="material-symbols-outlined" style="font-size:14px">format_align_left</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive({ textAlign: 'center' })"  (click)="align('center')"  title="Centrar">
                      <span class="material-symbols-outlined" style="font-size:14px">format_align_center</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive({ textAlign: 'right' })"   (click)="align('right')"   title="Alinear derecha">
                      <span class="material-symbols-outlined" style="font-size:14px">format_align_right</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive({ textAlign: 'justify' })" (click)="align('justify')" title="Justificar">
                      <span class="material-symbols-outlined" style="font-size:14px">format_align_justify</span>
                    </button>
                    <div class="wd-rsep-v"></div>
                    <button class="wd-rbtn wd-rbtn-ic" title="Interlineado">
                      <span class="material-symbols-outlined" style="font-size:14px">line_weight</span>
                    </button>
                  </div>
                  <div class="wd-rrow">
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('bulletList')"   (click)="cmd('toggleBulletList')"   title="Lista con viñetas">
                      <span class="material-symbols-outlined" style="font-size:14px">format_list_bulleted</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('orderedList')"  (click)="cmd('toggleOrderedList')"  title="Lista numerada">
                      <span class="material-symbols-outlined" style="font-size:14px">format_list_numbered</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" [class.wd-active]="editor?.isActive('blockquote')"   (click)="cmd('toggleBlockquote')"   title="Cita">
                      <span class="material-symbols-outlined" style="font-size:14px">format_quote</span>
                    </button>
                    <div class="wd-rsep-v"></div>
                    <button class="wd-rbtn wd-rbtn-ic" title="Aumentar sangría">
                      <span class="material-symbols-outlined" style="font-size:14px">format_indent_increase</span>
                    </button>
                    <button class="wd-rbtn wd-rbtn-ic" title="Disminuir sangría">
                      <span class="material-symbols-outlined" style="font-size:14px">format_indent_decrease</span>
                    </button>
                  </div>
                </div>
                <div class="wd-rgroup-label">Párrafo</div>
              </div>
              <div class="wd-rsep"></div>

              <!-- Estilos -->
              <div class="wd-rgroup">
                <div class="wd-rgroup-content" style="flex-direction:column;gap:2px;justify-content:center;">
                  <select class="wd-font-sel" style="min-width:130px" (change)="setHeading($event)" title="Estilo de párrafo">
                    <option value="0">Texto normal</option>
                    <option value="1">Título 1</option>
                    <option value="2">Título 2</option>
                    <option value="3">Título 3</option>
                  </select>
                  <div class="wd-rrow" style="gap:2px;">
                    <button class="wd-rbtn wd-rbtn-sm" [class.wd-active]="isHeadingLevel(1)" (click)="toggleHeadingLevel(1)" style="font-weight:700;font-size:12px">H1</button>
                    <button class="wd-rbtn wd-rbtn-sm" [class.wd-active]="isHeadingLevel(2)" (click)="toggleHeadingLevel(2)" style="font-weight:700;font-size:11px">H2</button>
                    <button class="wd-rbtn wd-rbtn-sm" [class.wd-active]="isHeadingLevel(3)" (click)="toggleHeadingLevel(3)" style="font-weight:700;font-size:10px">H3</button>
                    <button class="wd-rbtn wd-rbtn-sm" (click)="clearHeading()" style="font-size:11px">¶</button>
                  </div>
                </div>
                <div class="wd-rgroup-label">Estilos</div>
              </div>
              <div class="wd-rsep"></div>

              <!-- Edición -->
              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" (click)="cmd('undo')" title="Deshacer (Ctrl+Z)">
                    <span class="material-symbols-outlined" style="font-size:28px">undo</span>
                    <span class="wd-rbtn-lbl">Deshacer</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" (click)="cmd('redo')" title="Rehacer (Ctrl+Y)">
                    <span class="material-symbols-outlined" style="font-size:28px">redo</span>
                    <span class="wd-rbtn-lbl">Rehacer</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Edición</div>
              </div>
              <div class="wd-rsep"></div>

              <div style="flex:1"></div>
              <div class="wd-word-count">{{ palabras }} palabras</div>
            }

            <!-- ── INSERTAR ── -->
            @if (docTab==='insertar') {

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" (click)="insertarTabla()" title="Insertar tabla">
                    <span class="material-symbols-outlined" style="font-size:28px">table</span>
                    <span class="wd-rbtn-lbl">Tabla</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Tablas</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Imagen">
                    <span class="material-symbols-outlined" style="font-size:28px">image</span>
                    <span class="wd-rbtn-lbl">Imagen</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" title="Formas">
                    <span class="material-symbols-outlined" style="font-size:28px">category</span>
                    <span class="wd-rbtn-lbl">Formas</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Ilustraciones</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Cuadro de texto">
                    <span class="material-symbols-outlined" style="font-size:28px">text_fields</span>
                    <span class="wd-rbtn-lbl">Cuadro de texto</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" title="Encabezado y pie de página">
                    <span class="material-symbols-outlined" style="font-size:28px">article</span>
                    <span class="wd-rbtn-lbl">Encab. y pie</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Texto</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Comentario">
                    <span class="material-symbols-outlined" style="font-size:28px">add_comment</span>
                    <span class="wd-rbtn-lbl">Comentario</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Comentarios</div>
              </div>
            }

            <!-- ── FORMATO ── -->
            @if (docTab==='formato') {

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Mayúsculas">
                    <span class="material-symbols-outlined" style="font-size:28px">text_fields</span>
                    <span class="wd-rbtn-lbl">Mayúsculas/Min.</span>
                  </button>
                  <div class="wd-rbtn-sm-col">
                    <button class="wd-rbtn wd-rbtn-sm" title="Todo en mayúsculas" style="font-weight:700;font-size:11px">ABCD</button>
                    <button class="wd-rbtn wd-rbtn-sm" title="Todo en minúsculas" style="font-size:11px">abcd</button>
                    <button class="wd-rbtn wd-rbtn-sm" title="Primera letra mayúscula">Abcd</button>
                  </div>
                </div>
                <div class="wd-rgroup-label">Texto</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" [class.wd-active]="editor?.isActive('code')" (click)="cmd('toggleCode')" title="Código en línea">
                    <span class="material-symbols-outlined" style="font-size:28px">code</span>
                    <span class="wd-rbtn-lbl">Código</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" [class.wd-active]="editor?.isActive('codeBlock')" (click)="cmd('toggleCodeBlock')" title="Bloque de código">
                    <span class="material-symbols-outlined" style="font-size:28px">terminal</span>
                    <span class="wd-rbtn-lbl">Bloque código</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Código</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Borde de párrafo">
                    <span class="material-symbols-outlined" style="font-size:28px">border_all</span>
                    <span class="wd-rbtn-lbl">Bordes</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" title="Sombreado de párrafo">
                    <span class="material-symbols-outlined" style="font-size:28px">format_paint</span>
                    <span class="wd-rbtn-lbl">Sombreado</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Fondo de párrafo</div>
              </div>
            }

            <!-- ── VISTA ── -->
            @if (docTab==='vista') {

              <div class="wd-rgroup">
                <div class="wd-rgroup-content">
                  <button class="wd-rbtn wd-rbtn-lg" title="Vista de lectura">
                    <span class="material-symbols-outlined" style="font-size:28px">chrome_reader_mode</span>
                    <span class="wd-rbtn-lbl">Lectura</span>
                  </button>
                  <button class="wd-rbtn wd-rbtn-lg" title="Diseño de impresión">
                    <span class="material-symbols-outlined" style="font-size:28px">description</span>
                    <span class="wd-rbtn-lbl">Diseño de impresión</span>
                  </button>
                </div>
                <div class="wd-rgroup-label">Vistas</div>
              </div>
              <div class="wd-rsep"></div>

              <div class="wd-rgroup">
                <div class="wd-rgroup-content" style="flex-direction:column;justify-content:center;gap:4px;">
                  <div class="wd-rrow" style="font-size:11px;color:#555;">
                    <span class="material-symbols-outlined" style="font-size:16px;color:#2B579A">article</span>
                    &nbsp;{{ palabras }} palabras
                  </div>
                  <div class="wd-rrow" style="font-size:11px;color:#888;">
                    @if (sincronizado) { <span style="color:#188038">&#9679; En línea</span> }
                    @else { <span style="color:#f59e0b">&#9679; Sin conexión</span> }
                  </div>
                </div>
                <div class="wd-rgroup-label">Estadísticas</div>
              </div>
            }

          </div>
        </div>

        <!-- Regla horizontal -->
        <div class="gdoc-ruler-wrap">
          <div class="gdoc-ruler-corner"></div>
          <div class="gdoc-ruler-h" #rulerH></div>
        </div>

        <!-- Página documento -->
        <div class="gdoc-page-bg" #pageBg (mousemove)="onMouseMove($event)">
          <div class="gdoc-page" #gdocPage [style.zoom]="zoomLevel() / 100">
            @for (sep of pageBreaks; track sep) {
              <div class="page-sep" [style.top.px]="sep"></div>
            }
            <div #cursorOverlay class="cursor-overlay"></div>
            <div #editorEl class="gdoc-content"></div>
          </div>
        </div>

        <!-- Footer -->
        <div class="gdoc-footer">
          <span>
            @if (ultimoEditorActivo && ultimoEditorActivo !== miNombre) {
              <span class="editing-indicator">{{ ultimoEditorActivo }} está editando...</span>
            }
          </span>
          <div class="zoom-bar">
            <button class="zoom-btn" (click)="setZoom(zoomLevel() - 10)" title="Reducir zoom">−</button>
            <input type="range" class="zoom-slider" min="50" max="200" step="10"
                   [value]="zoomLevel()" (input)="onZoomInput($event)">
            <button class="zoom-btn" (click)="setZoom(zoomLevel() + 10)" title="Aumentar zoom">+</button>
            <span class="zoom-pct">{{ zoomLevel() }}%</span>
          </div>
          <span style="color:#80868b">{{ palabras }} palabras &nbsp;|&nbsp; {{ pageCount() }} pág{{ pageCount() > 1 ? 's' : '' }}.</span>
        </div>

      } <!-- end @else documento -->

      <!-- ── Toast de notificación colaborativa ── -->
      @if (notificacion) {
        <div class="collab-toast" [style.border-left-color]="notificacion.color">
          <span class="material-symbols-outlined" style="font-size:20px;color:#1a73e8">notifications_active</span>
          <div class="collab-toast-body">
            <strong style="font-size:12px">Solicitud de revisión</strong>
            <span style="font-size:12px">{{ notificacion.mensaje }}</span>
          </div>
          <button class="collab-toast-close" (click)="cerrarNotificacion()">✕</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .gdoc-wrapper { display: flex; flex-direction: column; height: 100%; width: 100%; background: #f0f4f9; font-family: 'Segoe UI', Arial, sans-serif; }
    .excel-collab-wrap { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; overflow: hidden; }

    .gdoc-topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: white; border-bottom: 1px solid #e0e0e0; }
    .gdoc-file-info { display: flex; align-items: center; gap: 10px; }
    .gdoc-icon { font-size: 24px; }
    .gdoc-filename { font-size: 18px; font-weight: 500; color: #202124; }
    .gdoc-status { font-size: 12px; color: #5f6368; margin-top: 2px; }
    .status-saving { color: #f59e0b; } .status-saved { color: #188038; } .status-idle { color: #5f6368; }
    .gdoc-users { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .user-chip { display: flex; align-items: center; gap: 5px; border-radius: 16px; padding: 3px 10px 3px 6px; color: white; font-size: 12px; font-weight: 600; border: 2px solid rgba(255,255,255,0.4); box-shadow: 0 1px 4px rgba(0,0,0,0.2); transition: transform 0.15s; }
    .user-chip:hover { transform: scale(1.05); }
    .user-chip.self { border-color: white; box-shadow: 0 0 0 2px rgba(255,255,255,0.6); }
    .user-initial { width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
    .user-name-label { font-size: 12px; font-weight: 600; max-width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge-connected { font-size: 11px; color: #188038; font-weight: 600; }
    .badge-offline { font-size: 11px; color: #f59e0b; font-weight: 600; }
    .badge-local { font-size: 11px; color: #1a73e8; font-weight: 600; }

    /* ── Word Ribbon ─────────────────────────── */
    .wd-ribbon { flex-shrink: 0; }
    .wd-ribbon-tabs { display: flex; align-items: flex-end; background: #2B579A;
      padding: 0 8px; height: 28px; gap: 0; }
    .wd-rtab { height: 24px; padding: 0 14px; background: transparent; border: none;
      color: rgba(255,255,255,0.85); font-size: 12px; font-family: inherit;
      cursor: pointer; border-radius: 3px 3px 0 0; white-space: nowrap; }
    .wd-rtab:hover { background: rgba(255,255,255,0.18); color: #fff; }
    .wd-rtab.wd-rtab-active { background: #fff; color: #2B579A; font-weight: 600; height: 26px; }

    .wd-ribbon-body { display: flex; align-items: stretch; background: #fff;
      padding: 2px 4px 0; min-height: 86px; overflow-x: auto; flex-shrink: 0;
      border-top: 2px solid #2B579A; border-bottom: 1px solid #c8c8c8; }
    .wd-ribbon-body::-webkit-scrollbar { height: 4px; }
    .wd-ribbon-body::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 2px; }

    .wd-rgroup { display: flex; flex-direction: column; padding: 4px 6px 0; min-width: max-content; }
    .wd-rgroup-content { flex: 1; display: flex; align-items: flex-start; gap: 2px; }
    .wd-rgroup-label { text-align: center; font-size: 10px; color: #666;
      padding: 2px 0; border-top: 1px solid #e4e4e4; margin-top: 2px; white-space: nowrap; }
    .wd-rsep { width: 1px; background: #d8d8d8; margin: 6px 3px 6px; flex-shrink: 0; }
    .wd-rsep-v { width: 1px; height: 20px; background: #d4d4d4; margin: 0 2px; flex-shrink: 0; align-self: center; }
    .wd-rrow { display: flex; align-items: center; gap: 2px; }

    .wd-rbtn { border: 1px solid transparent; background: transparent; cursor: pointer;
      border-radius: 3px; font-family: inherit; color: #1a1a1a; display: flex;
      align-items: center; justify-content: center; overflow: hidden; }
    .wd-rbtn:hover:not(:disabled) { background: #dce6f3; border-color: #2B579A; }
    .wd-rbtn:disabled { opacity: 0.35; cursor: default; }
    .wd-rbtn.wd-active { background: #b8d0f0; border-color: #2B579A; color: #1a3a6e; }

    .wd-rbtn-lg { flex-direction: column; gap: 2px; width: 58px; min-height: 68px;
      padding: 4px 2px 2px; font-size: 11px; flex-shrink: 0; }
    .wd-rbtn-lbl { font-size: 10px; text-align: center; white-space: normal;
      line-height: 1.2; width: 54px; overflow: hidden; }
    .wd-rbtn-sm { flex-direction: row; gap: 4px; height: 22px; padding: 0 6px;
      font-size: 11px; white-space: nowrap; justify-content: flex-start; }
    .wd-rbtn-sm .material-symbols-outlined { font-size: 14px; flex-shrink: 0; }
    .wd-rbtn-ic { width: 26px; height: 26px; padding: 0; font-size: 13px; flex-shrink: 0; }
    .wd-rbtn-ic .material-symbols-outlined { font-size: 14px; }
    .wd-rbtn-sm-col { display: flex; flex-direction: column; justify-content: flex-start; gap: 1px; }

    .wd-font-sel { height: 22px; font-size: 11px; font-family: inherit; border: 1px solid #c8c8c8;
      border-radius: 3px; background: white; cursor: pointer; padding: 0 4px; min-width: 100px; }
    .wd-size-sel { height: 22px; font-size: 11px; font-family: inherit; border: 1px solid #c8c8c8;
      border-radius: 3px; background: white; cursor: pointer; padding: 0 4px; width: 48px; }
    .wd-color-wrap { position: relative; overflow: hidden; cursor: pointer; }
    .wd-color-input { position: absolute; opacity: 0; width: 0; height: 0; top: 0; left: 0; }
    .wd-word-count { font-size: 11px; color: #80868b; padding: 0 10px;
      display: flex; align-items: center; align-self: center; white-space: nowrap; }

    /* Regla */
    .gdoc-ruler-wrap { display: flex; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; height: 22px; flex-shrink: 0; }
    .gdoc-ruler-corner { width: 22px; height: 22px; background: #f8f9fa; border-right: 1px solid #e0e0e0; flex-shrink: 0; }
    .gdoc-ruler-h { flex: 1; height: 22px; background: #f8f9fa; position: relative; overflow: hidden;
      background-image:
        repeating-linear-gradient(90deg, transparent, transparent 37px, #bdbdbd 37px, #bdbdbd 38px),
        repeating-linear-gradient(90deg, transparent, transparent 7px, #d9d9d9 7px, #d9d9d9 7.5px);
      background-size: 38px 100%, 7.6px 50%;
      background-position: 0 0, 0 100%;
      background-repeat: repeat-x; }

    .gdoc-page-bg { flex: 1; overflow: auto; padding: 24px 48px 48px 48px; background: #808080; position: relative; display: flex; flex-direction: column; align-items: center; }
    .gdoc-page {
      width: 816px;
      background-color: white;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2);
      min-height: 1056px; padding: 96px 96px 96px 96px;
      border-radius: 0; position: relative;
      flex-shrink: 0;
    }
    /* Page separators — absolutely positioned over content, z above text but below cursors */
    .page-sep {
      position: absolute;
      left: 0; right: 0;
      height: 28px;
      background: #707070;
      z-index: 15;
      pointer-events: none;
    }
    .gdoc-content { outline: none; min-height: 864px; }
    .cursor-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 50; overflow: visible; }
    .gdoc-footer { padding: 4px 16px; background: #f8f9fa; border-top: 1px solid #e0e0e0; font-size: 11px; color: #5f6368; min-height: 28px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .zoom-bar { display: flex; align-items: center; gap: 4px; }
    .zoom-btn { width: 22px; height: 22px; border: 1px solid #d0d0d0; background: white; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1; display: flex; align-items: center; justify-content: center; color: #444; }
    .zoom-btn:hover { background: #e8eaed; }
    .zoom-slider { width: 90px; accent-color: #1a73e8; cursor: pointer; }
    .zoom-pct { font-size: 11px; color: #5f6368; min-width: 34px; text-align: right; }
    .editing-indicator { color: #1a73e8; font-weight: 500; }
    .notif-btn { display:flex; align-items:center; gap:4px; padding:4px 10px; background:#1a73e8; color:white; border:none; border-radius:16px; font-size:12px; font-weight:600; cursor:pointer; transition:background 0.15s; }
    .notif-btn:hover { background:#1557b0; }
    .collab-toast { position:fixed; bottom:24px; right:24px; z-index:9999; display:flex; align-items:center; gap:10px; background:white; border-radius:8px; padding:12px 14px; box-shadow:0 4px 20px rgba(0,0,0,0.25); border-left:4px solid #1a73e8; min-width:280px; max-width:360px; animation:toast-in 0.3s ease; }
    .collab-toast-body { display:flex; flex-direction:column; gap:2px; flex:1; }
    .collab-toast-close { background:none; border:none; cursor:pointer; font-size:14px; color:#888; padding:0 2px; line-height:1; }
    .collab-toast-close:hover { color:#333; }
    @keyframes toast-in { from { transform:translateY(20px); opacity:0; } to { transform:translateY(0); opacity:1; } }

    :deep(.ProseMirror) { outline: none; font-family: 'Calibri', 'Arial', sans-serif; font-size: 12pt; line-height: 1.5; color: #202124; caret-color: #1a73e8; }
    /* Heading styles matching Word's Título 1/2/3 defaults */
    :deep(.ProseMirror h1) { font-size: 16pt; font-weight: 700; margin: 12pt 0 3pt; color: #2F5496; font-family: 'Calibri Light', 'Calibri', 'Arial', sans-serif; page-break-after: avoid; }
    :deep(.ProseMirror h2) { font-size: 13pt; font-weight: 700; margin: 8pt 0 2pt; color: #2F5496; font-family: 'Calibri Light', 'Calibri', 'Arial', sans-serif; page-break-after: avoid; }
    :deep(.ProseMirror h3) { font-size: 12pt; font-weight: 700; margin: 6pt 0 2pt; color: #1F3763; font-family: 'Calibri', 'Arial', sans-serif; page-break-after: avoid; }
    :deep(.ProseMirror h4) { font-size: 11pt; font-weight: 700; font-style: italic; margin: 4pt 0 2pt; color: #2F5496; font-family: 'Calibri', 'Arial', sans-serif; }
    :deep(.ProseMirror h5) { font-size: 11pt; font-weight: 700; margin: 4pt 0 2pt; color: #2F5496; font-family: 'Calibri', 'Arial', sans-serif; }
    :deep(.ProseMirror p) { margin: 0 0 6pt; line-height: 1.5; }
    :deep(.ProseMirror ul) { padding-left: 24px; margin: 4px 0; list-style-type: disc; }
    :deep(.ProseMirror ol) { padding-left: 24px; margin: 4px 0; list-style-type: decimal; }
    :deep(.ProseMirror li) { margin: 2px 0; line-height: 1.5; }
    :deep(.ProseMirror li p) { margin: 0; }
    :deep(.ProseMirror strong) { font-weight: 700; }
    :deep(.ProseMirror em) { font-style: italic; }
    :deep(.ProseMirror mark) { background: #fff176; padding: 0; }
    :deep(.ProseMirror blockquote) { border-left: 3px solid #1a73e8; margin: 10px 0; padding: 6px 14px; background: #f8f9fa; font-style: italic; color: #5f6368; }
    :deep(.ProseMirror code) { background: #f1f3f4; font-family: 'Courier New', monospace; font-size: 10pt; padding: 1px 4px; border-radius: 3px; }
    /* Images — render properly like embedded Word images */
    :deep(.ProseMirror img) { max-width: 100%; height: auto; display: block; margin: 12px auto; cursor: default; box-shadow: none; }
    :deep(.ProseMirror img.ProseMirror-selectednode) { outline: 2px solid #1a73e8; }
    /* Tables — Word-like borders */
    :deep(.ProseMirror table) { border-collapse: collapse; margin: 10px 0; width: 100%; table-layout: auto; }
    :deep(.ProseMirror td, .ProseMirror th) { border: 1px solid #000; padding: 4px 9px; vertical-align: top; min-width: 60px; font-size: 11pt; word-break: break-word; }
    :deep(.ProseMirror th) { background: #dce6f1; font-weight: 700; color: #1a1a1a; text-align: center; }
    :deep(.ProseMirror tr:nth-child(even) td) { background: #fafafa; }
    :deep(.selectedCell) { background: #c8e6fb !important; outline: 2px solid #1a73e8; }
    :deep(.ProseMirror p.is-editor-empty:first-child::before) { color: #bdbdbd; content: attr(data-placeholder); float: left; height: 0; pointer-events: none; font-style: italic; }

    /* ── Modo Excel / Planilla ───────────────────────────────────────── */
    .excel-bg { padding: 0 !important; background: #d0d0d0 !important; align-items: stretch !important; }
    .excel-mode { width: 100% !important; max-width: none !important; min-width: 0 !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; min-height: 100% !important; overflow: auto !important; }
    :deep(.excel-mode .ProseMirror) { font-family: Calibri, Arial, sans-serif; font-size: 12px; line-height: 1.3; min-height: auto; padding: 0; }
    :deep(.excel-mode .ProseMirror > table) { width: max-content; min-width: 100%; border-collapse: collapse; margin: 0; font-size: 12px; }
    :deep(.excel-mode .ProseMirror th) {
      background: #e2efda; border: 1px solid #b0b0b0; padding: 4px 10px;
      font-weight: 700; text-align: center; white-space: nowrap; color: #1a1a1a;
      position: sticky; top: 0; z-index: 10; box-shadow: 0 1px 0 #b0b0b0;
    }
    :deep(.excel-mode .ProseMirror td) { border: 1px solid #d0d0d0; padding: 3px 8px; white-space: nowrap; vertical-align: middle; color: #1a1a1a; }
    :deep(.excel-mode .ProseMirror tr:nth-child(even) td) { background: #f7fbf3; }
    :deep(.excel-mode .ProseMirror tr:hover td) { background: #e8f4fd; }
    :deep(.excel-mode .gdoc-content) { min-height: auto; }

    /* ── Cursores de mouse remotos ─────────────────────────────────── */
    /* Cursores de mouse remotos */
    .remote-mouse-cursor { position: absolute; top: 0; left: 0; pointer-events: none; will-change: transform; transition: transform 0.08s ease-out; display: flex; flex-direction: column; align-items: flex-start; }
    .remote-mouse-cursor svg { display: block; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
    .remote-mouse-label { font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 10px; margin-top: -3px; margin-left: 10px; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.25); font-family: -apple-system, 'Segoe UI', sans-serif; color: white; }

    /* ── Banner modo visualización (cliente) ─────────────────────── */
    .readonly-banner {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      background: #fef3c7; color: #92400e; border-bottom: 1px solid #fcd34d;
      font-size: 12px; font-weight: 600; padding: 6px 14px;
    }

    /* ── Panel Asistente IA colaborativo ─────────────────────────── */
    .gdoc-wrapper { position: relative; }
    .ia-toggle-btn.ia-on { background: #1a73e8 !important; color: #fff !important; }
    .ia-colab-panel {
      position: absolute; top: 56px; right: 0; bottom: 0; width: 340px; z-index: 45;
      background: #fff; border-left: 1px solid #dadce0; display: flex; flex-direction: column;
      box-shadow: -6px 0 18px rgba(0,0,0,0.12);
    }
    .ia-colab-header {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      background: #1a73e8; color: #fff; font-weight: 700; font-size: 13px;
    }
    .ia-colab-title { flex: 1; }
    .ia-colab-close { background: none; border: none; color: #fff; cursor: pointer; opacity: .85; }
    .ia-colab-close:hover { opacity: 1; }
    .ia-colab-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: #f8f9fa; }
    .ia-colab-intro { font-size: 12px; color: #5f6368; background: #fff; border: 1px solid #e0e0e0; border-radius: 10px; padding: 12px; line-height: 1.5; }
    .ia-colab-intro ul { margin: 4px 0 0 16px; padding: 0; }
    .ia-colab-intro li { margin-top: 3px; }
    .ia-colab-msg {
      font-size: 12.5px; line-height: 1.5; padding: 9px 12px; border-radius: 12px;
      background: #fff; border: 1px solid #e0e0e0; color: #202124;
      white-space: pre-wrap; word-break: break-word; max-width: 95%;
    }
    .ia-colab-msg-user { background: #1a73e8; color: #fff; border: none; align-self: flex-end; }
    .ia-colab-typing { color: #5f6368; font-style: italic; animation: pulse 1.2s infinite; }
    @keyframes pulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
    .ia-colab-footer { display: flex; gap: 6px; padding: 10px; border-top: 1px solid #e0e0e0; background: #fff; }
    .ia-colab-input {
      flex: 1; border: 1px solid #dadce0; border-radius: 18px; padding: 8px 14px;
      font-size: 12.5px; outline: none; color: #202124;
    }
    .ia-colab-input:focus { border-color: #1a73e8; }
    .ia-colab-send {
      width: 36px; height: 36px; border-radius: 50%; border: none; background: #1a73e8;
      color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
    }
    .ia-colab-send:disabled { background: #c5c9d0; cursor: default; }
  `]
})
export class EditorColaborativoComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() documentoKey: string = '';
  @Input() nombreDoc: string = 'Documento';
  @Input() tramiteId: string = '';
  @Output() contenidoGuardado = new EventEmitter<string>();

  @ViewChild('editorEl') editorEl!: ElementRef;
  @ViewChild('pageBg') pageBgEl!: ElementRef;
  @ViewChild('gdocPage') gdocPageEl!: ElementRef;
  @ViewChild('cursorOverlay') cursorOverlayEl!: ElementRef;
  @ViewChild('cursorOverlayExcel') cursorOverlayExcelEl!: ElementRef;
  @ViewChild('excelWrap') excelWrapEl!: ElementRef;
  @ViewChild('rulerH') rulerHEl!: ElementRef;

  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private notificacionSvc = inject(NotificacionService);
  private authSvc = inject(AuthService);
  private destroy$ = new Subject<void>();
  private guardarDebounce$ = new Subject<string>();
  private broadcastTimer: ReturnType<typeof setTimeout> | null = null;
  private lastMouseTs = 0;

  editor: Editor | null = null;
  guardando = false;
  ultimaGuarda: Date | null = null;
  sincronizado = false;
  palabras = 0;
  docTab = 'inicio';
  remoteExcelSheets: any[] | null = null;
  private excelBroadcastTimer: ReturnType<typeof setTimeout> | null = null;
  miNombre = 'Usuario';
  miColor = '#1a73e8';
  usuariosConectados: Array<{ id: string; nombre: string; color: string }> = [];
  ultimoEditorActivo = '';
  notificacion: { mensaje: string; autor: string; color: string } | null = null;
  private notifTimer: ReturnType<typeof setTimeout> | null = null;
  private pushEndpoint = '';
  // ── Permisos de edición ──────────────────────────────────────
  // El cliente entra en modo visualización; el funcionario le habilita la
  // edición enviando una solicitud de corrección (documento erróneo/incompleto).
  esCliente = false;
  soloLectura = false;
  /** A quién va la solicitud de corrección: 'cliente' (primer nodo) o
   *  'funcionarios' (el trámite ya fue validado por otro nodo → revisión A↔B) */
  destinoSolicitud: 'cliente' | 'funcionarios' = 'cliente';

  // ── Asistente IA colaborativo (solo funcionarios) ───────────
  // Analiza trámite (BD) + política/flujo + documento para ayudar
  // a resolver observaciones entre unidades.
  iaPanelAbierto = false;
  iaMensajes: Array<{ rol: 'user' | 'ia'; texto: string }> = [];
  iaInput = '';
  iaCargando = false;
  private iaContexto = '';
  get docIdDebug(): string { return this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 16); }

  private stompClient: Client | null = null;
  private docTopic = '';
  private pendingBroadcast: string | null = null;
  private ignorarSiguienteUpdate = false;
  private cursoresRemotos: Map<string, {nombre: string; color: string; from: number}> = new Map();
  private cursoresMouseEls: Map<string, HTMLElement> = new Map();
  private mouseLeaveTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pageResizeObserver?: ResizeObserver;
  private adjustTimer: ReturnType<typeof setTimeout> | null = null;
  private _adjustInProgress = false;
  private _lastWriteKey = '';

  pageCount = signal(1);
  zoomLevel = signal(100);

  get pageBreaks(): number[] {
    return Array.from({ length: Math.max(0, this.pageCount() - 1) }, (_, i) => (i + 1) * 1056 - 28);
  }

  setZoom(level: number): void { this.zoomLevel.set(Math.min(200, Math.max(50, level))); }
  onZoomInput(event: Event): void { this.setZoom(+(event.target as HTMLInputElement).value); }


  // SessionId estable por pestaña del navegador — evita duplicados al reabrir el modal
  private miSessionId: string = (() => {
    const KEY = 'nexusflow_tab_sid';
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  })();

  ngOnInit(): void {
    this.miNombre = this.obtenerNombre();
    this.miColor = this.colorPorNombre(this.miNombre);

    // El cliente entra en modo visualización hasta que un funcionario
    // le habilite la edición (solicitud de corrección).
    this.esCliente = this.authSvc.getRol() === 'ROL-CLIENTE';
    this.soloLectura = this.esCliente && !this.tieneDesbloqueo();
    // Persistir el permiso aunque la notificación luego se marque como leída
    if (this.esCliente && !this.soloLectura) sessionStorage.setItem(this.unlockKey, '1');

    // Funcionario: averiguar si la solicitud iría al cliente (primer nodo)
    // o a un funcionario anterior (trámite ya avanzó de nodo)
    if (!this.esCliente && this.tramiteId) {
      this.http.get<{ tipo: 'cliente' | 'funcionarios' }>(`/api/notificaciones/solicitud-edicion/destino/${this.tramiteId}`)
        .subscribe({
          next: r => {
            this.destinoSolicitud = r.tipo;
            this.cdr.detectChanges();
          },
          error: () => {}
        });
    }

    this.guardarDebounce$
      .pipe(debounceTime(2000), takeUntil(this.destroy$))
      .subscribe(html => this.guardarEnNube(html));

  }

  ngAfterViewInit(): void {
    if (!this.esExcel()) {
      this.iniciarEditor();
      this.iniciarPageObserver();
    }
    this.conectarStomp();
    // Register push then auto-notify others that we entered the document
    setTimeout(() => this.registerPush().then(() => this.notificarEntrada()), 2500);
  }

  private iniciarPageObserver(): void {
    const el = this.gdocPageEl?.nativeElement as HTMLElement;
    if (!el) return;
    this.pageResizeObserver = new ResizeObserver(entries => {
      if (this._adjustInProgress) return;
      const height = (entries[0].target as HTMLElement).offsetHeight ?? 0;
      const zoomFactor = this.zoomLevel() / 100;
      const count = Math.max(1, Math.ceil(height / (1056 * zoomFactor)));
      if (count !== this.pageCount()) {
        this.zone.run(() => this.pageCount.set(count));
      }
    });
    this.pageResizeObserver.observe(el);
  }

  scheduleAdjust(): void {
    if (this.adjustTimer) clearTimeout(this.adjustTimer);
    // Run outside Angular zone — prevents change detection on every marginTop write
    this.adjustTimer = setTimeout(() => this.zone.runOutsideAngular(() => this._doAdjust()), 250);
  }

  private _doAdjust(): void {
    if (this._adjustInProgress) return;
    this._adjustInProgress = true;

    const page = this.gdocPageEl?.nativeElement as HTMLElement;
    const proseMirror = page?.querySelector('.ProseMirror') as HTMLElement;
    if (!page || !proseMirror) { this._adjustInProgress = false; return; }

    const CYCLE     = 1056;
    const GAP_START = 1028;
    const zoom      = this.zoomLevel() / 100;

    // Disconnect while we reset + measure to avoid false ResizeObserver fires
    this.pageResizeObserver?.disconnect();

    try {
      // Reset previous adjustments so measurements are from original positions
      (Array.from(proseMirror.querySelectorAll('[data-pb-adj]')) as HTMLElement[]).forEach(el => {
        el.style.marginTop = el.dataset['pbOrig'] ?? '';
        el.removeAttribute('data-pb-adj');
        delete el.dataset['pbOrig'];
      });

      const blocks  = Array.from(proseMirror.children) as HTMLElement[];
      const pageTop = page.getBoundingClientRect().top;

      // PHASE 1 — batch read
      const measurements = blocks.map(el => {
        const r = el.getBoundingClientRect();
        const computedMT = parseFloat(getComputedStyle(el).marginTop) || 0;
        return { el, top: (r.top - pageTop) / zoom, height: r.height / zoom, origMT: computedMT, inlineStyle: el.style.marginTop };
      });

      // PHASE 2 — calculate
      let cumulativePush = 0;
      const writes: { el: HTMLElement; newMargin: string; origStyle: string }[] = [];

      for (const m of measurements) {
        const top    = m.top + cumulativePush;
        const bottom = top + m.height;
        if (m.height >= CYCLE - 40) continue;
        const c0 = Math.floor(top / CYCLE);
        const c1 = Math.floor((bottom - 1) / CYCLE);
        for (let c = c0; c <= c1; c++) {
          const grayStart = c * CYCLE + GAP_START;
          const grayEnd   = (c + 1) * CYCLE;
          if (top < grayEnd && bottom > grayStart) {
            const push = grayEnd - top + 10;
            writes.push({ el: m.el, newMargin: `${m.origMT + push}px`, origStyle: m.inlineStyle });
            cumulativePush += push;
            break;
          }
        }
      }

      this._lastWriteKey = writes.map((w, i) => `${i}:${w.newMargin}`).join('|');

      // PHASE 3 — batch write
      writes.forEach(w => {
        w.el.dataset['pbOrig'] = w.origStyle;
        w.el.setAttribute('data-pb-adj', '1');
        w.el.style.marginTop = w.newMargin;
      });

      // Always reconnect so future content changes update pageCount.
      // The ResizeObserver callback already guards _adjustInProgress so events
      // fired during the next run are suppressed; the count !== pageCount() check
      // prevents Angular CD when height hasn't genuinely changed.
      const pageEl = this.gdocPageEl?.nativeElement as HTMLElement;
      if (pageEl) this.pageResizeObserver?.observe(pageEl);

      // When stable, schedule no further work — no height change means the
      // ResizeObserver won't fire, breaking the cascade.
      // When unstable (new content), the ResizeObserver will fire once and
      // update pageCount; scheduleAdjust will be called from onUpdate instead.

    } finally {
      this._adjustInProgress = false;
    }
  }

  private iniciarEditor(): void {
    this.editor = new Editor({
      element: this.editorEl.nativeElement,
      extensions: [
        StarterKit,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Highlight,
        // @ts-ignore
        TextStyle,
        Color,
        Table.configure({ resizable: true }),
        TableRow,
        TableHeaderStyled,
        TableCellStyled,
        Image.configure({ inline: true, allowBase64: true }),
        Placeholder.configure({ placeholder: 'Empieza a escribir...' })
      ],
      content: '<p></p>',
      editable: !this.soloLectura,
      onUpdate: ({ editor }) => {
        const skipBroadcast = this.ignorarSiguienteUpdate;
        if (this.ignorarSiguienteUpdate) this.ignorarSiguienteUpdate = false;

        const texto = editor.getText();
        this.palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;

        this.scheduleAdjust();

        if (skipBroadcast) return;

        const html = editor.getHTML();
        this.guardarDebounce$.next(html);
        if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
        this.broadcastTimer = setTimeout(() => this.broadcastCambio(html), 300);
      }
    });

    setTimeout(() => this.cargarContenido(), 50);
  }

  // ─── Mouse tracking ───────────────────────────────────────────────────────

  // Llamado desde el template con (mousemove) — se ejecuta fuera de zone para no disparar change detection
  onMouseMove(e: MouseEvent): void {
    const now = Date.now();
    if (now - this.lastMouseTs < 30) return;
    this.lastMouseTs = now;
    this.zone.runOutsideAngular(() => {
      const refEl = (this.esExcel() ? this.excelWrapEl : this.gdocPageEl)?.nativeElement as HTMLElement;
      if (!refEl) return;
      const rect = refEl.getBoundingClientRect();
      const zoom = this.esExcel() ? 1 : (this.zoomLevel() / 100);
      // Normalize to document coords so zoom differences between users don't offset the cursor
      this.broadcastMousePos((e.clientX - rect.left) / zoom, (e.clientY - rect.top) / zoom);
    });
  }

  private broadcastMousePos(x: number, y: number): void {
    if (!this.stompClient?.connected) return;
    const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
    this.stompClient.publish({
      destination: `/app/doc/${docId}/cursor`,
      body: JSON.stringify({
        sessionId: this.miSessionId,
        nombre: this.miNombre,
        color: this.miColor,
        from: 0,
        mouseX: x,
        mouseY: y
      })
    });
  }

  private renderizarCursorMouse(sessionId: string, nombre: string, color: string, x: number, y: number): void {
    const overlay = (this.esExcel() ? this.cursorOverlayExcelEl : this.cursorOverlayEl)?.nativeElement as HTMLElement;
    if (!overlay) return;

    let el = this.cursoresMouseEls.get(sessionId);
    if (!el) {
      el = document.createElement('div');
      el.className = 'remote-mouse-cursor';
      el.innerHTML = `
        <svg width="18" height="24" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1L1 19L5.5 14L9 22L12 20.5L8.5 12.5L15 12.5L1 1Z"
            fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span class="remote-mouse-label" style="background:${color}">${nombre.split(' ')[0]}</span>
      `;
      overlay.appendChild(el);
      this.cursoresMouseEls.set(sessionId, el);
    }

    // transform es mas eficiente que left/top para animaciones
    el.style.transform = `translate(${x}px, ${y}px)`;

    // Auto-ocultar si no hay movimiento por 5 segundos
    const prev = this.mouseLeaveTimers.get(sessionId);
    if (prev) clearTimeout(prev);
    el.style.opacity = '1';
    const t = setTimeout(() => {
      if (el) el.style.opacity = '0.3';
    }, 5000);
    this.mouseLeaveTimers.set(sessionId, t);
  }

  private eliminarCursorMouse(sessionId: string): void {
    const el = this.cursoresMouseEls.get(sessionId);
    if (el) { el.remove(); this.cursoresMouseEls.delete(sessionId); }
    const t = this.mouseLeaveTimers.get(sessionId);
    if (t) { clearTimeout(t); this.mouseLeaveTimers.delete(sessionId); }
  }

  // ─── STOMP ────────────────────────────────────────────────────────────────

  private conectarStomp(): void {
    const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
    this.docTopic = `/topic/doc/${docId}`;
    const presenceTopic = `/topic/doc/${docId}/presencia`;
    const cursorTopic = `/topic/doc/${docId}/cursor`;

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(`${window.location.protocol}//${window.location.host}/ws`) as any,
      reconnectDelay: 2000,
      onConnect: () => {
        console.log('[COLAB] STOMP connected');
        this.zone.run(() => { this.sincronizado = true; this.cdr.detectChanges(); });
        this.flushPendingBroadcast();

        // Cambios de contenido
        this.stompClient!.subscribe(this.docTopic, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            const isSelf = data.sessionId === this.miSessionId;
            if (isSelf) return;

            // ── Notification request ────────────────────────────────────
            if (data.tipo === 'edit_request') {
              const msg = data.mensaje ?? `${data.autor} solicita que revises el documento`;
              // Toast inside the editor
              this.mostrarNotificacion(msg, data.autor ?? '', data.color ?? '#1a73e8');
              // Also push to the notification bell so it appears globally.
              // (Si soy cliente y viene de funcionario, el backend ya creó la
              // notificación persistente — evitar duplicado en la campana.)
              const backendLaPersiste = this.esCliente && data.autorRol === 'ROL-FUNCIONARIO';
              if (!backendLaPersiste) {
                this.notificacionSvc.agregarLocal({
                  tipo: 'EDICION_SOLICITADA',
                  titulo: '✏️ Solicitud de edición',
                  mensaje: msg,
                  icono: 'edit_document',
                  color: data.color ?? 'primary',
                  tramiteId: data.tramiteId || this.tramiteId || this.documentoKey,
                  docKey: data.docKey || this.documentoKey,
                  docNombre: data.docNombre || this.nombreDoc
                });
              }
              // Si soy cliente y la solicitud viene de un funcionario PARA el
              // cliente → habilitar edición (no si es revisión entre funcionarios)
              if (this.esCliente && data.autorRol === 'ROL-FUNCIONARIO' && data.paraCliente !== false) {
                this.habilitarEdicion(data.autor ?? 'El funcionario');
              }
              return;
            }

            // ── Excel collaborative update ──────────────────────────────
            if (data.tipo === 'excel_update' && Array.isArray(data.sheets)) {
              this.zone.run(() => {
                this.remoteExcelSheets = data.sheets;
                this.ultimoEditorActivo = data.autor ?? '';
                this.cdr.detectChanges();
              });
              return;
            }

            // ── Word document update ────────────────────────────────────
            if (!data?.contenido || !this.editor) return;
            this.ignorarSiguienteUpdate = true;
            this.editor.commands.setContent(this.mergeIncomingHtml(data.contenido));
            this.zone.run(() => {
              const txt = this.editor?.getText() ?? '';
              this.palabras = txt.trim() ? txt.trim().split(/\s+/).length : 0;
              this.ultimoEditorActivo = data.autor ?? '';
              this.cdr.detectChanges();
            });
            setTimeout(() => this.zone.runOutsideAngular(() => this.scheduleAdjust()), 0);
          } catch (e) {
            console.error('[COLAB RECV] error:', e);
          }
        });

        // Cursores (texto + mouse)
        this.stompClient!.subscribe(cursorTopic, (msg) => {
          const data = JSON.parse(msg.body);
          if (data.sessionId === this.miSessionId) return;

          // Cursor de texto (caret)
          if (typeof data.from === 'number') {
            this.cursoresRemotos.set(data.sessionId, { nombre: data.nombre, color: data.color, from: data.from });
          }

          // Cursor de mouse
          if (typeof data.mouseX === 'number' && typeof data.mouseY === 'number') {
            this.renderizarCursorMouse(data.sessionId, data.nombre, data.color, data.mouseX, data.mouseY);
          }
        });

        // Presencia — deduplicar por nombre Y por sessionId para evitar duplicados al reabrir
        this.stompClient!.subscribe(presenceTopic, (msg) => {
          const data = JSON.parse(msg.body);
          if (data.sessionId === this.miSessionId) return;
          this.zone.run(() => {
            if (data.accion === 'conectar') {
              // Reemplazar entrada existente con mismo sessionId o mismo nombre
              this.usuariosConectados = [
                ...this.usuariosConectados.filter(u => u.id !== data.sessionId && u.nombre !== data.nombre),
                { id: data.sessionId, nombre: data.nombre, color: this.colorPorNombre(data.nombre) }
              ];
              // Sync: si tenemos contenido, enviárselo al recién llegado (sin base64 — imágenes desde servidor)
              if (this.editor && this.palabras > 0) {
                const html = this.stripBase64Images(this.editor.getHTML());
                setTimeout(() => {
                  if (this.stompClient?.connected) this.broadcastCambio(html);
                }, 600 + Math.random() * 400);
              }
            } else if (data.accion === 'desconectar') {
              this.usuariosConectados = this.usuariosConectados.filter(u => u.id !== data.sessionId);
              this.eliminarCursorMouse(data.sessionId);
              this.cursoresRemotos.delete(data.sessionId);
            }
            this.cdr.detectChanges();
          });
        });

        // Anunciar presencia
        this.anunciarPresencia(docId);

        // Re-anunciar cada 8s
        const intervalo = setInterval(() => {
          if (this.stompClient?.connected) this.anunciarPresencia(docId);
        }, 8000);
        this.destroy$.subscribe(() => clearInterval(intervalo));
      },
      onDisconnect: () => {
        console.warn('[COLAB] STOMP disconnected');
        this.zone.run(() => { this.sincronizado = false; this.cdr.detectChanges(); });
      },
      onStompError: (frame) => {
        console.error('[COLAB] STOMP error:', frame.headers['message'], frame.body);
      },
      onWebSocketClose: (evt: any) => {
        console.warn('[COLAB] WebSocket closed: code=', evt?.code, 'reason=', evt?.reason);
      }
    });

    this.stompClient.activate();
  }

  private anunciarPresencia(docId: string): void {
    this.stompClient?.publish({
      destination: `/app/doc/${docId}/presencia`,
      body: JSON.stringify({ sessionId: this.miSessionId, nombre: this.miNombre, accion: 'conectar' })
    });
  }

  onExcelSheetsChanged(sheets: any[]): void {
    if (this.excelBroadcastTimer) clearTimeout(this.excelBroadcastTimer);
    this.excelBroadcastTimer = setTimeout(() => {
      if (!this.stompClient?.connected) return;
      const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
      this.stompClient.publish({
        destination: `/app/doc/${docId}/update`,
        body: JSON.stringify({
          tipo: 'excel_update',
          sheets,
          autor: this.miNombre,
          sessionId: this.miSessionId
        })
      });
    }, 300);
  }

  solicitarEdicion(): void {
    const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
    const nombreDoc = this.nombreDoc || this.documentoKey.split('/').pop() || 'el documento';
    const miRol = this.authSvc.getRol();
    const estaOtroAdentro = this.usuariosConectados.length > 0;

    // El funcionario solicita corrección: al CLIENTE si el trámite está en el
    // primer nodo, o al FUNCIONARIO anterior si ya fue validado (revisión A↔B).
    // El cliente solicita que el funcionario entre a revisar.
    const paraCliente = this.destinoSolicitud === 'cliente';
    let mensaje: string;
    if (miRol === 'ROL-FUNCIONARIO') {
      mensaje = paraCliente
        ? `${this.miNombre} encontró observaciones en "${nombreDoc}" — ya puedes corregir o reemplazar el documento`
        : `${this.miNombre} encontró observaciones en "${nombreDoc}" y solicita tu revisión en el editor colaborativo`;
    } else {
      mensaje = estaOtroAdentro
        ? `${this.miNombre} solicita que revises "${nombreDoc}"`
        : `${this.miNombre} te solicita que entres a editar "${nombreDoc}"`;
    }

    // 1. STOMP — notifica en tiempo real si el usuario tiene la pestaña abierta
    if (this.stompClient?.connected) {
      this.stompClient.publish({
        destination: `/app/doc/${docId}/update`,
        body: JSON.stringify({
          tipo: 'edit_request',
          autor: this.miNombre,
          autorRol: miRol,
          color: this.miColor,
          sessionId: this.miSessionId,
          mensaje,
          // Solo desbloquea la edición del cliente si la solicitud es PARA él
          paraCliente,
          docKey: this.documentoKey,
          docNombre: nombreDoc,
          tramiteId: this.tramiteId
        })
      });
    }

    // 2. Web Push — notifica aunque el usuario no tenga la pestaña abierta (móvil / fondo)
    this.http.post('/api/push/notify', {
      docId,
      senderEndpoint: this.pushEndpoint,
      autor: this.miNombre,
      mensaje,
      url: this.urlNotifDoc(nombreDoc)
    }).subscribe({ error: err => console.warn('[WebPush] notify failed:', err) });

    // 3. Funcionario → notificación PERSISTENTE al cliente dueño del trámite:
    //    campana (Mongo + polling) + push dirigido a todas sus suscripciones.
    //    Le llega aunque esté en su panel principal o con la app cerrada.
    if (miRol === 'ROL-FUNCIONARIO' && this.tramiteId) {
      this.http.post('/api/notificaciones/solicitud-edicion', {
        tramiteId: this.tramiteId,
        docKey: this.documentoKey,
        docNombre: nombreDoc,
        autor: this.miNombre,
        mensaje
      }).subscribe({
        next: () => console.log('[Notif] solicitud de corrección enviada al cliente'),
        error: err => console.warn('[Notif] solicitud-edicion failed:', err)
      });
    }
  }

  /** URL puente que abre el documento según el rol del usuario que toque la notificación */
  private urlNotifDoc(nombreDoc: string): string {
    return `/notif-doc?doc=${encodeURIComponent(this.documentoKey)}` +
      `&tramiteId=${encodeURIComponent(this.tramiteId)}` +
      `&nombre=${encodeURIComponent(nombreDoc)}`;
  }

  private registerPush(): Promise<void> {
    return new Promise<void>(resolve => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) { resolve(); return; }
      const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');

      this.http.get<{ publicKey: string }>('/api/push/vapid-key').subscribe({
        next: async ({ publicKey }) => {
          try {
            const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
            await navigator.serviceWorker.ready;

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { resolve(); return; }

            const keyBytes = Uint8Array.from(atob(publicKey.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
            let sub: PushSubscription;
            try {
              sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
            } catch {
              // Suscripción previa con clave VAPID antigua — eliminarla y reintentar
              const vieja = await reg.pushManager.getSubscription();
              if (vieja) await vieja.unsubscribe();
              sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
            }

            const subJson = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
            this.pushEndpoint = subJson.endpoint;

            this.http.post('/api/push/subscribe', {
              endpoint: subJson.endpoint,
              keys: subJson.keys,
              docId,
              nombre: this.miNombre
            }).subscribe({
              next: () => resolve(),
              error: () => resolve()
            });
          } catch {
            resolve();
          }
        },
        error: () => resolve()
      });
    });
  }

  private notificarEntrada(): void {
    const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
    const nombre = this.miNombre.split(' ')[0];
    const nombreDoc = this.nombreDoc || this.documentoKey.split('/').pop() || 'el documento';
    const mensaje = `${nombre} abrió "${nombreDoc}" y solicita que entres a revisarlo`;

    // Web Push → llega aunque el otro no tenga el editor abierto
    this.http.post('/api/push/notify', {
      docId,
      senderEndpoint: this.pushEndpoint,
      autor: this.miNombre,
      mensaje,
      url: this.urlNotifDoc(nombreDoc)
    }).subscribe({ error: () => {} });
  }

  // ── Asistente IA colaborativo ──────────────────────────────────────────

  toggleIaPanel(): void {
    this.iaPanelAbierto = !this.iaPanelAbierto;
    if (this.iaPanelAbierto && !this.iaContexto) this.construirContextoIa();
  }

  /** Junta documento + trámite (BD) + política/flujo como contexto para la IA */
  private construirContextoIa(): void {
    const doc = this.esExcel()
      ? `Planilla Excel "${this.nombreDoc}" — el contenido está en celdas (no extraído como texto)`
      : (this.editor?.getText() ?? '').slice(0, 5000);
    const ctxDoc = `=== DOCUMENTO EN REVISIÓN: ${this.nombreDoc} ===\n${doc}\n`;
    this.iaContexto = ctxDoc;
    if (!this.tramiteId) return;

    this.http.get<any>(`/api/tramites/${this.tramiteId}`).subscribe({
      next: t => {
        const resumen = {
          id: t.id,
          nombre: t.nombre_tramite,
          estado: t.estado,
          semaforo: t.semaforizacion,
          prioridad: t.prioridad,
          nodo_actual: t.nodo_actual_nombre ?? t.nodo_actual_id,
          politica: t.politica_nombre,
          cliente: t.cliente_nombre,
          fecha_inicio: t.fecha_inicio,
          fecha_limite: t.fecha_limite,
          respuestas_por_nodo: t.respuestas_por_nodo,
          historial: (t.historial ?? []).slice(-6)
        };
        this.iaContexto = `=== TRÁMITE (BASE DE DATOS) ===\n${JSON.stringify(resumen, null, 1).slice(0, 4500)}\n\n${ctxDoc}`;

        const polId = t.politica_id || t.politicaId;
        if (polId) {
          this.http.get<any>(`/api/politicas/${polId}`).subscribe({
            next: p => {
              const flujo = {
                nombre: p.nombre,
                tipo_flujo: p.tipo_flujo,
                duracion_estandar_dias: p.duracion_estandar_dias,
                esquema_workflow: p.esquema_workflow
              };
              this.iaContexto += `\n=== POLÍTICA / FLUJO DEL TRÁMITE ===\n${JSON.stringify(flujo, null, 1).slice(0, 3500)}`;
            },
            error: () => {}
          });
        }
      },
      error: () => {}
    });
  }

  enviarIa(): void {
    const msg = this.iaInput.trim();
    if (!msg || this.iaCargando) return;
    this.iaInput = '';
    this.iaMensajes.push({ rol: 'user', texto: msg });
    this.iaCargando = true;

    this.http.post<{ respuesta: string }>('/ai/asistente/colaborativo', {
      mensaje: msg,
      contexto: this.iaContexto
    }).subscribe({
      next: r => {
        this.zone.run(() => {
          this.iaMensajes.push({ rol: 'ia', texto: r.respuesta });
          this.iaCargando = false;
          this.cdr.detectChanges();
        });
      },
      error: () => {
        this.zone.run(() => {
          this.iaMensajes.push({ rol: 'ia', texto: '⚠️ No pude conectar con el asistente. Intenta de nuevo.' });
          this.iaCargando = false;
          this.cdr.detectChanges();
        });
      }
    });
  }

  // ── Permisos de edición (cliente) ──────────────────────────────────────

  private get unlockKey(): string {
    return `colab_unlock_${this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-')}`;
  }

  /** True si el funcionario ya habilitó la edición de este documento al cliente */
  private tieneDesbloqueo(): boolean {
    if (sessionStorage.getItem(this.unlockKey) === '1') return true;
    // También desbloquea si hay una solicitud de corrección pendiente en la campana
    return this.notificacionSvc.notificaciones().some(n =>
      n.tipo === 'EDICION_SOLICITADA' && (n.docKey === this.documentoKey || n.tramiteId === this.documentoKey)
    );
  }

  /** Llamado cuando el funcionario envía la solicitud de corrección */
  private habilitarEdicion(autor: string): void {
    sessionStorage.setItem(this.unlockKey, '1');
    if (!this.soloLectura) return;
    this.zone.run(() => {
      this.soloLectura = false;
      this.editor?.setEditable(true);
      this.mostrarNotificacion(
        `${autor} te habilitó la edición — ya puedes corregir el documento`,
        autor, '#16a34a'
      );
      this.cdr.detectChanges();
    });
  }

  mostrarNotificacion(msg: string, autor: string, color: string): void {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.zone.run(() => {
      this.notificacion = { mensaje: msg, autor, color };
      this.cdr.detectChanges();
    });
    this.notifTimer = setTimeout(() => {
      this.zone.run(() => { this.notificacion = null; this.cdr.detectChanges(); });
    }, 8000);
  }

  cerrarNotificacion(): void {
    if (this.notifTimer) clearTimeout(this.notifTimer);
    this.notificacion = null;
  }

  private broadcastCambio(html: string): void {
    this.pendingBroadcast = html;
    if (!this.stompClient?.connected) {
      console.warn('[COLAB] broadcastCambio: STOMP not connected, queued');
      return;
    }
    this.flushPendingBroadcast();
  }

  private stripBase64Images(html: string): string {
    // Strip base64 data URLs — images are stored in MinIO, not in STOMP messages.
    // Keeps src attribute so the tag structure is valid; receivers reload images from server.
    return html.replace(/src="data:[^"]{20,}"/g, 'src=""');
  }

  private mergeIncomingHtml(incomingHtml: string): string {
    // Restore real image srcs that were stripped from STOMP broadcast (src="").
    // Current editor already has images loaded from server — preserve them.
    if (!incomingHtml.includes('src=""') || !this.editorEl) return incomingHtml;
    const currentImgs = Array.from(
      (this.editorEl.nativeElement as HTMLElement).querySelectorAll('img')
    ) as HTMLImageElement[];
    const realSrcs = currentImgs.map(img => img.getAttribute('src') ?? '').filter(s => s.length > 10);
    let idx = 0;
    return incomingHtml.replace(/src=""/g, () => {
      const src = realSrcs[idx++];
      return src ? `src="${src}"` : 'src=""';
    });
  }

  private flushPendingBroadcast(): void {
    if (!this.pendingBroadcast || !this.stompClient?.connected) return;
    const rawHtml = this.pendingBroadcast;
    this.pendingBroadcast = null;
    const html = this.stripBase64Images(rawHtml);
    const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
    this.stompClient.publish({
      destination: `/app/doc/${docId}/update`,
      body: JSON.stringify({ contenido: html, autor: this.miNombre, sessionId: this.miSessionId })
    });
  }

  // ─── Contenido ────────────────────────────────────────────────────────────

  private cargarContenido(): void {
    if (!this.editor) return;
    const editedKey = this.documentoKey + '.edited.html';
    this.http.get<any>(`/ai/documentos/leer/${editedKey}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const html = res?.contenido_html ?? '';
          const hasContent = html.trim() !== '' && html !== '<p></p>';
          const hasImages = /<img\s/i.test(html);
          const isDocx = this.documentoKey.toLowerCase().endsWith('.docx');
          if (hasContent && (!isDocx || hasImages)) {
            // Edited version is good (has content and images if docx)
            this.aplicarContenido(html);
          } else if (hasContent && isDocx && !hasImages) {
            // Edited version has text but no images — load original for images
            this.cargarOriginal(html);
          } else {
            this.cargarOriginal();
          }
        },
        error: () => this.cargarOriginal()
      });
  }

  private cargarOriginal(fallbackHtml?: string): void {
    this.http.get<any>(`/ai/documentos/leer/${this.documentoKey}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const origHtml = res?.contenido_html ?? '';
          const hasContent = origHtml.trim() !== '' && origHtml !== '<p></p>';
          if (hasContent && (/<img\s/i.test(origHtml) || !fallbackHtml)) {
            // Original has images (or no fallback) — use original
            this.aplicarContenido(origHtml);
          } else if (fallbackHtml) {
            this.aplicarContenido(fallbackHtml);
          }
        },
        error: () => { if (fallbackHtml) this.aplicarContenido(fallbackHtml); }
      });
  }

  private aplicarContenido(html: string): void {
    if (!this.editor) return;
    // Strip <style> tags — ProseMirror can't handle them and they corrupt HTML parsing
    const cleanHtml = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    this.ignorarSiguienteUpdate = true;
    this.editor.commands.setContent(cleanHtml || '<p></p>');
    const texto = this.editor.getText();
    this.zone.run(() => {
      this.palabras = texto.trim() ? texto.trim().split(/\s+/).length : 0;
      this.cdr.detectChanges();
    });
    this.zone.runOutsideAngular(() => {
      this.scheduleAdjust();
      setTimeout(() => this.scheduleAdjust(), 1500);
      setTimeout(() => this.scheduleAdjust(), 4000);
    });
  }

  private guardarEnNube(html: string): void {
    if (!this.documentoKey) return;
    this.guardando = true;
    const editedKey = this.documentoKey + '.edited.html';
    const fd = new FormData();
    fd.append('key', editedKey);
    fd.append('contenido', html);
    fd.append('formato', 'html');
    this.http.post('/ai/documentos/guardar-contenido', fd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => { this.zone.run(() => { this.guardando = false; this.ultimaGuarda = new Date(); this.cdr.detectChanges(); }); },
        error: () => { this.guardando = false; }
      });
  }

  // ─── Comandos del editor ──────────────────────────────────────────────────
  // Nota: TipTap con editable:false bloquea el tecleo pero NO los comandos
  // programáticos del ribbon — por eso cada comando verifica soloLectura.

  cmd(comando: string): void {
    if (this.soloLectura) return;
    (this.editor?.chain().focus() as any)?.[comando]?.().run();
  }
  align(dir: 'left' | 'center' | 'right' | 'justify'): void {
    if (this.soloLectura) return;
    this.editor?.chain().focus().setTextAlign(dir).run();
  }
  setFontSize(event: Event): void {
    if (this.soloLectura) return;
    const size = (event.target as HTMLSelectElement).value;
    (this.editor?.chain().focus() as any)?.setMark?.('textStyle', { fontSize: `${size}pt` })?.run?.();
  }
  setHeading(event: Event): void {
    if (this.soloLectura) return;
    const val = parseInt((event.target as HTMLSelectElement).value);
    const chain = this.editor?.chain().focus();
    if (!chain) return;
    if (val === 0) chain.setParagraph().run();
    else (chain as any).setHeading({ level: val }).run();
  }
  setColor(event: Event): void {
    if (this.soloLectura) return;
    this.editor?.chain().focus().setColor((event.target as HTMLInputElement).value).run();
  }
  setHighlightColor(event: Event): void {
    if (this.soloLectura) return;
    this.editor?.chain().focus().setHighlight({ color: (event.target as HTMLInputElement).value }).run();
  }
  insertarTabla(): void {
    if (this.soloLectura) return;
    this.editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  toggleHeadingLevel(level: 1 | 2 | 3): void {
    if (this.soloLectura) return;
    (this.editor?.chain().focus() as any)?.toggleHeading?.({ level })?.run?.();
  }
  clearHeading(): void {
    if (this.soloLectura) return;
    this.editor?.chain().focus().setParagraph().run();
  }
  isHeadingLevel(level: 1 | 2 | 3): boolean {
    return this.editor?.isActive('heading', { level }) ?? false;
  }
  esExcel(): boolean { return this.nombreDoc?.toLowerCase().endsWith('.xlsx') || false; }
  esImagen(): boolean { return /\.(jpg|jpeg|png|gif|webp)$/i.test(this.nombreDoc || ''); }

  // ─── Utilidades ───────────────────────────────────────────────────────────

  private obtenerNombre(): string {
    try {
      const raw = sessionStorage.getItem('nexusflow_user') || localStorage.getItem('nexusflow_user') || '{}';
      const u = JSON.parse(raw);
      return u.nombre || u.nombre_completo || u.name || u.email || 'Usuario';
    } catch { return 'Usuario'; }
  }

  private colorPorNombre(nombre: string): string {
    const colores = ['#1a73e8', '#e53935', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#d81b60', '#0097a7'];
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    return colores[Math.abs(hash) % colores.length];
  }

  ngOnDestroy(): void {
    // Anunciar desconexion antes de destruir
    if (this.stompClient?.connected) {
      const docId = this.documentoKey.replace(/[^a-zA-Z0-9]/g, '-');
      try {
        this.stompClient.publish({
          destination: `/app/doc/${docId}/presencia`,
          body: JSON.stringify({ sessionId: this.miSessionId, nombre: this.miNombre, accion: 'desconectar' })
        });
      } catch {}
    }
    if (this.broadcastTimer) clearTimeout(this.broadcastTimer);
    if (this.excelBroadcastTimer) clearTimeout(this.excelBroadcastTimer);
    this.pageResizeObserver?.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
    this.stompClient?.deactivate();
    this.editor?.destroy();
    this.mouseLeaveTimers.forEach(t => clearTimeout(t));
  }
}
