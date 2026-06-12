import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PoliticaService, Politica } from '../../core/services/politica.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-politicas-negocio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-4 sm:gap-8 p-4 sm:p-8 max-w-[1600px] mx-auto w-full">
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-end">
        <div>
          <h2 class="text-2xl sm:text-[2.75rem] font-bold leading-none tracking-[-0.02em] text-slate-800 dark:text-white mb-2 font-headline">Políticas de Negocio</h2>
          <p class="text-sm text-slate-500 dark:text-slate-400 font-medium">Gestión y creación de los flujos principales de la organización.</p>
        </div>
        <button (click)="openModalPolitica()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all self-start sm:self-auto shrink-0">
          <span class="material-symbols-outlined text-[18px]">add</span> Nueva Política
        </button>
      </div>

      <!-- Buscador y Filtros -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div class="relative w-full md:w-96">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Buscar por nombre o tipo..." class="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
        </div>
      </div>

      <!-- Grid de Políticas -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @if (isLoading()) {
          <div class="col-span-full py-12 flex justify-center">
            <span class="material-symbols-outlined animate-spin text-4xl text-blue-500">sync</span>
          </div>
        } @else if (filteredPoliticas().length === 0) {
          <div class="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
            <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">account_tree</span>
            <h3 class="text-lg font-bold text-slate-600 dark:text-slate-400">No hay políticas creadas</h3>
            <p class="text-sm text-slate-400 mt-1">Registra la primera política de negocio para definir tus flujos.</p>
          </div>
        } @else {
          @for (p of filteredPoliticas(); track p.id) {
            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col justify-between relative group hover:border-blue-500 transition-colors cursor-pointer">
              
              <div>
                <div class="flex justify-between items-start mb-4">
                  <div class="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center border border-blue-100 dark:border-blue-800 text-blue-600 dark:text-blue-400">
                    <span class="material-symbols-outlined text-[24px]">schema</span>
                  </div>
                  <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md" [ngClass]="p.esta_activa ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'">
                    {{ p.esta_activa ? 'ACTIVA' : 'EN DISEÑO' }}
                  </span>
                </div>
                
                <h4 class="font-bold text-lg text-slate-800 dark:text-white mb-1">{{ p.nombre }}</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-medium font-label uppercase tracking-wider mb-4">{{ p.tipo_flujo || 'Tipo General' }}</p>

                <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg mb-3">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  <span>SLA: {{ p.duracion_estandar_dias ?? 5 }} días</span>
                </div>
                
                <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg">
                  <span class="material-symbols-outlined text-[14px]">calendar_today</span>
                  <span>Activada: {{ p.fecha_activacion ? (p.fecha_activacion | date:'mediumDate') : 'No activada' }}</span>
                </div>
              </div>
              
              <div class="flex gap-2 mt-6 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button (click)="editarPolitica(p)" class="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 py-2 rounded-md transition-colors">
                  <span class="material-symbols-outlined text-[16px]">edit</span> Editar
                </button>
                <button (click)="irADisenador(p)" class="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-white bg-slate-800 dark:bg-slate-600 hover:bg-black dark:hover:bg-slate-500 py-2 rounded-md transition-colors shadow-sm">
                  <span class="material-symbols-outlined text-[16px]">design_services</span> Diseñar Flujo
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- MODAL NUEVA POLITICA -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up">
          <div class="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">{{ isEditing() ? 'Editar Política de Negocio' : 'Crear Política de Negocio' }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Configura el nombre, el SLA y el estado de la política.</p>
            </div>
            <button (click)="isModalOpen.set(false)" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-8">
            <form (ngSubmit)="guardarPolitica()" class="flex flex-col gap-6">
              
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre de la Política <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="newPolitica.nombre" name="nombre" required placeholder="Ej: Proceso de Aprobación de Préstamos" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duración estándar (días) <span class="text-red-500">*</span></label>
                <input type="number" min="1" max="365" [(ngModel)]="newPolitica.duracion_estandar_dias" name="duracion_estandar_dias" required placeholder="Ej: 5" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Esta duración define el SLA y la fecha límite de todos los trámites creados con esta política.</p>
              </div>

              <!-- El Tipo de Flujo fue removido porque el Diagrama Visual define el comportamiento -->

              <!-- Switch para Estado -->
              <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div>
                  <p class="text-sm font-bold text-slate-800 dark:text-white">Estado de la Política</p>
                  <p class="text-[11px] text-slate-500 dark:text-slate-400">¿Esta política está lista para ser usada?</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" [(ngModel)]="newPolitica.esta_activa" name="esta_activa" class="sr-only peer">
                  <div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              <!-- Mensaje sobre el Diseño Visual -->
              <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
                <span class="material-symbols-outlined text-blue-500 dark:text-blue-400 mt-0.5">design_services</span>
                <div>
                  <h4 class="text-xs font-bold text-blue-800 dark:text-blue-300">Diseño del Flujo de Trabajo</h4>
                  <p class="text-[11px] text-blue-600 dark:text-blue-400 mt-1 leading-relaxed">
                    No necesitas programar nada. Una vez registrada esta política, podrás usar el botón <strong>"Diseñar Flujo"</strong> para dibujar tu proceso visualmente (arrastrando y soltando departamentos, tareas y condiciones) usando nuestra herramienta gráfica.
                  </p>
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 mt-2">
                <button type="button" (click)="isModalOpen.set(false)" class="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" [disabled]="isSubmitting()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70">
                  @if(isSubmitting()) { <span class="animate-spin material-symbols-outlined text-[18px]">sync</span> }
                  @else { <span class="material-symbols-outlined text-[18px]">design_services</span> }
                  {{ isEditing() ? 'Guardar cambios' : 'Crear y Diseñar Flujo' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in-up {
      animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class PoliticasNegocioComponent implements OnInit {
  politicaService = inject(PoliticaService);
  authService = inject(AuthService);
  router = inject(Router);
  
  politicas = signal<Politica[]>([]);
  isLoading = signal(true);
  isSubmitting = signal(false);
  isModalOpen = signal(false);
  isEditing = signal(false);
  editingPolicyId: string | null = null;
  
  searchTerm = signal('');
  
  newPolitica: Partial<Politica> = {
    nombre: '',
    tipo_flujo: '',
    esta_activa: true,
    duracion_estandar_dias: 5
  };

  empresaId = '';

  filteredPoliticas = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.politicas().filter(p => 
      p.nombre.toLowerCase().includes(term) || 
      (p.tipo_flujo && p.tipo_flujo.toLowerCase().includes(term))
    ).map(p => ({ ...p, id: p.id || (p as any)._id })); // Normalizar ID
  });

  ngOnInit() {
    const perfil = this.authService.getUsuario();
    this.empresaId = perfil?.empresa || 'DEFAULT_EMPRESA';
    this.cargarPoliticas();
  }

  cargarPoliticas() {
    this.isLoading.set(true);
    // Para motivos de administración global, cargamos todas las politicas en este panel.
    this.politicaService.obtenerTodasLasPoliticas().subscribe({
      next: (res) => {
        this.politicas.set(res);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error al cargar políticas:', err);
        this.isLoading.set(false);
      }
    });
  }

  openModalPolitica() {
    this.isEditing.set(false);
    this.editingPolicyId = null;
    this.newPolitica = {
      nombre: '',
      tipo_flujo: '',
      esta_activa: true,
      duracion_estandar_dias: 5,
      empresa_id: this.empresaId
    };
    this.isModalOpen.set(true);
  }

  editarPolitica(p: Politica) {
    this.isEditing.set(true);
    this.editingPolicyId = p.id || (p as any)._id || null;
    this.newPolitica = {
      ...p,
      duracion_estandar_dias: p.duracion_estandar_dias ?? 5,
      esta_activa: p.esta_activa ?? true
    };
    this.isModalOpen.set(true);
  }

  irADisenador(p: Politica) {
    const id = p.id || (p as any)._id;
    if (!id) {
      console.error('La política no tiene un ID válido:', p);
      alert('Error: La política seleccionada no tiene un ID válido.');
      return;
    }
    // Navegación al nuevo editor colaborativo (CU-09)
    this.router.navigate(['/designer/flow-editor', id]);
  }

  guardarPolitica() {
    if (!this.newPolitica.nombre) {
      alert("Por favor complete todos los campos obligatorios.");
      return;
    }

    // Autoasignamos el tipo de flujo porque el diagrama es el que manda
    this.newPolitica.tipo_flujo = 'Visual';

    const duracion = Number(this.newPolitica.duracion_estandar_dias ?? 5);
    this.newPolitica.duracion_estandar_dias = Number.isFinite(duracion) ? Math.min(365, Math.max(1, Math.trunc(duracion))) : 5;

    // El esquema de workflow se iniciará nulo o vacío
    // Se llenará visualmente en el Diseñador de Flujos (CU-09)
    this.newPolitica.esquema_workflow = null;

    this.isSubmitting.set(true);

    const request$ = this.isEditing() && this.editingPolicyId
      ? this.politicaService.actualizarPolitica(this.editingPolicyId, this.newPolitica as Politica)
      : this.politicaService.crearPolitica(this.newPolitica as Politica);

    request$.subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.isModalOpen.set(false);
        this.cargarPoliticas();

        if (!this.isEditing()) {
          // Redirigir inmediatamente al nuevo editor colaborativo de flujos (CU-09).
          this.router.navigate(['/designer/flow-editor', res.id]);
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error(err);
        alert("Error al guardar la política.");
      }
    });
  }
}
