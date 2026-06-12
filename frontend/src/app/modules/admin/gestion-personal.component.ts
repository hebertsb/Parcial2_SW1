import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService, Usuario } from '../../core/services/usuario.service';
import { RolService, Rol } from '../../core/services/rol.service';
import { UnidadService, Unidad } from '../../core/services/unidad.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-gestion-personal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full bg-slate-50/50 dark:bg-slate-900">
      <!-- HEADER -->
      <div class="px-4 sm:px-8 pt-4 sm:pt-8 pb-4 border-b border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700">
        <h2 class="text-2xl sm:text-[2.75rem] font-bold text-slate-800 dark:text-white tracking-tight font-headline">Administración de la Organización</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">Configuración de niveles de acceso, perfiles de usuario y unidades operativas.</p>

        <!-- TABS -->
        <div class="flex gap-4 sm:gap-6 mt-6 overflow-x-auto pb-1 scrollbar-hide">
          <button (click)="activeTab.set('usuarios')" [ngClass]="activeTab() === 'usuarios' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'" class="pb-3 border-b-2 text-sm transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">group</span> Gestión de Usuarios
          </button>
          <button (click)="activeTab.set('roles')" [ngClass]="activeTab() === 'roles' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'" class="pb-3 border-b-2 text-sm transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">admin_panel_settings</span> Roles y Permisos
          </button>
          <button (click)="activeTab.set('unidades')" [ngClass]="activeTab() === 'unidades' ? 'border-blue-600 text-blue-600 font-bold' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'" class="pb-3 border-b-2 text-sm transition-all flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">account_tree</span> Unidades Organizacionales
          </button>
        </div>
      </div>

      <div class="p-4 sm:p-8 flex-1 overflow-y-auto">
        <!-- TAB: USUARIOS -->
        @if (activeTab() === 'usuarios') {
          <div class="animate-fade-in-up">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h3 class="text-xl font-bold text-slate-800 dark:text-white">Directorio de Personal</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">Crea cuentas para tus diseñadores, funcionarios y clientes.</p>
              </div>
              <button (click)="openModalUsuario()" class="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[18px]">person_add</span> Nuevo Usuario
              </button>
            </div>

            <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden">
              
              <!-- FILTROS Y BÚSQUEDA -->
              <div class="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col lg:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
                <div class="relative w-full lg:w-96 shrink-0">
                  <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input type="text" [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" placeholder="Buscar por nombre, correo..." class="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:placeholder-slate-500 shadow-sm">
                </div>
                
                <div class="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <span class="material-symbols-outlined text-slate-400 text-sm hidden sm:block">filter_list</span>
                  
                  <select [ngModel]="roleFilter()" (ngModelChange)="roleFilter.set($event)" class="flex-1 sm:flex-none w-full sm:w-auto min-w-[140px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-sm">
                    <option value="">Roles (Todos)</option>
                    @for(r of roles(); track r.id) {
                      <option [value]="r.id">{{ r.nombre_rol }}</option>
                    }
                  </select>

                  <select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)" class="flex-1 sm:flex-none w-full sm:w-auto min-w-[130px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-sm">
                    <option value="">Estado (Todos)</option>
                    <option value="activo">Solo Activos</option>
                    <option value="inactivo">Solo Inactivos</option>
                  </select>

                  <select [ngModel]="unidadFilter()" (ngModelChange)="unidadFilter.set($event)" class="flex-1 sm:flex-none w-full sm:w-auto min-w-[140px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-sm">
                    <option value="">Unidad (Todas)</option>
                    <option value="asignado">Con Unidad Asignada</option>
                    <option value="global">Global / Sin Unidad</option>
                  </select>
                </div>
              </div>

              <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-900/50 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                    <th class="px-4 sm:px-6 py-4 font-bold">Usuario / Correo</th>
                    <th class="px-4 sm:px-6 py-4 font-bold">Rol</th>
                    <th class="px-4 sm:px-6 py-4 font-bold">Unidad (Área)</th>
                    <th class="px-4 sm:px-6 py-4 font-bold">Estado</th>
                    <th class="px-4 sm:px-6 py-4 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  @for (u of filteredUsuarios(); track u.id) {
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <td class="px-6 py-4">
                        <div class="font-bold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                          <div class="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-xs font-bold uppercase">
                            {{ u.nombre_completo.charAt(0) }}
                          </div>
                          <div>
                            <div>{{ u.nombre_completo }}</div>
                            <div class="text-xs text-slate-500 dark:text-slate-400 font-normal">{{ u.correo_electronico }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-6 py-4">
                        <span class="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-100 dark:border-indigo-800">
                          {{ getNombreRol(u.rol_id) }}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        @if (u.unidad_id) {
                          <span class="font-medium text-slate-700 dark:text-slate-300">{{ getNombreUnidad(u.unidad_id) }}</span>
                        } @else {
                          <span class="text-slate-400 italic">Global / Sin Unidad</span>
                        }
                      </td>
                      <td class="px-6 py-4">
                        <span class="flex items-center gap-1.5 text-sm font-medium" [ngClass]="u.esta_activo ? 'text-emerald-600' : 'text-slate-400'">
                          <span class="w-1.5 h-1.5 rounded-full" [ngClass]="u.esta_activo ? 'bg-emerald-500' : 'bg-slate-300'"></span>
                          {{ u.esta_activo ? 'Activo' : 'Inactivo' }}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-right">
                        <button (click)="editarUsuario(u)" class="text-slate-400 hover:text-blue-600 transition-colors p-1" title="Editar">
                          <span class="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                        @if (u.esta_activo) {
                          <button (click)="abrirConfirmacion(u, 'desactivar')" class="text-slate-400 hover:text-red-600 transition-colors p-1 ml-2" title="Desactivar Usuario">
                            <span class="material-symbols-outlined text-[18px]">person_off</span>
                          </button>
                        } @else {
                          <button (click)="abrirConfirmacion(u, 'activar')" class="text-slate-400 hover:text-emerald-600 transition-colors p-1 ml-2" title="Reactivar Usuario">
                            <span class="material-symbols-outlined text-[18px]">person_check</span>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                  @if(filteredUsuarios().length === 0) {
                    <tr>
                      <td colspan="5" class="px-6 py-12 text-center text-slate-400 dark:text-slate-500">No se encontraron usuarios con esos filtros.</td>
                    </tr>
                  }
                </tbody>
              </table>
              </div>
            </div>
          </div>
        }

        <!-- TAB: ROLES -->
        @if (activeTab() === 'roles') {
          <div class="animate-fade-in-up">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h3 class="text-xl font-bold text-slate-800">Roles de la Organización</h3>
                <p class="text-sm text-slate-500">Configura qué pueden ver y hacer los usuarios en tu entorno.</p>
              </div>
              <button (click)="openModalRol()" class="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[18px]">add</span> Crear Nuevo Rol
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (r of roles(); track r.id) {
                <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col justify-between relative group">
                  
                  @if(!r.es_nucleo) {
                    <button (click)="abrirConfirmacionRol(r)" class="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white dark:bg-slate-800 rounded-full" title="Eliminar Rol">
                      <span class="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  }

                  <div>
                    <div class="flex justify-between items-start mb-4 pr-6">
                      <h4 class="font-bold text-slate-800 dark:text-white">{{ r.nombre_rol }}</h4>
                      @if(r.es_nucleo) {
                        <span class="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Sistema</span>
                      }
                    </div>
                    <div class="text-xs text-slate-500 mb-4">
                      Permisos asignados a este rol determinarán su acceso a menús y acciones.
                    </div>
                  </div>
                  
                  <div class="flex gap-2">
                    <button (click)="editarRol(r)" class="text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors uppercase tracking-wider">Editar Permisos</button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- TAB: UNIDADES -->
        @if (activeTab() === 'unidades') {
          <div class="animate-fade-in-up">
            <div class="flex justify-between items-center mb-6">
              <div>
                <h3 class="text-xl font-bold text-slate-800 dark:text-white">Organigrama y Unidades</h3>
                <p class="text-sm text-slate-500 dark:text-slate-400">Define la estructura de departamentos de tu empresa.</p>
              </div>
              <button (click)="openModalUnidad()" class="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm transition-all">
                <span class="material-symbols-outlined text-[18px]">add_circle</span> Añadir Unidad
              </button>
            </div>
            
            @if(unidades().length === 0) {
              <div class="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800">
                <span class="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-2">account_tree</span>
                <h3 class="text-lg font-bold text-slate-600 dark:text-slate-400">No hay unidades creadas</h3>
                <p class="text-sm text-slate-400 mt-1">Crea tu primer departamento para empezar a organizar tu empresa.</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (u of unidades(); track u.id) {
                  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm flex flex-col justify-between relative group" [class.opacity-60]="!u.esta_activa">
                    
                    @if(u.esta_activa) {
                      <button (click)="abrirConfirmacionUnidad(u, 'eliminar_unidad')" class="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white dark:bg-slate-800 rounded-full" title="Desactivar Unidad">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    } @else {
                      <button (click)="abrirConfirmacionUnidad(u, 'activar_unidad')" class="absolute top-4 right-4 text-slate-400 hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all p-1 bg-white dark:bg-slate-800 rounded-full" title="Reactivar Unidad">
                        <span class="material-symbols-outlined text-[18px]">restore</span>
                      </button>
                    }
                    
                    <div>
                      <div class="flex items-center gap-3 mb-4">
                        <div class="w-10 h-10 rounded-lg flex items-center justify-center font-bold" [ngClass]="u.esta_activa ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'">
                          {{ u.sigla || 'UN' }}
                        </div>
                        <div>
                          <h4 class="font-bold text-slate-800 dark:text-white">{{ u.nombre }}</h4>
                          <span class="text-[10px] uppercase font-bold tracking-wider" [ngClass]="u.esta_activa ? 'text-emerald-600' : 'text-red-500'">{{ u.esta_activa ? 'Activa' : 'Inactiva' }}</span>
                        </div>
                      </div>
                      <div class="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        @if(u.padre_id) {
                          Depende de: <strong class="text-slate-700 dark:text-slate-300">{{ getNombreUnidad(u.padre_id) }}</strong>
                        } @else {
                          Unidad Principal (Raíz)
                        }
                      </div>
                    </div>
                    
                    <div class="flex gap-2">
                      <button (click)="editarUnidad(u)" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 transition-colors uppercase tracking-wider">Editar Unidad</button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

      </div>
    </div>

    <!-- MODAL NUEVO USUARIO -->
    @if (isModalUsuarioOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in-up">
          <div class="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10">
            <div>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">Registrar Nuevo Personal</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">CU-05 / CU-07: Asignación de Roles y Unidades</p>
            </div>
            <button (click)="isModalUsuarioOpen.set(false)" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-8">
            <form (ngSubmit)="guardarUsuario()" class="flex flex-col gap-6">
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div class="flex flex-col gap-1.5 md:col-span-2">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre Completo <span class="text-red-500">*</span></label>
                  <input type="text" [(ngModel)]="newUsuario.nombre_completo" name="nombre" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                </div>
                
                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Correo Electrónico <span class="text-red-500">*</span></label>
                  <input type="email" [(ngModel)]="newUsuario.correo_electronico" name="correo" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Teléfono</label>
                  <input type="tel" [(ngModel)]="newUsuario.telefono" name="telefono" placeholder="+591 77777777" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sexo</label>
                  <select [(ngModel)]="newUsuario.sexo" name="sexo" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                    <option value="" disabled selected>Seleccione...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                    <option value="O">Otro</option>
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Contraseña de Acceso <span class="text-red-500" *ngIf="!newUsuario.id">*</span></label>
                  <input type="password" [(ngModel)]="newUsuario.clave_hash" name="clave" [required]="!newUsuario.id" [placeholder]="newUsuario.id ? 'Dejar en blanco para mantener actual' : ''" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol en el Sistema <span class="text-red-500">*</span></label>
                  <select [(ngModel)]="newUsuario.rol_id" name="rol" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                    <option value="" disabled selected>Seleccione un Rol...</option>
                    @for (r of roles(); track r.id) {
                      <option [value]="r.id">{{ r.nombre_rol }}</option>
                    }
                  </select>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unidad Organizacional</label>
                  <select [(ngModel)]="newUsuario.unidad_id" name="unidad" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white" [ngClass]="newUsuario.unidad_id ? 'text-slate-800 dark:text-white' : 'text-slate-400'">
                    <option value="">Ninguna / Rol Global</option>
                    @for (u of unidades(); track u.id) {
                      @if (u.esta_activa) {
                        <option [value]="u.id">{{ u.nombre }}</option>
                      }
                    }
                  </select>
                </div>
              </div>

              <div class="mt-4 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" (click)="isModalUsuarioOpen.set(false)" class="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" [disabled]="isSubmitting()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-70">
                   @if(isSubmitting()) { <span class="animate-spin material-symbols-outlined text-[18px]">sync</span> }
                   Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- MODAL NUEVO / EDITAR ROL -->
    @if (isModalRolOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col animate-fade-in-up">
          <div class="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur z-10">
            <div>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">{{ newRol.id ? 'Editar Rol' : 'Crear Nuevo Rol' }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Configuración de accesos y permisos</p>
            </div>
            <button (click)="isModalRolOpen.set(false)" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-8">
            <form (ngSubmit)="guardarRol()" class="flex flex-col gap-6">
              
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre del Rol <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="newRol.nombre_rol" name="nombre_rol" required [disabled]="!!newRol.id && !!newRol.es_nucleo" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white disabled:opacity-50">
                @if(newRol.id && newRol.es_nucleo) {
                   <p class="text-[10px] text-orange-500 mt-1">No puedes cambiar el nombre de un rol de sistema.</p>
                }
              </div>
              
              <div>
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-3">Permisos del Sistema</label>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                  @for (perm of availablePermissions; track perm.key) {
                    <label class="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded cursor-pointer transition-colors">
                      <input type="checkbox" [checked]="newRol.permisos?.[perm.key]" (change)="togglePermiso(perm.key, $event)" class="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500 dark:bg-slate-800">
                      <span class="text-sm font-medium text-slate-700 dark:text-slate-300">{{ perm.label }}</span>
                    </label>
                  }
                </div>
              </div>

              <div class="mt-4 pt-6 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" (click)="isModalRolOpen.set(false)" class="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button type="submit" [disabled]="isSubmittingRol()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors disabled:opacity-70">
                   @if(isSubmittingRol()) { <span class="animate-spin material-symbols-outlined text-[18px]">sync</span> }
                   Guardar Rol
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- MODAL NUEVA UNIDAD -->
    @if (isModalUnidadOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in-up">
          <div class="px-8 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
            <div>
              <h2 class="text-xl font-bold text-slate-800 dark:text-white">{{ newUnidad.id ? 'Editar Unidad' : 'Registrar Unidad' }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Configura el nombre y dependencia jerárquica.</p>
            </div>
            <button (click)="isModalUnidadOpen.set(false)" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <div class="p-8">
            <form (ngSubmit)="guardarUnidad()" class="flex flex-col gap-6">
              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre de Unidad <span class="text-red-500">*</span></label>
                <input type="text" [(ngModel)]="newUnidad.nombre" name="nombre" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Sigla (Corto)</label>
                <input type="text" [(ngModel)]="newUnidad.sigla" name="sigla" placeholder="Ej: RRHH, IT, MKT" maxlength="5" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Unidad Superior (Dependencia)</label>
                <select [(ngModel)]="newUnidad.padre_id" name="padre_id" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white">
                  <option value="">(Ninguna - Unidad Principal)</option>
                  @for(u of unidades(); track u.id) {
                    @if(u.id !== newUnidad.id) {
                      <option [value]="u.id">{{ u.nombre }}</option>
                    }
                  }
                </select>
              </div>

              <div class="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button type="button" (click)="isModalUnidadOpen.set(false)" class="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
                <button type="submit" [disabled]="isSubmittingUnidad()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70">
                  @if(isSubmittingUnidad()) { <span class="animate-spin">⏳</span> }
                  {{ newUnidad.id ? 'Guardar Cambios' : 'Crear Unidad' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- MODAL CONFIRMACIÓN -->
    @if (isConfirmModalOpen()) {
      <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in-up">
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-center">
          <div class="p-8 pb-6">
            <div class="w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4" [ngClass]="confirmAction() === 'activar' || confirmAction() === 'activar_unidad' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'">
              <span class="material-symbols-outlined text-3xl" [ngClass]="confirmAction() === 'activar' || confirmAction() === 'activar_unidad' ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'">
                {{ confirmAction() === 'activar' || confirmAction() === 'activar_unidad' ? 'person_check' : (confirmAction() === 'eliminar_rol' ? 'delete' : (confirmAction() === 'eliminar_unidad' ? 'delete' : 'person_off')) }}
              </span>
            </div>
            <h2 class="text-xl font-bold text-slate-800 dark:text-white mb-2">
              {{ confirmAction() === 'activar' ? '¿Reactivar Usuario?' : (confirmAction() === 'activar_unidad' ? '¿Reactivar Unidad?' : (confirmAction() === 'eliminar_rol' ? '¿Eliminar Rol?' : (confirmAction() === 'eliminar_unidad' ? '¿Desactivar Unidad?' : '¿Desactivar Usuario?'))) }}
            </h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              @if(confirmAction() === 'desactivar') {
                Estás a punto de desactivar a <strong class="dark:text-slate-300">{{ selectedUser()?.nombre_completo }}</strong>. Perderá el acceso al sistema hasta que sea reactivado.
              } @else if(confirmAction() === 'activar') {
                Estás a punto de reactivar a <strong class="dark:text-slate-300">{{ selectedUser()?.nombre_completo }}</strong>. Podrá volver a acceder al sistema.
              } @else if(confirmAction() === 'activar_unidad') {
                Estás a punto de reactivar la unidad <strong class="dark:text-slate-300">{{ selectedUnidad()?.nombre }}</strong>. Podrá ser asignada nuevamente.
              } @else if(confirmAction() === 'eliminar_rol') {
                Estás a punto de eliminar el rol <strong class="dark:text-slate-300">{{ selectedRol()?.nombre_rol }}</strong>. Esta acción no se puede deshacer.
              } @else if(confirmAction() === 'eliminar_unidad') {
                Estás a punto de desactivar la unidad <strong class="dark:text-slate-300">{{ selectedUnidad()?.nombre }}</strong>. Esta acción la ocultará de futuras asignaciones.
              }
            </p>
          </div>
          <div class="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex gap-3">
            <button (click)="isConfirmModalOpen.set(false)" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button (click)="ejecutarAccionConfirmada()" [disabled]="isSubmitting()" class="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white transition-colors flex items-center justify-center gap-2" [ngClass]="confirmAction() === 'activar' || confirmAction() === 'activar_unidad' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'">
              @if(isSubmitting()) { <span class="animate-spin material-symbols-outlined text-[18px]">sync</span> }
              {{ confirmAction() === 'activar' || confirmAction() === 'activar_unidad' ? 'Sí, Reactivar' : (confirmAction() === 'eliminar_rol' ? 'Sí, Eliminar' : 'Sí, Desactivar') }}
            </button>
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
export class GestionPersonalComponent implements OnInit {
  activeTab = signal<'usuarios'|'roles'|'unidades'>('usuarios');
  
  usuarioService = inject(UsuarioService);
  rolService = inject(RolService);
  unidadService = inject(UnidadService);
  authService = inject(AuthService);

  usuarios = signal<Usuario[]>([]);
  roles = signal<Rol[]>([]);
  unidades = signal<Unidad[]>([]);
  
  isModalUsuarioOpen = signal(false);
  isModalRolOpen = signal(false);
  isModalUnidadOpen = signal(false);
  isConfirmModalOpen = signal(false);
  isSubmitting = signal(false);
  isSubmittingRol = signal(false);
  isSubmittingUnidad = signal(false);
  empresaId = '';

  searchTerm = signal('');
  roleFilter = signal('');
  statusFilter = signal('');
  unidadFilter = signal('');

  filteredUsuarios = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();
    const unidad = this.unidadFilter();

    return this.usuarios().filter(u => {
      const matchesTerm = u.nombre_completo.toLowerCase().includes(term) || 
                          u.correo_electronico.toLowerCase().includes(term);
      const matchesRole = role ? u.rol_id === role : true;
      
      let matchesStatus = true;
      if (status === 'activo') matchesStatus = u.esta_activo === true;
      if (status === 'inactivo') matchesStatus = u.esta_activo === false;

      let matchesUnidad = true;
      if (unidad === 'asignado') matchesUnidad = !!u.unidad_id;
      if (unidad === 'global') matchesUnidad = !u.unidad_id;

      return matchesTerm && matchesRole && matchesStatus && matchesUnidad;
    });
  });

  confirmAction = signal<'desactivar'|'activar'|'eliminar_rol'|'eliminar_unidad'|'activar_unidad'>('desactivar');
  selectedUser = signal<Usuario | null>(null);
  selectedRol = signal<Rol | null>(null);
  selectedUnidad = signal<Unidad | null>(null);

  newUsuario: Partial<Usuario> = {};
  newRol: Partial<Rol> = { permisos: {} };
  newUnidad: Partial<Unidad> = { esta_activa: true };

  availablePermissions = [
    { key: 'GESTION_USUARIOS', label: 'Gestión de Usuarios' },
    { key: 'GESTION_POLITICAS', label: 'Gestión de Políticas' },
    { key: 'DISENO_WORKFLOW', label: 'Diseño de Workflow' },
    { key: 'GESTION_FORMULARIOS', label: 'Gestión de Formularios' },
    { key: 'EDITAR_FORMULARIO', label: 'Editar Formulario' },
    { key: 'VER_FORMULARIO', label: 'Ver Formulario' },
    { key: 'INICIAR_TRAMITE', label: 'Iniciar Trámite' },
    { key: 'SUBIR_DOCUMENTOS', label: 'Subir Documentos' }
  ];

  ngOnInit() {
    const perfil = this.authService.getUsuario();
    this.empresaId = perfil?.empresa || 'DEFAULT_EMPRESA';
    this.cargarDatos();
  }

  cargarDatos() {
    this.rolService.obtenerTodosLosRoles().subscribe(res => {
      // Filtrar el rol SUPER_ADMIN para que el admin de la empresa no pueda asignarlo
      const rolesFiltrados = res.filter(r => r.id !== 'ROL-SUPER' && r.nombre_rol !== 'SUPER_ADMIN');
      this.roles.set(rolesFiltrados);
    });
    // Para motivos de la presentación, cargamos TODOS los usuarios (incluso si tienen distinto empresa_id en la base de datos).
    this.usuarioService.obtenerTodosLosUsuarios().subscribe(res => {
      // Filtrar el usuario super admin (ROL-SUPER) de la vista del cliente.
      const usuariosFiltrados = res.filter(u => u.rol_id !== 'ROL-SUPER');
      this.usuarios.set(usuariosFiltrados);
    });
    this.unidadService.obtenerTodasLasUnidades().subscribe(res => {
      this.unidades.set(res);
    });
  }

  getNombreRol(id: string): string {
    const rol = this.roles().find(r => r.id === id);
    return rol ? rol.nombre_rol : 'Desconocido';
  }

  getNombreUnidad(id: string): string {
    const unidad = this.unidades().find(u => u.id === id);
    return unidad ? unidad.nombre : 'Desconocida';
  }

  openModalUsuario() {
    this.newUsuario = {
      nombre_completo: '',
      correo_electronico: '',
      clave_hash: '',
      telefono: '',
      sexo: '',
      rol_id: '',
      unidad_id: '',
      empresa_id: this.empresaId,
      esta_activo: true
    };
    this.isModalUsuarioOpen.set(true);
  }

  guardarUsuario() {
    if (!this.newUsuario.nombre_completo || !this.newUsuario.correo_electronico || !this.newUsuario.rol_id) {
      alert("Llene los campos obligatorios");
      return;
    }
    
    this.isSubmitting.set(true);

    const payload = { ...this.newUsuario };
    if (payload.unidad_id === '') {
      delete payload.unidad_id; // Evitar enviar un string vacío que rompa el UUID/ObjectId del backend
    }
    
    if (this.newUsuario.id) {
      // Editar
      this.usuarioService.actualizarUsuario(this.newUsuario.id, payload as Usuario).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalUsuarioOpen.set(false);
          this.cargarDatos();
        },
        error: (err) => {
          console.error(err);
          this.isSubmitting.set(false);
          alert("Error al actualizar usuario: " + (err.error?.error || err.message));
        }
      });
    } else {
      // Crear
      if(!this.newUsuario.clave_hash) { alert("La clave es obligatoria para nuevos usuarios"); this.isSubmitting.set(false); return; }
      this.usuarioService.registrarUsuario(payload as Usuario).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isModalUsuarioOpen.set(false);
          this.cargarDatos();
        },
        error: (err) => {
          console.error(err);
          this.isSubmitting.set(false);
          const errorDetails = err.error ? (typeof err.error === 'string' ? err.error : JSON.stringify(err.error)) : err.message;
          alert("Error al registrar usuario en el Backend: " + errorDetails);
        }
      });
    }
  }

  editarUsuario(u: Usuario) {
    // Es posible que el rol_id en la base de datos sea un objeto o un string.
    // Aseguramos de asignar el string correcto para que el Select lo reconozca.
    const rolIdString = typeof u.rol_id === 'object' ? (u.rol_id as any).id || (u.rol_id as any)._id : u.rol_id;
    
    // Mapeamos EXPLÍCITAMENTE todos los campos para evitar que campos del backend 
    // (como _id, rol_detalle, etc.) contaminen el formulario.
    this.newUsuario = { 
      id: u.id,
      nombre_completo: u.nombre_completo,
      correo_electronico: u.correo_electronico,   // ← Explícito para no perder el correo
      telefono: u.telefono || '',
      sexo: u.sexo || '',
      clave_hash: '',                              // No mostrar hash, vacío = mantener actual
      rol_id: rolIdString,
      unidad_id: u.unidad_id || '',               // '' = "Ninguna / Rol Global"
      empresa_id: u.empresa_id,
      esta_activo: u.esta_activo
    }; 
    this.isModalUsuarioOpen.set(true);
  }


  abrirConfirmacion(u: Usuario, accion: 'desactivar'|'activar') {
    this.selectedUser.set(u);
    this.confirmAction.set(accion);
    this.isConfirmModalOpen.set(true);
  }

  abrirConfirmacionRol(r: Rol) {
    this.selectedRol.set(r);
    this.confirmAction.set('eliminar_rol');
    this.isConfirmModalOpen.set(true);
  }

  abrirConfirmacionUnidad(u: Unidad, accion: 'eliminar_unidad'|'activar_unidad') {
    this.selectedUnidad.set(u);
    this.confirmAction.set(accion);
    this.isConfirmModalOpen.set(true);
  }

  ejecutarAccionConfirmada() {
    if (this.confirmAction() === 'eliminar_unidad') {
      const unidad = this.selectedUnidad();
      if (!unidad || !unidad.id) return;
      this.isSubmitting.set(true);
      this.unidadService.eliminarUnidad(unidad.id).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isConfirmModalOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          this.isSubmitting.set(false);
          alert("Error al desactivar unidad: " + (err.error?.error || err.message));
        }
      });
      return;
    }

    if (this.confirmAction() === 'activar_unidad') {
      const unidad = this.selectedUnidad();
      if (!unidad || !unidad.id) return;
      this.isSubmitting.set(true);
      const activada = { ...unidad, esta_activa: true };
      this.unidadService.actualizarUnidad(unidad.id, activada as Unidad).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isConfirmModalOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          this.isSubmitting.set(false);
          alert("Error al reactivar unidad: " + (err.error?.error || err.message));
        }
      });
      return;
    }

    if (this.confirmAction() === 'eliminar_rol') {
      const rol = this.selectedRol();
      if (!rol || !rol.id) return;
      this.isSubmitting.set(true);
      this.rolService.eliminarRol(rol.id).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isConfirmModalOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          this.isSubmitting.set(false);
          alert("Error al eliminar rol: " + (err.error?.error || err.message));
        }
      });
      return;
    }

    const user = this.selectedUser();
    if (!user || !user.id) return;

    this.isSubmitting.set(true);
    
    if (this.confirmAction() === 'desactivar') {
      this.usuarioService.desactivarUsuario(user.id).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isConfirmModalOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          this.isSubmitting.set(false);
          alert("Error al desactivar: " + (err.error?.error || err.message));
        }
      });
    } else {
      // Activar (haciendo un update)
      const activado = { ...user, esta_activo: true };
      this.usuarioService.actualizarUsuario(user.id, activado as Usuario).subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isConfirmModalOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          this.isSubmitting.set(false);
          alert("Error al reactivar: " + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- LÓGICA DE ROLES ---

  openModalRol() {
    this.newRol = {
      nombre_rol: '',
      es_nucleo: false,
      empresa_id: this.empresaId,
      permisos: {}
    };
    this.isModalRolOpen.set(true);
  }

  editarRol(r: Rol) {
    this.newRol = { 
      ...r,
      permisos: { ...r.permisos } // copia profunda de los permisos
    };
    this.isModalRolOpen.set(true);
  }

  openModalUnidad() {
    this.newUnidad = {
      nombre: '',
      sigla: '',
      esta_activa: true,
      empresa_id: this.empresaId,
      padre_id: ''
    };
    this.isModalUnidadOpen.set(true);
  }

  editarUnidad(u: Unidad) {
    this.newUnidad = { ...u };
    this.isModalUnidadOpen.set(true);
  }

  guardarUnidad() {
    if (!this.newUnidad.nombre) {
      alert("El nombre de la unidad es obligatorio");
      return;
    }
    
    this.isSubmittingUnidad.set(true);
    
    if (this.newUnidad.id) {
      this.unidadService.actualizarUnidad(this.newUnidad.id, this.newUnidad as Unidad).subscribe({
        next: () => {
          this.isSubmittingUnidad.set(false);
          this.isModalUnidadOpen.set(false);
          this.cargarDatos();
        },
        error: (err) => {
          this.isSubmittingUnidad.set(false);
          alert("Error al actualizar unidad: " + (err.error?.error || err.message));
        }
      });
    } else {
      this.unidadService.crearUnidad(this.newUnidad as Unidad).subscribe({
        next: () => {
          this.isSubmittingUnidad.set(false);
          this.isModalUnidadOpen.set(false);
          this.cargarDatos();
        },
        error: (err) => {
          this.isSubmittingUnidad.set(false);
          alert("Error al registrar unidad: " + (err.error?.error || err.message));
        }
      });
    }
  }

  togglePermiso(key: string, event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (!this.newRol.permisos) this.newRol.permisos = {};
    this.newRol.permisos[key] = isChecked;
  }

  guardarRol() {
    if (!this.newRol.nombre_rol) {
      alert("El nombre del rol es obligatorio.");
      return;
    }

    this.isSubmittingRol.set(true);
    
    if (this.newRol.id) {
      // Editar
      this.rolService.actualizarRol(this.newRol.id, this.newRol as Rol).subscribe({
        next: () => {
          this.isSubmittingRol.set(false);
          this.isModalRolOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          console.error(err);
          this.isSubmittingRol.set(false);
          alert("Error al actualizar rol: " + (err.error?.error || err.message));
        }
      });
    } else {
      // Crear
      this.newRol.empresa_id = this.empresaId;
      this.newRol.es_nucleo = false;
      this.rolService.crearRol(this.newRol as Rol).subscribe({
        next: () => {
          this.isSubmittingRol.set(false);
          this.isModalRolOpen.set(false);
          this.cargarDatos();
        },
        error: err => {
          console.error(err);
          this.isSubmittingRol.set(false);
          alert("Error al registrar rol: " + (err.error?.error || err.message));
        }
      });
    }
  }
}
