import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmpresaService, Empresa, AdminData } from '../../core/services/empresa.service';

@Component({
  selector: 'app-superadmin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-8 max-w-7xl mx-auto font-sans">
      <div class="flex justify-between items-end mb-8">
        <div>
          <h1 class="text-3xl font-bold text-slate-800 font-headline">Panel SuperAdministrador</h1>
          <p class="text-slate-500 mt-1">Gestión global de SaaS, tenants y suscripciones</p>
        </div>
        <button (click)="openModal()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-sm transition-all hover:shadow-md">
          <span class="material-symbols-outlined text-[20px]">add_business</span>
          Registrar Nueva Empresa
        </button>
      </div>
      
      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <h3 class="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2 z-10">Empresas Activas</h3>
          <p class="text-4xl font-black text-slate-800 tracking-tight z-10">{{ empresas().length }}</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <h3 class="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2 z-10">Usuarios SaaS</h3>
          <p class="text-4xl font-black text-slate-800 tracking-tight z-10">--</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-purple-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <h3 class="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2 z-10">Flujos Totales</h3>
          <p class="text-4xl font-black text-slate-800 tracking-tight z-10">--</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col relative overflow-hidden group">
          <div class="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>
          <h3 class="text-slate-500 text-[11px] font-bold uppercase tracking-widest mb-2 z-10">Salud Sistema</h3>
          <p class="text-4xl font-black text-emerald-600 tracking-tight z-10">99.9%</p>
        </div>
      </div>

      <!-- Table Section -->
      <div class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 class="text-lg font-bold text-slate-800">Empresas Registradas (Tenants)</h2>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-widest">CU-04</span>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full min-w-[700px] text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th class="px-6 py-4 font-bold">Empresa / NIT</th>
                <th class="px-6 py-4 font-bold">Contacto</th>
                <th class="px-6 py-4 font-bold">Plan</th>
                <th class="px-6 py-4 font-bold">Estado</th>
                <th class="px-6 py-4 font-bold">Registro</th>
                <th class="px-6 py-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @if (isLoading()) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center text-slate-400">
                    <span class="animate-spin inline-block text-2xl mb-2">⏳</span>
                    <p class="text-sm">Cargando empresas...</p>
                  </td>
                </tr>
              } @else if (empresas().length === 0) {
                <tr>
                  <td colspan="6" class="px-6 py-12 text-center text-slate-400">
                    <span class="material-symbols-outlined text-4xl mb-2 block opacity-50">business_center</span>
                    <p class="text-sm">No hay empresas registradas aún.</p>
                  </td>
                </tr>
              } @else {
                @for (empresa of empresas(); track empresa.id) {
                  <tr class="hover:bg-slate-50 transition-colors group">
                    <td class="px-6 py-4">
                      <div class="font-bold text-slate-800 text-sm">{{ empresa.nombre_legal }}</div>
                      <div class="text-xs text-slate-500 mt-0.5">NIT: {{ empresa.nit }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-sm text-slate-700">{{ empresa.telefono }}</div>
                    </td>
                    <td class="px-6 py-4">
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider"
                            [ngClass]="empresa.plan_suscripcion === 'PREMIUM' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'">
                        {{ empresa.plan_suscripcion }}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <span class="flex items-center gap-1.5 text-sm font-medium"
                            [ngClass]="empresa.estado === 'ACTIVO' ? 'text-emerald-600' : 'text-amber-600'">
                        <span class="w-1.5 h-1.5 rounded-full" [ngClass]="empresa.estado === 'ACTIVO' ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                        {{ empresa.estado }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-sm text-slate-500">
                      {{ empresa.fecha_registro | date:'mediumDate' }}
                    </td>
                    <td class="px-6 py-4 text-right">
                      <button class="text-slate-400 hover:text-blue-600 transition-colors p-1" title="Ver Detalles">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                      </button>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- MODAL REGISTRO DUAL -->
    @if (isModalOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in-up">
          
          <div class="px-8 py-5 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10">
            <div>
              <h2 class="text-xl font-bold text-slate-800">Registrar Nueva Organización</h2>
              <p class="text-xs text-slate-500 mt-1">CU-04: Creación de Empresa + Primer Administrador</p>
            </div>
            <button (click)="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-8 flex-1">
            @if (errorMessage()) {
              <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium flex gap-3 items-start">
                <span class="material-symbols-outlined text-red-500 shrink-0">error</span>
                {{ errorMessage() }}
              </div>
            }

            <form (ngSubmit)="onSubmit()" class="flex flex-col gap-8">
              
              <!-- SECCIÓN 1: DATOS EMPRESA -->
              <section>
                <div class="flex items-center gap-3 mb-6">
                  <div class="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold">1</div>
                  <h3 class="text-lg font-bold text-slate-800">Datos del Tenant (Empresa)</h3>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre Legal <span class="text-red-500">*</span></label>
                    <input type="text" [(ngModel)]="newEmpresa.nombre_legal" name="nombre_legal" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">NIT / RUC <span class="text-red-500">*</span></label>
                    <input type="text" [(ngModel)]="newEmpresa.nit" name="nit" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Teléfono de Contacto</label>
                    <input type="text" [(ngModel)]="newEmpresa.telefono" name="telefono" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Plan de Suscripción</label>
                    <select [(ngModel)]="newEmpresa.plan_suscripcion" name="plan" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer">
                      <option value="BASIC">BASIC</option>
                      <option value="PRO">PRO</option>
                      <option value="PREMIUM">PREMIUM</option>
                    </select>
                  </div>
                  <div class="flex flex-col gap-1.5 md:col-span-2">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dirección Física</label>
                    <input type="text" [(ngModel)]="newEmpresa.direccion" name="direccion" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                  </div>
                </div>
              </section>

              <hr class="border-slate-100">

              <!-- SECCIÓN 2: DATOS ADMIN -->
              <section>
                <div class="flex items-center gap-3 mb-6">
                  <div class="w-8 h-8 rounded bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">2</div>
                  <div>
                    <h3 class="text-lg font-bold text-slate-800">Administrador de la Organización</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Esta cuenta tendrá acceso total al nuevo panel (ROL-ADMIN).</p>
                  </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div class="flex flex-col gap-1.5 md:col-span-2">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo del Admin <span class="text-red-500">*</span></label>
                    <input type="text" [(ngModel)]="newAdmin.nombre_completo" name="admin_nombre" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Correo (Usuario de Acceso) <span class="text-red-500">*</span></label>
                    <input type="email" [(ngModel)]="newAdmin.correo_electronico" name="admin_correo" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                  </div>
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Contraseña Inicial <span class="text-red-500">*</span></label>
                    <input type="password" [(ngModel)]="newAdmin.clave_hash" name="admin_pass" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all">
                  </div>
                </div>
              </section>

              <!-- FOOTER MODAL -->
              <div class="mt-4 pt-6 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button type="button" (click)="closeModal()" class="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" [disabled]="isSubmitting()" class="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors flex items-center gap-2 disabled:opacity-70">
                  @if (isSubmitting()) {
                    <span class="animate-spin text-lg">⏳</span> Creando...
                  } @else {
                    <span class="material-symbols-outlined text-[18px]">done_all</span> Finalizar Registro
                  }
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
export class SuperadminDashboardComponent implements OnInit {
  empresaService = inject(EmpresaService);

  empresas = signal<Empresa[]>([]);
  isLoading = signal(true);
  isModalOpen = signal(false);
  isSubmitting = signal(false);
  errorMessage = signal('');

  // Formularios
  newEmpresa: Empresa = this.getEmptyEmpresa();
  newAdmin: AdminData = this.getEmptyAdmin();

  ngOnInit() {
    this.cargarEmpresas();
  }

  cargarEmpresas() {
    this.isLoading.set(true);
    this.empresaService.obtenerEmpresas().subscribe({
      next: (data) => {
        this.empresas.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando empresas:', err);
        this.isLoading.set(false);
      }
    });
  }

  openModal() {
    this.newEmpresa = this.getEmptyEmpresa();
    this.newAdmin = this.getEmptyAdmin();
    this.errorMessage.set('');
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
  }

  onSubmit() {
    if (!this.newEmpresa.nombre_legal || !this.newEmpresa.nit || !this.newAdmin.nombre_completo || !this.newAdmin.correo_electronico || !this.newAdmin.clave_hash) {
      this.errorMessage.set('Por favor completa todos los campos obligatorios (*).');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    this.empresaService.registrarEmpresaConAdmin(this.newEmpresa, this.newAdmin).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.closeModal();
        this.cargarEmpresas(); // Recargar la tabla
        // Opcional: mostrar un toast de éxito
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err.error?.error || 'Ocurrió un error al registrar la empresa y el admin.');
        console.error(err);
      }
    });
  }

  private getEmptyEmpresa(): Empresa {
    return {
      nombre_legal: '',
      nit: '',
      telefono: '',
      direccion: '',
      estado: 'ACTIVO',
      plan_suscripcion: 'BASIC'
    };
  }

  private getEmptyAdmin(): AdminData {
    return {
      nombre_completo: '',
      correo_electronico: '',
      clave_hash: ''
    };
  }
}
