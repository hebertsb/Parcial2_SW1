import { Component, signal, inject } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { UsuarioService } from '../services/usuario.service';
import { EmpresaService, Empresa } from '../services/empresa.service';
import { LoginRequest } from '../../data/models/auth.model';

type Vista = 'login' | 'recover' | 'register';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="min-h-screen bg-[#F1F5F9] flex items-center justify-center p-4 sm:p-8 font-sans">
      <div class="w-full max-w-5xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex relative">

        <!-- Panel Izquierdo: Formularios -->
        <div class="w-full lg:w-1/2 bg-white flex flex-col justify-center p-8 sm:p-16">

          <!-- Logo -->
          <div class="flex items-center gap-2 mb-10">
            <div class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span class="material-symbols-outlined text-white text-sm">architecture</span>
            </div>
            <h1 class="text-xl font-bold text-slate-900 tracking-tight">NexusFlow</h1>
          </div>

          <!-- ===================== VISTA: LOGIN ===================== -->
          @if (vista() === 'login') {
            <h2 class="text-3xl font-bold text-slate-800 mb-1 font-headline">Bienvenido</h2>
            <p class="text-slate-500 text-sm mb-8">Inicia sesión para gestionar tus flujos.</p>

            @if (error()) {
              <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-sm text-red-700 font-medium">{{ error() }}</p>
              </div>
            }

            <form (ngSubmit)="onLogin()" class="flex flex-col gap-5" novalidate>
              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correo electrónico</label>
                <input type="email" name="email" placeholder="correo@empresa.com"
                  [(ngModel)]="email"
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  [disabled]="isLoading()">
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contraseña</label>
                <input type="password" name="password" placeholder="••••••••"
                  [(ngModel)]="password"
                  class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  [disabled]="isLoading()">
              </div>

              <div class="flex items-center justify-between mt-2 mb-6">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" [(ngModel)]="recordarSesion" name="recordar"
                    class="w-4 h-4 rounded border-slate-300 text-blue-600">
                  <span class="text-sm font-medium text-slate-600">Recordarme</span>
                </label>
                <button type="button" (click)="irA('recover')"
                  class="text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-blue-600 transition-colors">
                  ¿Olvidó su clave?
                </button>
              </div>

              <button type="submit" [disabled]="isLoading()"
                class="w-full py-4 bg-slate-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                @if (isLoading()) { <span class="animate-spin">⏳</span> Ingresando... }
                @else { Ingresar <span class="material-symbols-outlined text-lg">arrow_forward</span> }
              </button>
            </form>

            <div class="mt-8 pt-6 border-t border-slate-100 space-y-3 text-center text-sm">
              <p class="text-slate-500">
                ¿Eres cliente y no tienes cuenta?
                <button type="button" (click)="irA('register')"
                  class="font-bold text-blue-600 hover:text-blue-800 ml-1 transition-colors">
                  Regístrate aquí
                </button>
              </p>
              <p class="text-slate-400 text-xs">
                ¿Quieres consultar el trámite de un familiar?
                <a routerLink="/consulta-tramite"
                  class="font-bold text-slate-600 hover:text-blue-600 ml-1 transition-colors">
                  Consulta aquí →
                </a>
              </p>
            </div>
          }

          <!-- ===================== VISTA: RECUPERAR ===================== -->
          @if (vista() === 'recover') {
            <h2 class="text-3xl font-bold text-slate-800 mb-1 font-headline">Recuperar Acceso</h2>
            <p class="text-slate-500 text-sm mb-8">Ingresa tu correo para recibir una clave temporal.</p>

            @if (recoverySuccess()) {
              <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
                <p class="text-sm text-emerald-700 font-medium whitespace-pre-wrap">{{ recoverySuccess() }}</p>
              </div>
              <button type="button" (click)="irA('login')"
                class="mt-2 text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
                ← Volver al Login
              </button>
            } @else {
              @if (error()) {
                <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p class="text-sm text-red-700 font-medium">{{ error() }}</p>
                </div>
              }
              <form (ngSubmit)="onRecover()" class="flex flex-col gap-5" novalidate>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correo electrónico</label>
                  <input type="email" name="recoveryEmail" placeholder="tu-correo@empresa.com"
                    [(ngModel)]="email"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    [disabled]="isLoading()">
                </div>
                <button type="submit" [disabled]="isLoading() || !email"
                  class="mt-2 w-full py-3.5 bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                  @if (isLoading()) { <span class="animate-spin">⏳</span> Enviando... }
                  @else { Enviar token <span class="material-symbols-outlined text-lg">mail</span> }
                </button>
              </form>
              <div class="mt-6 text-center text-sm">
                <button type="button" (click)="irA('login')"
                  class="font-bold text-slate-500 hover:text-blue-600 transition-colors">
                  ← Volver al Login
                </button>
              </div>
            }
          }

          <!-- ===================== VISTA: REGISTRO CLIENTE ===================== -->
          @if (vista() === 'register') {
            <h2 class="text-3xl font-bold text-slate-800 mb-1 font-headline">Crear Cuenta</h2>
            <p class="text-slate-500 text-sm mb-8">Regístrate para iniciar tus trámites en línea.</p>

            @if (registerSuccess()) {
              <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mb-6">
                <p class="text-sm text-emerald-700 font-medium">
                  ¡Cuenta creada correctamente! Ya puedes iniciar sesión con tu correo y contraseña.
                </p>
              </div>
              <button type="button" (click)="irA('login')"
                class="mt-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
                Ir al Login →
              </button>
            } @else {
              @if (error()) {
                <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p class="text-sm text-red-700 font-medium">{{ error() }}</p>
                </div>
              }

              <form (ngSubmit)="onRegister()" class="flex flex-col gap-4" novalidate>

                <!-- Selector de empresa -->
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Empresa / Organización <span class="text-red-500">*</span>
                  </label>
                  @if (cargandoEmpresas()) {
                    <div class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-400">
                      Cargando empresas...
                    </div>
                  } @else {
                    <select name="regEmpresa" [(ngModel)]="regEmpresaId" [disabled]="isLoading()"
                      class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none cursor-pointer">
                      <option value="">— Seleccioná la empresa —</option>
                      @for (emp of empresasDisponibles(); track emp.id) {
                        <option [value]="emp.id">{{ emp.nombre_legal }}</option>
                      }
                    </select>
                  }
                  <p class="text-[10px] text-slate-400 mt-0.5">Elegí la organización donde querés realizar tus trámites.</p>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nombre completo <span class="text-red-500">*</span></label>
                  <input type="text" name="regNombre" placeholder="Ej: Juan Pérez García"
                    [(ngModel)]="regNombre"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    [disabled]="isLoading()">
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Correo electrónico <span class="text-red-500">*</span></label>
                  <input type="email" name="regEmail" placeholder="tu-correo@gmail.com"
                    [(ngModel)]="regEmail"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    [disabled]="isLoading()">
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Teléfono</label>
                  <input type="tel" name="regTelefono" placeholder="+591 777 12345"
                    [(ngModel)]="regTelefono"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    [disabled]="isLoading()">
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Contraseña <span class="text-red-500">*</span></label>
                  <input type="password" name="regPassword" placeholder="Mínimo 6 caracteres"
                    [(ngModel)]="regPassword"
                    class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    [disabled]="isLoading()">
                </div>

                <button type="submit" [disabled]="isLoading()"
                  class="mt-2 w-full py-4 bg-blue-600 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                  @if (isLoading()) { <span class="animate-spin">⏳</span> Creando cuenta... }
                  @else { Crear mi cuenta <span class="material-symbols-outlined text-lg">person_add</span> }
                </button>
              </form>

              <div class="mt-6 text-center text-sm text-slate-500">
                ¿Ya tienes una cuenta?
                <button type="button" (click)="irA('login')"
                  class="font-bold text-blue-600 hover:text-blue-800 ml-1 transition-colors">
                  Inicia sesión
                </button>
              </div>
            }
          }

        </div>

        <!-- Panel Derecho: Gráfico -->
        <div class="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col items-center justify-center p-12 text-center shadow-inner">
          <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(white 1.5px, transparent 1.5px); background-size: 32px 32px;"></div>
          <div class="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>
          <div class="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

          <div class="relative z-20 flex flex-col items-center">
            <div class="w-24 h-[1px] bg-white/80 mb-12"></div>
            <h2 class="text-[2.5rem] font-bold text-white mb-6 font-headline tracking-tighter leading-tight">Diseña tu Flujo</h2>
            <p class="text-slate-300 text-sm max-w-[280px] mb-12 leading-relaxed">
              Gestión Integral de Diagramas UML y Visualización de Datos en una Plataforma Multi-SaaS de Alto Rendimiento.
            </p>
            @if (vista() === 'login') {
              <div class="w-full flex items-center justify-center gap-12 mt-4">
                <div class="flex flex-col items-center">
                  <span class="text-3xl font-black text-white tracking-tighter">99.9%</span>
                  <span class="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-1">Uptime</span>
                </div>
                <div class="flex flex-col items-center">
                  <span class="text-3xl font-black text-white tracking-tighter">AES-256</span>
                  <span class="text-[10px] font-bold text-blue-200 uppercase tracking-widest mt-1">Safe</span>
                </div>
              </div>
            }
            @if (vista() === 'register') {
              <div class="bg-white/10 rounded-xl p-6 text-left space-y-3 w-full max-w-[280px]">
                <p class="text-white text-sm font-bold mb-3">Como cliente puedes:</p>
                <div class="flex items-center gap-2 text-slate-300 text-sm">
                  <span class="material-symbols-outlined text-blue-300 text-[18px]">check_circle</span>
                  Iniciar trámites en línea
                </div>
                <div class="flex items-center gap-2 text-slate-300 text-sm">
                  <span class="material-symbols-outlined text-blue-300 text-[18px]">check_circle</span>
                  Seguir el estado en tiempo real
                </div>
                <div class="flex items-center gap-2 text-slate-300 text-sm">
                  <span class="material-symbols-outlined text-blue-300 text-[18px]">check_circle</span>
                  Descargar tu comprobante
                </div>
              </div>
            }
            @if (vista() === 'recover') {
              <div class="text-slate-400 text-sm max-w-[260px]">
                Recibirás un token de 8 caracteres en tu correo. Úsalo para restablecer tu contraseña desde tu perfil.
              </div>
            }
          </div>
        </div>

      </div>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private empresaService = inject(EmpresaService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  vista = signal<Vista>('login');
  isLoading = signal(false);
  error = signal('');
  recoverySuccess = signal('');
  registerSuccess = signal(false);

  // Empresas disponibles para registro
  empresasDisponibles = signal<Empresa[]>([]);
  cargandoEmpresas = signal(false);

  // Login
  email = '';
  password = '';
  recordarSesion = false;

  // Registro
  regNombre = '';
  regEmail = '';
  regTelefono = '';
  regPassword = '';
  regEmpresaId = '';

  irA(v: Vista) {
    this.vista.set(v);
    this.error.set('');
    this.recoverySuccess.set('');
    this.registerSuccess.set(false);
    if (v === 'register' && this.empresasDisponibles().length === 0) {
      this.cargarEmpresas();
    }
  }

  private cargarEmpresas(): void {
    this.cargandoEmpresas.set(true);
    this.empresaService.obtenerEmpresas().subscribe({
      next: (lista) => {
        this.empresasDisponibles.set(lista.filter(e => e.estado === 'ACTIVO'));
        this.cargandoEmpresas.set(false);
      },
      error: () => this.cargandoEmpresas.set(false),
    });
  }

  onLogin() {
    this.error.set('');
    if (!this.email || !this.password) {
      this.error.set('Por favor completa correo y contraseña');
      return;
    }
    this.isLoading.set(true);
    const credentials: LoginRequest = { email: this.email, password: this.password };
    this.authService.login(credentials, this.recordarSesion).subscribe({
      next: () => {
        this.isLoading.set(false);
        const raw = this.route.snapshot.queryParamMap.get('returnUrl');
        const returnUrl = raw && raw.startsWith('/') ? raw : null;
        this.router.navigateByUrl(returnUrl ?? this.authService.getRedirectUrlByRol());
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) this.error.set('Correo o contraseña incorrectos');
        else if (err.status === 0) this.error.set('No se puede conectar con el servidor.');
        else this.error.set(err.error?.message || err.error?.error || 'Error al iniciar sesión');
      }
    });
  }

  onRecover() {
    if (!this.email) { this.error.set('Por favor ingresa tu correo'); return; }
    this.isLoading.set(true);
    this.error.set('');
    this.authService.solicitarRecuperacion(this.email).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.recoverySuccess.set('¡Token enviado!\n\nRevisa tu bandeja de entrada o spam para obtener tu token temporal de acceso.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.error || 'No se pudo enviar el correo de recuperación');
      }
    });
  }

  onRegister() {
    this.error.set('');
    if (!this.regEmpresaId) {
      this.error.set('Seleccioná la empresa donde querés realizar tus trámites');
      return;
    }
    if (!this.regNombre || !this.regEmail || !this.regPassword) {
      this.error.set('Nombre, correo y contraseña son obligatorios');
      return;
    }
    if (this.regPassword.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    this.isLoading.set(true);
    this.usuarioService.registrarCliente({
      nombre_completo: this.regNombre,
      correo_electronico: this.regEmail,
      clave_hash: this.regPassword,
      telefono: this.regTelefono || undefined,
      empresa_id: this.regEmpresaId,
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.registerSuccess.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.error || err.error?.message || (typeof err.error === 'string' ? err.error : 'Error al crear la cuenta');
        this.error.set(msg);
      }
    });
  }
}
