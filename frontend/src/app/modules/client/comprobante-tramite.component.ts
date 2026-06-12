import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TramiteService } from '../../core/services/tramite.service';
import { AuthService } from '../../core/services/auth.service';
import { UsuarioService } from '../../core/services/usuario.service';
import { catchError, of } from 'rxjs';
import { RealtimeService } from '../../core/services/realtime.service';
import { TramiteTiempoSimuladorService } from '../../core/services/tramite-tiempo-simulador.service';

interface FirmaExtraida {
  imagen: string;
  label: string;
  key: string;
  esCliente: boolean;
  nodoId: string;
}

@Component({
  selector: 'app-comprobante-tramite',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  styles: [`
    @media print {
      /* Use direct sizing for print (avoid transform-scaling which breaks footer positioning) */
      .no-print { display: none !important; }
      .no-print-text { display: block !important; }
      html, body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 216mm !important;
        height: auto !important;
      }
      .no-print-bg {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 216mm !important;
        max-width: 216mm !important;
        overflow: visible !important;
      }
      .documento {
        box-shadow: none !important;
        border-radius: 0 !important;
        margin: 0 auto !important;
        width: 216mm !important;
        max-width: 216mm !important;
        transform: none !important;
        -webkit-transform: none !important;
        box-sizing: border-box !important;
        min-height: 0 !important;
      }
      /* Let content flow naturally; footer stays at the end of the document */
      .documento-body {
        padding: 6mm 8mm 14mm !important;
        box-sizing: border-box !important;
      }
      .print-footer {
        position: static !important;
        box-sizing: border-box !important;
        padding: 4px 10px !important;
        margin-top: 0 !important;
      }
      .print-header {
        padding: 14px 18px 10px !important;
      }
      .print-header .header-banner {
        margin-top: 12px !important;
        padding: 8px 14px !important;
      }
      .documento img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break {
        display: none !important;
      }
      .ultima-pagina {
        break-before: auto !important;
        page-break-before: auto !important;
        min-height: 0 !important;
        position: static !important;
      }
      .documento-body-segunda {
        padding-bottom: 0 !important;
      }
      .print-footer {
        position: fixed !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        z-index: 10 !important;
        display: block !important;
      }
      /* Prevent breaking inside critical blocks */
      .avoid-break, .firmas, .evidencias { page-break-inside: avoid !important; }
    }
    @page { size: 216mm 330mm portrait; margin: 0; }

    .no-print-text { display: none; }
    .print-footer { display: none; }

    .firma-input {
      border: none;
      border-bottom: 1px solid #94a3b8;
      background: transparent;
      text-align: center;
      font-weight: 600;
      font-size: 0.8rem;
      color: #1e293b;
      outline: none;
      width: 100%;
    }
    .firma-input:focus { border-bottom-color: #3b82f6; }
  `],
  template: `
    <!-- Barra de acciones (se oculta al imprimir) -->
    <div class="no-print fixed top-0 left-0 right-0 z-50 bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-xl">
      <div class="flex items-center gap-4">
        <a routerLink="/client/dashboard" class="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm">
          <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          Volver
        </a>
        <div class="h-4 w-px bg-slate-600"></div>
        <span class="text-sm font-medium">Vista previa del comprobante</span>
        @if (tramite()) {
          <span class="text-xs text-slate-400 font-mono">#{{ numeroComprobante() }}</span>
        }
      </div>
      <div class="flex items-center gap-3">
        @if (puedeImprimir()) {
          <p class="text-xs text-slate-400 hidden md:block">Puedes editar los nombres antes de imprimir</p>
          <button (click)="imprimir()" [disabled]="cargando()"
            class="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
            <span class="material-symbols-outlined text-[18px]">print</span>
            Imprimir / Guardar PDF
          </button>
        } @else {
          <div class="flex items-center gap-2 px-5 py-2 bg-slate-700 text-slate-400 rounded-lg text-sm font-bold cursor-not-allowed">
            <span class="material-symbols-outlined text-[18px]">lock</span>
            PDF no disponible
          </div>
        }
      </div>
    </div>

    <!-- Contenido principal -->
    <div class="min-h-screen bg-slate-200 pt-16 pb-12 px-4 no-print-bg">

      @if (horasSimuladas() > 0) {
        <div class="max-w-[980px] mx-auto mb-4 no-print">
          <div class="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 shadow-sm">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.08em] text-amber-700">Simulación de tiempo activa</p>
              <p class="text-sm text-amber-800">Se están adelantando +{{ horasSimuladas() }} h para probar el vencimiento y la semaforización.</p>
            </div>
            <button type="button" (click)="resetSimulacion()" class="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors">Restablecer</button>
          </div>
        </div>
      }

      @if (cargando()) {
        <div class="flex justify-center items-center py-24">
          <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }

      @if (!cargando() && tramite()) {

        @if (!puedeImprimir()) {
          <!-- Pantalla de bloqueo: no hay firma del funcionario -->
          <div class="max-w-[820px] mx-auto mt-12">
            <div class="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 flex flex-col items-center text-center gap-5">
              <div class="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-violet-500 text-[36px]">hourglass_empty</span>
              </div>
              <div>
                <p class="text-xl font-bold text-slate-800 mb-2">Comprobante no disponible</p>
                <p class="text-sm text-slate-500 max-w-md leading-relaxed">
                  Su trámite ha sido enviado al encargado del departamento.
                  El certificado final estará disponible una vez sea <strong>firmado por la autoridad correspondiente</strong>.
                </p>
              </div>
              <div class="w-full bg-violet-50 border border-violet-200 rounded-xl px-6 py-4 flex items-center gap-3">
                <span class="material-symbols-outlined text-violet-500 text-[20px]">info</span>
                <p class="text-sm text-violet-800">
                  El PDF final se generará automáticamente cuando el funcionario apruebe y firme el trámite.
                </p>
              </div>
              <a routerLink="/client/dashboard"
                class="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors mt-2">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                Volver al panel
              </a>
            </div>
          </div>
        } @else {

        <div class="documento max-w-[980px] mx-auto bg-white shadow-2xl rounded-sm" style="min-height: auto;">

          <!-- ══════════════════════════════════════════════════════════════ -->
          <!-- PÁGINA 1                                                        -->
          <!-- ══════════════════════════════════════════════════════════════ -->

          <!-- Cabecera del documento -->
          <div class="print-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1d4ed8 100%); padding: 28px 32px 24px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">

              <!-- Logo y nombre -->
              <div>
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                  <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.4); border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                    <span style="color: white; font-weight: 900; font-size: 16px; font-family: monospace;">NF</span>
                  </div>
                  <div>
                    <div style="color: white; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; line-height: 1;">NexusFlow <span style="color: #60a5fa;">AI</span></div>
                    <div style="color: rgba(255,255,255,0.5); font-size: 10px; letter-spacing: 1px; text-transform: uppercase; margin-top: 2px;">Sistema de Gestión de Trámites</div>
                  </div>
                </div>
                <div style="color: rgba(255,255,255,0.4); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px;">
                  Universidad Autónoma Gabriel René Moreno &nbsp;·&nbsp; FICCT
                </div>
              </div>

              <!-- Número de comprobante + QR -->
              <div style="text-align: right;">
                <div style="color: rgba(255,255,255,0.5); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">N° Comprobante</div>
                <div style="color: white; font-size: 28px; font-weight: 900; letter-spacing: 2px; font-family: monospace;">#{{ numeroComprobante() }}</div>
                <!-- QR placeholder -->
                <div style="margin-top: 8px; width: 68px; height: 68px; border: 2px solid rgba(255,255,255,0.25); border-radius: 6px; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(255,255,255,0.05);">
                  <div style="display: grid; grid-template-columns: repeat(5,1fr); gap: 1.5px; padding: 6px;">
                    @for (cell of qrPattern; track $index) {
                      <div [style.background]="cell ? 'rgba(255,255,255,0.8)' : 'transparent'" style="width: 8px; height: 8px; border-radius: 1px;"></div>
                    }
                  </div>
                  <div style="color: rgba(255,255,255,0.4); font-size: 7px; text-transform: uppercase; letter-spacing: 1px;">Verificar</div>
                </div>
              </div>
            </div>

            <!-- Banner de estado -->
            <div class="header-banner" style="margin-top: 20px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: rgba(255,255,255,0.6); font-size: 11px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">Comprobante Oficial de Trámite</span>
              <span style="background: #22c55e; color: white; font-size: 10px; font-weight: 800; padding: 4px 12px; border-radius: 20px; letter-spacing: 2px; text-transform: uppercase;">
                {{ puedeImprimir() ? 'FINALIZADO / APROBADO' : (tramite().estado === 'finalizado' ? 'EN ESPERA' : (tramite().estado?.toUpperCase() || '—')) }}
              </span>
            </div>
          </div>

          <div class="documento-body" style="padding: 28px 32px;">

            <!-- ── Información del Trámite ── -->
            <div style="margin-bottom: 24px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #1d4ed8;">
                <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8;">Información del Trámite</span>
              </div>
              <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                  <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; width: 30%;">ID del Trámite</td>
                      <td style="padding: 10px 16px; background: white; font-size: 12px; font-weight: 600; color: #0f172a; font-family: monospace;">{{ tramite().id }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Tipo de Trámite</td>
                      <td style="padding: 10px 16px; background: white; font-size: 13px; font-weight: 700; color: #0f172a;">{{ tramite().nombre_tramite || '—' }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Cliente / Solicitante</td>
                      <td style="padding: 10px 16px; background: white; font-size: 13px; font-weight: 600; color: #0f172a;">{{ nombreCliente }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Funcionario que Atendió</td>
                      <td style="padding: 10px 16px; background: white; font-size: 13px; font-weight: 600; color: #0f172a;">{{ nombreFuncionario }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Fecha de Inicio</td>
                      <td style="padding: 10px 16px; background: white; font-size: 12px; font-weight: 600; color: #0f172a;">{{ formatFecha(tramite().fecha_inicio) }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Fecha Límite</td>
                      <td style="padding: 10px 16px; background: white; font-size: 12px; font-weight: 600; color: #0f172a;">{{ formatFecha(tramite().fecha_limite) }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Tiempo Restante</td>
                      <td style="padding: 10px 16px; background: white; font-size: 12px; font-weight: 600; color: #0f172a;">{{ tiempoRestanteTexto(tramite().fecha_limite) }}</td>
                    </tr>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Fecha de Conclusión</td>
                      <td style="padding: 10px 16px; background: white; font-size: 12px; font-weight: 600; color: #16a34a;">{{ formatFecha(tramite().fecha_fin) }}</td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 16px; background: #f8fafc; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">Estado Final</td>
                      <td style="padding: 10px 16px; background: white;">
                        <span style="display: inline-block; background: #dcfce7; color: #15803d; font-size: 10px; font-weight: 800; padding: 4px 14px; border-radius: 20px; letter-spacing: 1.5px; text-transform: uppercase;">FINALIZADO / APROBADO</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ── Historial de Pasos ── -->
            @if (tramite().historial?.length > 0) {
              <div style="margin-bottom: 24px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #1d4ed8;">
                  <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8;">✓ Historial de Pasos Completados</span>
                </div>

                @for (h of tramite().historial; track $index; let i = $index; let last = $last) {
                  <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                    <!-- Número -->
                    <div style="flex-shrink: 0; display: flex; flex-direction: column; align-items: center;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 13px;">{{ i + 1 }}</div>
                      @if (!last) {
                        <div style="width: 2px; flex: 1; background: #e2e8f0; margin: 4px 0; min-height: 12px;"></div>
                      }
                    </div>
                    <!-- Contenido -->
                    <div style="flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                      <div style="padding: 10px 14px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0;">
                        <div>
                          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">{{ h.nodoNombre || ('Paso ' + (i + 1)) }}</div>
                          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Completado: {{ formatFecha(h.completadoEn) }}</div>
                        </div>
                        <span style="background: #dcfce7; color: #16a34a; font-size: 9px; font-weight: 700; padding: 3px 10px; border-radius: 12px; letter-spacing: 1px; text-transform: uppercase;">✓ Completado</span>
                      </div>

                      @if (entradasSinFirmas(h.nodoId).length > 0) {
                        <div style="padding: 12px 14px;">
                          <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8; margin-bottom: 10px;">Datos ingresados</div>
                          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                            @for (entrada of entradasSinFirmas(h.nodoId); track entrada[0]) {
                              <div style="background: white; border: 1px solid #f1f5f9; border-radius: 6px; padding: 8px 10px;">
                                <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 3px;">{{ labelCampo(h.nodoId, entrada[0]) }}</div>
                                @if (esArchivo(entrada[1])) {
                                  <div style="display: flex; align-items: center; gap: 6px;">
                                    <span style="font-size: 14px;">{{ iconoArchivo(entrada[1]) }}</span>
                                    <span style="font-size: 11px; color: #3b82f6; font-weight: 600;">{{ nombreArchivo(entrada[1]) }}</span>
                                  </div>
                                } @else if (esBool(entrada[1])) {
                                  <div style="font-size: 12px; font-weight: 700; color: #16a34a;">✓ Sí</div>
                                } @else {
                                  <div style="font-size: 12px; font-weight: 600; color: #0f172a; word-break: break-word;">{{ formatValor(entrada[1]) }}</div>
                                }
                              </div>
                            }
                          </div>
                        </div>
                      } @else {
                        <div style="padding: 12px 14px; font-size: 11px; color: #94a3b8; font-style: italic;">Sin datos de formulario en este paso.</div>
                      }
                    </div>
                  </div>
                }
              </div>
            }

          </div>

          <!-- ══════════════════════════════════════════════════════════════ -->
          <!-- PÁGINA 2 — separador                                           -->
          <!-- ══════════════════════════════════════════════════════════════ -->
          <div class="ultima-pagina" style="padding: 0;">
            <div class="page-break" style="height: 24px; background: #f1f5f9; border-top: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">— Continúa en página 2 —</span>
            </div>

            <div class="documento-body documento-body-segunda" style="padding: 28px 32px 0;">
              <!-- ── Evidencias Adjuntas ── -->
              @if (evidencias().length > 0) {
                <div class="evidencias" style="margin-bottom: 24px; page-break-inside: avoid;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #1d4ed8;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8;">Evidencias Adjuntas</span>
                  </div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <thead>
                      <tr style="background: #0f172a;">
                        <th style="padding: 9px 12px; text-align: left; color: white; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;">Documento</th>
                        <th style="padding: 9px 12px; text-align: left; color: white; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;">Tipo</th>
                        <th style="padding: 9px 12px; text-align: left; color: white; font-size: 10px; letter-spacing: 1px; text-transform: uppercase;">Paso</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (ev of evidencias(); track $index) {
                        <tr [style.background]="$index % 2 === 0 ? '#f8fafc' : 'white'" style="border-bottom: 1px solid #e2e8f0;">
                          <td style="padding: 8px 12px; font-weight: 600; color: #1e40af;">{{ iconoArchivo(ev.nombre) }} {{ nombreArchivo(ev.nombre) }}</td>
                          <td style="padding: 8px 12px; color: #64748b;">{{ tipoArchivo(ev.nombre) }}</td>
                          <td style="padding: 8px 12px; color: #64748b;">{{ ev.paso }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- ── Firmas y Sellos ── -->
              <div class="firmas" style="page-break-inside: avoid;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding-bottom: 8px; border-bottom: 2px solid #1d4ed8;">
                  <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #1d4ed8;">Firmas y Sellos de Validación</span>
                </div>

                <div [style]="'display:grid; gap:24px; grid-template-columns: repeat(' + slotsFirma().length + ', 1fr)'">
                  @for (slot of slotsFirma(); track slot.key; let i = $index) {
                    <div style="text-align: center;">
                      <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; padding: 8px; background: #fafafa; margin-bottom: 8px; min-height: 90px; display: flex; align-items: center; justify-content: center;">
                        @if (slot.imagen) {
                          <img [src]="slot.imagen" style="max-height: 80px; max-width: 100%;" [alt]="slot.label">
                        }
                      </div>
                      <div style="border-top: 1.5px solid #334155; margin: 0 12px 6px;"></div>
                      <input class="firma-input no-print" [(ngModel)]="nombresSlots[i]" style="margin-bottom: 2px;">
                      <div class="no-print-text" style="font-size: 11px; font-weight: 700; color: #1e293b;">{{ nombresSlots[i] }}</div>
                      <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px;">{{ slot.rol }}</div>
                    </div>
                  }
                </div>
              </div>
            </div>

          </div>

          <div class="print-footer">
            <div style="background: rgba(15,23,42,0.98); border-top: 1px solid rgba(148,163,184,0.25); padding: 6px 12px; display: flex; justify-content: space-between; align-items: center; color: white; min-height: 30px;">
              <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                <div style="width: 22px; height: 22px; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                  <span style="font-size: 9px; font-weight: 800; letter-spacing: 1px;">NF</span>
                </div>
                <div style="min-width: 0;">
                  <div style="font-size: 10px; font-weight: 700; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">NexusFlow</div>
                  <div style="color: #cbd5e1; font-size: 8px; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Sistema de Gestión de Trámites</div>
                </div>
              </div>
              <div style="text-align: right; min-width: 0;">
                <div style="color: #e2e8f0; font-size: 8px; white-space: nowrap; line-height: 1.05;">Generado el {{ fechaGeneracion }}</div>
                <div style="color: #94a3b8; font-size: 8px; white-space: nowrap; line-height: 1.05;">NexusFlow v2.4.0 · Documento oficial</div>
              </div>
            </div>
          </div>

        </div>
        } <!-- end @else puedeImprimir -->
      }
    </div>
  `
})
export class ComprobanteTramiteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private tramiteSvc = inject(TramiteService);
  private authSvc = inject(AuthService);
  private usuarioSvc = inject(UsuarioService);
  private realtime = inject(RealtimeService);
  private simulador = inject(TramiteTiempoSimuladorService);

  tramite = signal<any>(null);
  cargando = signal(true);
  private tick = signal(0);
  private relojId: number | null = null;
  nombreCliente = '';
  nombreFuncionario = '—';
  nombreSupervisor = 'Director / Gerente';
  nombresSlots: string[] = [];
  fechaGeneracion = new Date().toLocaleString('es-BO');
  private tramiteSeguimientoId: string | null = null;
  horasSimuladas = this.simulador.horasSimuladas;

  /** Patrón decorativo tipo QR (5x5) — solo visual */
  qrPattern = [
    1,1,1,1,1,
    1,0,0,0,1,
    1,0,1,0,1,
    1,0,0,0,1,
    1,1,1,1,1
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.tramiteSeguimientoId = id || null;
    this.realtime.connect();
    this.relojId = window.setInterval(() => this.tick.update(v => v + 1), 60000);
    this.tramiteSvc.obtenerDetalle(id).subscribe({
      next: (t: any) => {
        this.tramite.set(t);
        this.cargando.set(false);
        const usuario = this.authSvc.getUsuario();
        this.nombreCliente = usuario?.nombre ?? t.cliente_nombre ?? 'Cliente / Titular';
        this.resolverNombreFuncionario(t);
        this.inicializarNombresSlots(t);
        this.escucharEstadoTramite(id);
      },
      error: () => this.cargando.set(false)
    });
  }

  ngOnDestroy(): void {
    if (this.relojId !== null) {
      window.clearInterval(this.relojId);
    }
    if (this.tramiteSeguimientoId) {
      this.realtime.unsubscribe(`/topic/tramite/${this.tramiteSeguimientoId}/estado`);
    }
  }

  resetSimulacion(): void {
    this.simulador.reset();
  }

  private escucharEstadoTramite(id: string): void {
    if (!id) return;

    this.realtime.estadoTramite(id).subscribe(() => {
      this.tramiteSvc.obtenerDetalle(id).subscribe({
        next: (actualizado: any) => {
          this.tramite.set(actualizado);
          this.resolverNombreFuncionario(actualizado);
        }
      });
    });
  }

  private resolverNombreFuncionario(t: any): void {
    const historial: any[] = t?.historial ?? [];
    const entradaFuncionario = historial.find((h: any) => {
      const actor = h?.completadoPor;
      return !!actor && actor !== t?.cliente_id;
    });

    const nombreHistorial = entradaFuncionario?.completadoPorNombre ?? entradaFuncionario?.completado_por_nombre;
    const nombreAsignado = t?.funcionario_asignado_nombre
      ?? t?.funcionarioAsignadoNombre
      ?? t?.funcionario_nombre
      ?? t?.responsable_nombre;
    const nombreDesdeDatos = this.buscarNombreFuncionarioEnDatos(t?.datos_formulario ?? {});

    if (nombreHistorial && String(nombreHistorial).trim().length > 0) {
      this.nombreFuncionario = String(nombreHistorial).trim();
      return;
    }

    if (nombreAsignado && String(nombreAsignado).trim().length > 0) {
      this.nombreFuncionario = String(nombreAsignado).trim();
      return;
    }

    if (nombreDesdeDatos) {
      this.nombreFuncionario = nombreDesdeDatos;
      return;
    }

    const funcionarioId = t?.funcionario_asignado_id ?? entradaFuncionario?.completadoPor;
    if (funcionarioId) {
      this.usuarioSvc.obtenerUsuario(funcionarioId)
        .pipe(catchError(() => of(null)))
        .subscribe((u: any) => {
          const nombre = u?.nombre_completo ?? u?.nombre;
          if (nombre && String(nombre).trim().length > 0) {
            this.nombreFuncionario = String(nombre).trim();
          }
        });
    }
  }

  inicializarNombresSlots(t?: any): void {
    const firmas = this.firmasParaComprobante();
    const usuario = this.authSvc.getUsuario();
    const tramiteActual = t ?? this.tramite();
    const clienteNombre = usuario?.nombre ?? tramiteActual?.cliente_nombre ?? 'Cliente / Titular';
    const historial: any[] = tramiteActual?.historial ?? [];
    const funcNombreGlobal = this.nombreFuncionario && this.nombreFuncionario !== '—'
      ? this.nombreFuncionario : 'Funcionario Responsable';

    if (firmas.length === 0) {
      this.nombresSlots = [clienteNombre, funcNombreGlobal];
      return;
    }

    this.nombresSlots = firmas.map(f => {
      const esCliente = f.esCliente || /(cliente|titular|solicitante)/i.test(`${f.key} ${f.label}`);
      if (esCliente) return clienteNombre;
      if (/(gerente|director|supervisor)/i.test(`${f.key} ${f.label}`)) return 'Director / Gerente';
      // Look up who completed this specific node to get the correct signer name
      if (f.nodoId) {
        const entradaNodo = historial.find((h: any) => h.nodoId === f.nodoId);
        const nombreNodo = entradaNodo?.completadoPorNombre ?? entradaNodo?.completado_por_nombre;
        if (nombreNodo && String(nombreNodo).trim().length > 0) return String(nombreNodo).trim();
      }
      return funcNombreGlobal;
    });
  }

  private buscarNombreFuncionarioEnDatos(datos: any): string | null {
    if (!datos || typeof datos !== 'object') return null;

    const clavesPrioritarias = [
      'nombre_funcionario',
      'funcionario_nombre',
      'responsable_nombre',
      'nombre_responsable',
      'nombre_encargado',
      'encargado_nombre'
    ];

    for (const clave of clavesPrioritarias) {
      const val = datos?.[clave];
      if (typeof val === 'string' && val.trim().length > 0) {
        return val.trim();
      }
    }

    for (const [key, value] of Object.entries(datos)) {
      if (typeof value === 'string') {
        const k = key.toLowerCase();
        if ((k.includes('nombre') || k.includes('funcionario') || k.includes('responsable')) && value.trim().length > 0) {
          return value.trim();
        }
      } else if (value && typeof value === 'object') {
        const profundo = this.buscarNombreFuncionarioEnDatos(value);
        if (profundo) return profundo;
      }
    }

    return null;
  }

  numeroComprobante = computed(() => {
    const id = this.tramite()?.id ?? '';
    return id.substring(0, 8).toUpperCase();
  });

  /** Extrae todas las firmas con clasificación correcta usando completadoPor del historial */
  firmasParaComprobante = computed((): FirmaExtraida[] => {
    const t = this.tramite();
    if (!t) return [];
    const clienteId: string = t.cliente_id;
    const resultado: FirmaExtraida[] = [];
    const respuestas: Record<string, any> = t.respuestas_por_nodo ?? {};
    const labelsNodo: Record<string, any> = t.labels_por_nodo ?? {};
    const historial: any[] = t.historial ?? [];

    for (const nodoId of Object.keys(respuestas)) {
      // Determinar quién completó este nodo
      const entrada = historial.find((h: any) => h.nodoId === nodoId);
      const completadoPor: string | undefined = entrada?.completadoPor;
      // Considerar cliente SOLO si completadoPor === clienteId (no asumir por defecto cuando es undefined)
      const esPorCliente = (completadoPor !== undefined && completadoPor === clienteId);

      const nodoRespuestas = respuestas[nodoId] ?? {};
      for (const [key, val] of Object.entries(nodoRespuestas)) {
        if (key.startsWith('__')) continue;
        if (typeof val === 'string' && val.startsWith('data:image')) {
          const label = labelsNodo[nodoId]?.[key]
            ?? labelsNodo[nodoId]?.[key.toUpperCase()]
            ?? (nodoRespuestas['__LABELS__']?.[key])
            ?? key;
          const textoRol = `${key} ${label}`.toLowerCase();
          const esClientePorClave = /(cliente|titular|solicitante)/i.test(textoRol);
          const esFuncionarioPorClave = /(funcionario|responsable|encargado|empleado)/i.test(textoRol);
          const esCliente = esClientePorClave || (!esFuncionarioPorClave && esPorCliente);
          resultado.push({ imagen: val, label, key, esCliente, nodoId });
        }
      }
    }
    const datosFormulario: Record<string, any> = t.datos_formulario ?? {};
    for (const [key, val] of Object.entries(datosFormulario)) {
      if (typeof val !== 'string' || !val.startsWith('data:image')) continue;

      const yaExiste = resultado.some(f => f.imagen === val);
      if (yaExiste) continue;

      const textoRol = `${key}`.toLowerCase();
      const esCliente = /(cliente|titular|solicitante)/i.test(textoRol);
      resultado.push({ imagen: val, label: key, key, esCliente, nodoId: '' });
    }

    return resultado;
  });

  buscarLabelGlobal(key: string): string {
    const t = this.tramite();
    if (!t) return key;
    const labelsNodo = t.labels_por_nodo ?? {};
    for (const nodoId of Object.keys(labelsNodo)) {
      const l = labelsNodo[nodoId]?.[key] 
             ?? labelsNodo[nodoId]?.[key.toLowerCase()] 
             ?? labelsNodo[nodoId]?.[key.toUpperCase()];
      if (l) return l;
    }
    const respuestas = t.respuestas_por_nodo ?? {};
    for (const nodoId of Object.keys(respuestas)) {
      const labelsInline = respuestas[nodoId]?.['__LABELS__'] ?? respuestas[nodoId]?.['__labels__'] ?? {};
      const l = labelsInline[key] ?? labelsInline[key.toLowerCase()] ?? labelsInline[key.toUpperCase()];
      if (l) return l;
    }
    return key;
  }

  firmaCliente = computed(() => {
    const firmas = this.firmasParaComprobante();
    const porClave = firmas.find(f => /(cliente|titular|solicitante)/i.test(`${f.key} ${f.label}`));
    if (porClave) return porClave.imagen;
    const porBandera = firmas.find(f => f.esCliente);
    if (porBandera) return porBandera.imagen;
    return firmas[0]?.imagen ?? null;
  });
  firmasNoCliente = computed(() => this.firmasParaComprobante().filter(f => !f.esCliente));

  /** Slots dinámicos de firma: uno por cada firma extraída del trámite, con imagen y etiqueta de rol */
  slotsFirma = computed((): { key: string; imagen: string | null; label: string; rol: string }[] => {
    const firmas = this.firmasParaComprobante();
    if (firmas.length === 0) {
      // Sin firmas: mostrar 2 slots vacíos por defecto
      return [
        { key: 'cliente', imagen: null, label: this.nombreCliente || 'Cliente / Titular', rol: 'Cliente / Titular' },
        { key: 'funcionario', imagen: null, label: this.nombreFuncionario || 'Funcionario Responsable', rol: 'Funcionario Responsable' }
      ];
    }
    return firmas.map(f => {
      const esCliente = f.esCliente || /(cliente|titular|solicitante)/i.test(`${f.key} ${f.label}`);
      const rol = esCliente
        ? 'Cliente / Titular'
        : /(gerente|director|supervisor)/i.test(`${f.key} ${f.label}`)
          ? 'Director / Gerente'
          : /(funcionario|responsable|encargado|empleado)/i.test(`${f.key} ${f.label}`)
            ? 'Funcionario Responsable'
            : (f.label || f.key);
      return { key: f.key, imagen: f.imagen, label: f.label || f.key, rol };
    });
  });

  /** Firma del funcionario: guardada en datos_formulario via guardarDatos */
  firmaEmpleado = computed((): string | null => {
    const t = this.tramite();
    if (!t) return null;
    const firmaCliente = this.firmaCliente();
    const firmas = this.firmasParaComprobante();
    const porClave = firmas.find(f => /(funcionario|responsable|encargado|empleado)/i.test(`${f.key} ${f.label}`) && f.imagen !== firmaCliente);
    if (porClave) return porClave.imagen;

    const noCliente = firmas.find(f => !f.esCliente && f.imagen !== firmaCliente);
    if (noCliente) return noCliente.imagen;

    const datos: Record<string, any> = t.datos_formulario ?? {};
    const firmaEnDatos = this.buscarFirmaRecursiva(datos, ['funcionario', 'responsable', 'encargado', 'empleado']);
    if (firmaEnDatos && firmaEnDatos !== firmaCliente) return firmaEnDatos;

    const firmaEnCampoFirma = this.buscarFirmaRecursiva(datos, ['firma']);
    if (firmaEnCampoFirma && firmaEnCampoFirma !== firmaCliente) return firmaEnCampoFirma;

    // Fallback final: primera imagen encontrada en datos_formulario
    const cualquiera = this.buscarFirmaRecursiva(datos, []);
    return (cualquiera && cualquiera !== firmaCliente) ? cualquiera : null;
  });

  private buscarFirmaRecursiva(obj: any, palabrasClave: string[]): string | null {
    if (typeof obj === 'string') {
      return obj.startsWith('data:image') ? obj : null;
    }

    if (!obj || typeof obj !== 'object') {
      return null;
    }

    for (const [key, val] of Object.entries(obj)) {
      const clave = key.toLowerCase();
      if (palabrasClave.length > 0) {
        const coincide = palabrasClave.some(p => clave.includes(p));
        if (!coincide) {
          const profunda = this.buscarFirmaRecursiva(val, palabrasClave);
          if (profunda) return profunda;
          continue;
        }
      }

      const firma = this.buscarFirmaRecursiva(val, []);
      if (firma) return firma;
    }
    return null;
  }

  /** El PDF puede generarse cuando el trámite está finalizado */
  puedeImprimir = computed(() => {
    const t = this.tramite();
    return t?.estado === 'finalizado';
  });

  /** Archivos adjuntos extraídos de todas las respuestas */
  evidencias = computed(() => {
    const t = this.tramite();
    if (!t) return [];
    const resultado: { nombre: string; paso: string }[] = [];
    const respuestas: Record<string, any> = t.respuestas_por_nodo ?? {};
    const historial: any[] = t.historial ?? [];

    for (const nodoId of Object.keys(respuestas)) {
      const nodoRespuestas = respuestas[nodoId] ?? {};
      for (const val of Object.values(nodoRespuestas)) {
        if (typeof val === 'string' && !val.startsWith('data:') && this.esArchivo(val)) {
          const paso = historial.find((h: any) => h.nodoId === nodoId)?.nodoNombre ?? nodoId;
          if (!resultado.find(e => e.nombre === val)) {
            resultado.push({ nombre: val, paso });
          }
        }
      }
    }
    return resultado;
  });

  entradasSinFirmas(nodoId: string): [string, any][] {
    const respuestas = this.tramite()?.respuestas_por_nodo?.[nodoId] ?? {};
    return Object.entries(respuestas).filter(([k, v]) =>
      !k.startsWith('__') && !(typeof v === 'string' && v.startsWith('data:image'))
    );
  }

  labelCampo(nodoId: string, key: string): string {
    const t = this.tramite();
    return t?.labels_por_nodo?.[nodoId]?.[key]
      ?? t?.labels_por_nodo?.[nodoId]?.[key.toLowerCase()]
      ?? t?.labels_por_nodo?.[nodoId]?.[key.toUpperCase()]
      ?? (t?.respuestas_por_nodo?.[nodoId]?.['__LABELS__']?.[key])
      ?? (t?.respuestas_por_nodo?.[nodoId]?.['__labels__']?.[key])
      ?? humanizarClaveCampo(key);
  }

  imprimir(): void { window.print(); }

  nombreArchivo(ruta: string): string {
    if (!ruta) return ruta;
    return ruta.split('/').pop() || ruta;
  }

  esArchivo(val: any): boolean {
    if (typeof val !== 'string') return false;
    return /\.(jpg|jpeg|png|pdf|docx|xlsx|gif|webp|doc|xls)$/i.test(val);
  }

  iconoArchivo(nombre: string): string {
    const ext = (nombre ?? '').split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext ?? '')) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext ?? '')) return '📝';
    if (['xls','xlsx'].includes(ext ?? '')) return '📊';
    return '📎';
  }

  tipoArchivo(nombre: string): string {
    const ext = (nombre ?? '').split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext ?? '')) return 'image/' + ext;
    if (ext === 'pdf') return 'application/pdf';
    return 'archivo/' + ext;
  }

  esBool(val: any): boolean {
    return val === true || val === 'true' || val === 'Si' || val === 'Sí';
  }

  formatFecha(f: string | undefined): string {
    if (!f) return '—';
    try { return new Date(f).toLocaleString('es-BO'); } catch { return f ?? '—'; }
  }

  tiempoRestanteTexto(fechaLimite: string | undefined): string {
    this.tick();
    if (!fechaLimite) return '—';

    const limite = new Date(fechaLimite).getTime();
    if (Number.isNaN(limite)) return '—';

    const diferenciaMs = limite - this.simulador.ahoraMs();
    if (diferenciaMs <= 0) return 'Vencido';

    const horas = Math.floor(diferenciaMs / 3600000);
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;

    return dias > 0 ? `${dias} d ${horasRestantes} h` : `${horas} h`;
  }

  semaforoVisual(tramite: any): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    if (!tramite) return undefined;

    const inicio = this.obtenerFecha(tramite.fecha_inicio ?? tramite.fechaInicio);
    const limite = this.obtenerFecha(tramite.fecha_limite ?? tramite.fechaLimite);
    if (inicio === null || limite === null) {
      return this.normalizarSemaforo(tramite.semaforizacion);
    }

    const ahora = this.simulador.ahoraMs();
    if (ahora > limite) return 'Rojo';

    const total = limite - inicio;
    if (total <= 0) return 'Rojo';

    const porcentaje = (ahora - inicio) / total;
    if (porcentaje >= 0.75) return 'Rojo';
    if (porcentaje >= 0.40) return 'Amarillo';
    return 'Verde';
  }

  private obtenerFecha(fecha?: string): number | null {
    if (!fecha) return null;
    const valor = new Date(fecha).getTime();
    return Number.isNaN(valor) ? null : valor;
  }

  private normalizarSemaforo(valor?: string): 'Verde' | 'Amarillo' | 'Rojo' | undefined {
    const normalizado = (valor || '').trim().toLowerCase();
    if (normalizado === 'rojo') return 'Rojo';
    if (normalizado === 'amarillo') return 'Amarillo';
    if (normalizado === 'verde') return 'Verde';
    return undefined;
  }

  formatValor(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (Array.isArray(val)) return val.join(', ');
    return String(val);
  }
}

function humanizarClaveCampo(key: string): string {
  return (key || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/\b\w/g, letra => letra.toUpperCase()) || key;
}
