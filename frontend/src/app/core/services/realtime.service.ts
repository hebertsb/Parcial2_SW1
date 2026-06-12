/**
 * RealtimeService (STOMP sobre WebSocket/SockJS).
 *
 * Capa única que usan el editor de flujos (CU-09/10), el editor de formularios (CU-11)
 * y la ejecución del trámite (CU-14) para sincronizarse entre navegadores.
 *
 * Espera que el backend Spring Boot exponga el endpoint:
 *   ws://localhost:9090/ws   (registrado con registerStompEndpoints("/ws").withSockJS())
 *
 * Tópicos consumidos / publicados (ver BACKEND_WEBSOCKET_CONTRACT.md):
 *   /topic/editor/{politicaId}/cambios
 *   /topic/editor/{politicaId}/cursores
 *   /topic/editor/{formularioId}/cursores-form
 *   /topic/formulario/{formularioId}/campos
 *   /topic/tramite/{tramiteId}/estado
 *
 *   /app/editor/cambio
 *   /app/editor/cursor
 *   /app/editor/cursor-formulario
 *   /app/formulario/campo
 *   /app/tramite/estado
 */

import { Injectable, inject, signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Observable, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import {
  EditorCambioDto,
  CursorEditorDto,
  CursorFormularioDto,
  CampoFormularioMessage,
  EstadoTramiteMessage,
} from '../models/realtime.models';

const WS_URL = `${window.location.protocol}//${window.location.host}/ws`;

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private auth = inject(AuthService);
  private client: Client | null = null;
  private subs = new Map<string, StompSubscription>();

  /** Estado de conexión reactivo. */
  readonly connected = signal(false);
  readonly reconnecting = signal(false);

  /** Color estable por usuario para cursores remotos. */
  private _colorCache: string | null = null;

  /** Inicia conexión si no está abierta. Seguro de llamar varias veces. */
  connect(): void {
    if (this.client && this.client.active) return;

    this.client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as any,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {}, // silenciar logs; cambiar a console.log si se quiere ver tráfico
      connectHeaders: this.authHeaders(),
      onConnect: () => {
        this.connected.set(true);
        this.reconnecting.set(false);
      },
      onStompError: () => {
        this.reconnecting.set(true);
      },
      onWebSocketClose: () => {
        this.connected.set(false);
        this.reconnecting.set(true);
      },
    });

    this.client.activate();
  }

  disconnect(): void {
    this.subs.forEach((s) => s.unsubscribe());
    this.subs.clear();
    if (this.client) {
      this.client.deactivate();
      this.client = null;
    }
    this.connected.set(false);
  }

  private authHeaders(): Record<string, string> {
    const token = this.auth.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private ensureActive(): void {
    if (!this.client || !this.client.active) this.connect();
  }

  // ============================================================
  // Suscripciones genéricas
  // ============================================================

  private subscribe<T>(destination: string): Observable<T> {
    this.ensureActive();
    const subject = new Subject<T>();
    const tryBind = () => {
      if (!this.client || !this.client.connected) {
        setTimeout(tryBind, 250);
        return;
      }
      if (this.subs.has(destination)) return;
      const sub = this.client.subscribe(destination, (msg: IMessage) => {
        try {
          subject.next(JSON.parse(msg.body) as T);
        } catch {
          subject.next(msg.body as unknown as T);
        }
      });
      this.subs.set(destination, sub);
    };
    tryBind();
    return subject.asObservable();
  }

  private publish(destination: string, body: unknown): void {
    this.ensureActive();
    const tryPub = () => {
      if (!this.client || !this.client.connected) {
        setTimeout(tryPub, 250);
        return;
      }
      this.client.publish({
        destination,
        body: JSON.stringify(body),
      });
    };
    tryPub();
  }

  unsubscribe(destination: string): void {
    const sub = this.subs.get(destination);
    if (sub) {
      sub.unsubscribe();
      this.subs.delete(destination);
    }
  }

  // ============================================================
  // CU-09 / CU-10: colaboración del editor de flujos
  // ============================================================

  cambiosEditor(politicaId: string): Observable<EditorCambioDto> {
    return this.subscribe<EditorCambioDto>(
      `/topic/editor/${politicaId}/cambios`,
    );
  }

  emitirCambioEditor(cambio: EditorCambioDto): void {
    this.publish('/app/editor/cambio', {
      ...cambio,
      timestamp: Date.now(),
    });
  }

  cursoresEditor(politicaId: string): Observable<CursorEditorDto> {
    return this.subscribe<CursorEditorDto>(
      `/topic/editor/${politicaId}/cursores`,
    );
  }

  emitirCursor(cursor: CursorEditorDto): void {
    this.publish('/app/editor/cursor', cursor);
  }

  // ============================================================
  // CU-11: colaboración del editor de formularios
  // ============================================================

  camposFormulario(formularioId: string): Observable<CampoFormularioMessage> {
    return this.subscribe<CampoFormularioMessage>(
      `/topic/formulario/${formularioId}/campos`,
    );
  }

  emitirCampoFormulario(msg: CampoFormularioMessage): void {
    this.publish('/app/formulario/campo', msg);
  }

  cursoresFormulario(formularioId: string): Observable<CursorFormularioDto> {
    return this.subscribe<CursorFormularioDto>(
      `/topic/editor/${formularioId}/cursores-form`,
    );
  }

  emitirCursorFormulario(cursor: CursorFormularioDto): void {
    this.publish('/app/editor/cursor-formulario', cursor);
  }

  // ============================================================
  // CU-14: ejecución de trámites en tiempo real
  // ============================================================

  estadoTramite(tramiteId: string): Observable<EstadoTramiteMessage> {
    return this.subscribe<EstadoTramiteMessage>(
      `/topic/tramite/${tramiteId}/estado`,
    );
  }

  emitirEstadoTramite(msg: EstadoTramiteMessage): void {
    this.publish('/app/tramite/estado', msg);
  }

  bandejaUnidad(unidadId: string): Observable<{ tramiteId: string }> {
    return this.subscribe<{ tramiteId: string }>(`/topic/bandeja/${unidadId}`);
  }

  notificacionesUsuario(usuarioId: string): Observable<any> {
    return this.subscribe<any>(`/topic/notificaciones/${usuarioId}`);
  }

  // ============================================================
  // Utilidades
  // ============================================================

  /** Color estable (derivado del id de usuario) para dibujar cursores remotos. */
  colorParaUsuario(usuarioId: string): string {
    if (this._colorCache) return this._colorCache;
    const palette = [
      '#ef4444', '#f97316', '#f59e0b', '#10b981',
      '#14b8a6', '#0ea5e9', '#6366f1', '#8b5cf6',
      '#ec4899', '#22c55e', '#eab308', '#f43f5e',
    ];
    let hash = 0;
    for (let i = 0; i < usuarioId.length; i++) {
      hash = (hash * 31 + usuarioId.charCodeAt(i)) | 0;
    }
    this._colorCache = palette[Math.abs(hash) % palette.length];
    return this._colorCache;
  }
}
