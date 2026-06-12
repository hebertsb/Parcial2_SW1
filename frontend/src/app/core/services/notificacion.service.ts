import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { RealtimeService } from './realtime.service';

export interface NotificacionDTO {
  id: string;
  usuarioId?: string;
  tramiteId?: string;
  politicaId?: string;
  tipo?: string;
  titulo?: string;
  mensaje?: string;
  leida?: boolean;
  fechaCreacion?: string;
  icono?: string;
  color?: string;
  /** Clave MinIO del documento (para abrir el editor colaborativo directo) */
  docKey?: string;
  docNombre?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private realtime = inject(RealtimeService);
  private apiUrl = `${environment.apiUrl}/notificaciones`;

  /** Señal reactiva para el badge y la lista */
  notificaciones = signal<NotificacionDTO[]>([]);
  noLeidas = computed(() => this.notificaciones().filter(n => !n.leida).length);

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private wsSub: Subscription | null = null;

  // ── HTTP (Spring Boot) ─────────────────────────────────────────

  obtenerNoLeidas(): Observable<NotificacionDTO[]> {
    return this.http.get<NotificacionDTO[]>(`${this.apiUrl}/no-leidas`)
      .pipe(catchError(() => of([])));
  }

  obtenerTodas(): Observable<NotificacionDTO[]> {
    return this.http.get<NotificacionDTO[]>(`${this.apiUrl}/mis-notificaciones`)
      .pipe(catchError(() => of([])));
  }

  marcarComoLeida(id: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/leer`, {});
  }

  marcarTodasLeidas(): Observable<any> {
    return this.http.put(`${this.apiUrl}/marcar-todas-leidas`, {});
  }

  // ── Polling reactivo ───────────────────────────────────────────

  iniciarPolling(): void {
    this._cargar();
    this.intervalId = setInterval(() => this._cargar(), 30_000);
  }

  detenerPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  recargar(): void {
    this._cargar();
  }

  leerLocal(id: string): void {
    this.notificaciones.update(lista =>
      lista.map(n => n.id === id ? { ...n, leida: true } : n)
    );
    this.marcarComoLeida(id).subscribe();
  }

  leerTodasLocal(): void {
    this.notificaciones.update(lista => lista.map(n => ({ ...n, leida: true })));
    this.marcarTodasLeidas().subscribe(() => this._cargar());
  }

  /** Para agregar notificaciones locales desde el chatbot */
  agregarLocal(notif: Omit<NotificacionDTO, 'id'>): void {
    const nueva: NotificacionDTO = {
      ...notif,
      id: `local-${Date.now()}`,
      leida: false,
      fechaCreacion: new Date().toISOString(),
    };
    this.notificaciones.update(lista => [nueva, ...lista].slice(0, 60));
  }

  // ── WebSocket en tiempo real ───────────────────────────────────
  // Suscribe al topic /topic/notificaciones/{userId} para actualizar
  // el badge de la campana instantáneamente sin esperar el polling.

  conectarWebSocket(): void {
    const userId = this.subDelToken();
    if (!userId || this.wsSub) return;
    this._cargar(); // carga inicial
    this.realtime.connect();
    this.wsSub = this.realtime.notificacionesUsuario(userId).subscribe((notif: any) => {
      if (!notif?.id) return;
      this.notificaciones.update(lista => {
        if (lista.some(n => n.id === notif.id)) return lista;
        return [{ ...notif, leida: false } as NotificacionDTO, ...lista].slice(0, 60);
      });
    });
  }

  // ── Web Push global ────────────────────────────────────────────
  // Suscribe al usuario apenas entra a la app (no solo al abrir el editor),
  // para que las solicitudes de corrección le lleguen como push nativo
  // aunque esté en el panel principal o con la pestaña cerrada.

  private pushGlobalRegistrado = false;

  registrarPushGlobal(): void {
    if (this.pushGlobalRegistrado) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const usuarioId = this.subDelToken();
    if (!usuarioId) return;
    this.pushGlobalRegistrado = true;

    this.http.get<{ publicKey: string }>('/api/push/vapid-key').subscribe({
      next: async ({ publicKey }) => {
        try {
          const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

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

          this.http.post('/api/push/subscribe', {
            endpoint: subJson.endpoint,
            keys: subJson.keys,
            usuarioId,
            nombre: (this.auth.getUsuario() as any)?.nombre ?? '',
            docId: ''
          }).subscribe({ error: () => {} });
        } catch { /* permiso denegado o SW no disponible */ }
      },
      error: () => {}
    });
  }

  /** sub del JWT — mismo valor que auth.getName() en Spring (= cliente_id del trámite) */
  private subDelToken(): string {
    const t = this.auth.getToken();
    if (!t) return '';
    try { return JSON.parse(atob(t.split('.')[1])).sub ?? ''; } catch { return ''; }
  }

  private _cargar(): void {
    this.obtenerNoLeidas().subscribe({
      next: (lista) => {
        if (lista.length > 0 || this.notificaciones().length === 0) {
          // Fusionar: prioridad a las no leídas del backend + mantener las ya leídas en cache
          const idsNoLeidas = new Set(lista.map(n => n.id));
          const actuales = this.notificaciones().filter(n => !idsNoLeidas.has(n.id));
          this.notificaciones.set([...lista, ...actuales].slice(0, 60));
        }
      },
      error: () => {},
    });
  }
}
