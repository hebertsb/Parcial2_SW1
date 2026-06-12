import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Ruta puente para notificaciones push (/notif-doc).
 * El Service Worker no sabe el rol del usuario que toca la notificación,
 * así que esta ruta lee el rol y redirige al editor colaborativo correcto:
 *  - ROL-FUNCIONARIO → bandeja del funcionario con el editor auto-abierto
 *  - ROL-CLIENTE     → detalle del trámite con el editor auto-abierto
 */
@Component({
  selector: 'app-notif-doc-redirect',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center h-full py-24 text-slate-400">
      <span class="material-symbols-outlined text-4xl animate-spin mb-3">progress_activity</span>
      <p class="text-sm">Abriendo documento...</p>
    </div>
  `
})
export class NotifDocRedirectComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const docKey = params.get('doc') ?? '';
    const nombre = params.get('nombre') ?? (docKey.split('/').pop() ?? 'Documento');

    // tramiteId: parámetro explícito o tercer segmento de la key (empresa/politica/tramite/archivo)
    let tramiteId = params.get('tramiteId') ?? '';
    if (!tramiteId) {
      const partes = docKey.split('/');
      if (partes.length >= 4) tramiteId = partes[2];
    }

    if (!docKey) {
      this.router.navigate(['/']);
      return;
    }

    if (this.auth.getRol() === 'ROL-FUNCIONARIO') {
      this.router.navigate(['/employee/inbox'], {
        queryParams: { abrirDoc: docKey, tramiteId, docNombre: nombre },
        replaceUrl: true
      });
    } else if (tramiteId) {
      this.router.navigate(['/tramites', tramiteId, 'detalle'], {
        queryParams: { abrirDoc: docKey },
        replaceUrl: true
      });
    } else {
      this.router.navigate(['/client/dashboard'], { replaceUrl: true });
    }
  }
}
