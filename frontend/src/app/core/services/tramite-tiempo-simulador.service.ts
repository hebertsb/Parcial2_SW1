import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TramiteTiempoSimuladorService {
  private readonly _horasSimuladas = signal(0);

  readonly horasSimuladas = computed(() => this._horasSimuladas());

  setHoras(horas: number): void {
    const valor = Number.isFinite(horas) ? Math.max(0, Math.trunc(horas)) : 0;
    this._horasSimuladas.set(valor);
  }

  sumarHoras(horas: number): void {
    this.setHoras(this._horasSimuladas() + horas);
  }

  reset(): void {
    this._horasSimuladas.set(0);
  }

  ahoraMs(): number {
    return Date.now() + (this._horasSimuladas() * 3600000);
  }
}