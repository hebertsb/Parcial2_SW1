import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { 
  superAdminGuard, 
  adminGuard, 
  designerGuard, 
  employeeGuard, 
  clientGuard,
  designerOrAdminGuard
} from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  
  // Login
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./core/auth/login.component').then(m => m.LoginComponent)
  },

  // Consulta pública de trámite (familiares/visitantes — sin autenticación)
  {
    path: 'consulta-tramite',
    loadComponent: () => import('./modules/public/consulta-tramite.component').then(m => m.ConsultaTramiteComponent)
  },

  // Comprobante: ruta sin layout para que window.print() no incluya el sidebar
  {
    path: 'tramites/:id/comprobante',
    canActivate: [authGuard],
    loadComponent: () => import('./modules/client/comprobante-tramite.component').then(m => m.ComprobanteTramiteComponent)
  },
  
  // Rutas con Layout (Sidebar y Topnav)
  { 
    path: '', 
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      // SuperAdmin Panel
      {
        path: 'superadmin/dashboard',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./modules/superadmin/superadmin-dashboard.component').then(m => m.SuperadminDashboardComponent)
      },
      
      // Admin Panel (Admin de Organización)
      {
        path: 'admin/dashboard',
        canActivate: [adminGuard],
        loadComponent: () => import('./modules/admin/admin.component').then(m => m.AdminComponent)
      },
      {
        path: 'admin/gestion-personal',
        canActivate: [adminGuard],
        loadComponent: () => import('./modules/admin/gestion-personal.component').then(m => m.GestionPersonalComponent)
      },
      {
        path: 'admin/politicas',
        canActivate: [designerOrAdminGuard],
        loadComponent: () => import('./modules/admin/politicas-negocio.component').then(m => m.PoliticasNegocioComponent)
      },
      {
        path: 'admin/ia-dashboard',
        canActivate: [adminGuard],
        loadComponent: () => import('./modules/admin/ia-dashboard.component').then(m => m.IaDashboardComponent)
      },
      {
        path: 'admin/agente-reportes',
        canActivate: [adminGuard],
        loadComponent: () => import('./modules/admin/agente-reportes.component').then(m => m.AgenteReportesComponent)
      },
      


      // Designer Panel - Nuevo editor colaborativo (CU-09 + CU-10 + CU-11)
      // Librería: @foblex/flow. WebSocket: STOMP sobre SockJS.
      // Ruta directa desde Políticas → "Diseñar flujos".
      {
        path: 'designer/flow-editor/:politicaId',
        canActivate: [designerOrAdminGuard],
        loadComponent: () => import('./modules/designer/flow-editor/flow-editor.component').then(m => m.FlowEditorComponent)
      },
      
      // Employee Panel (Bandeja / Funcionario)
      {
        path: 'employee/inbox',
        canActivate: [employeeGuard],
        loadComponent: () => import('./modules/employee/employee.component').then(m => m.EmployeeComponent)
      },

      // Client Panel — CU-12: Iniciar y ejecutar trámites
      {
        path: 'client/dashboard',
        canActivate: [clientGuard],
        loadComponent: () => import('./modules/client/client.component').then(m => m.ClientComponent)
      },
      {
        path: 'tramites/:id/ejecutar',
        canActivate: [authGuard],
        loadComponent: () => import('./modules/client/ejecutar-tramite.component').then(m => m.EjecutarTramiteComponent)
      },
      {
        path: 'tramites/:id/detalle',
        canActivate: [authGuard],
        loadComponent: () => import('./modules/client/detalle-tramite.component').then(m => m.DetalleTramiteComponent)
      },
      // Profile (Todos los roles)
      {
        path: 'profile',
        loadComponent: () => import('./core/auth/profile.component').then(m => m.ProfileComponent)
      },

      // Puente de notificaciones push — redirige al editor colaborativo según rol
      {
        path: 'notif-doc',
        loadComponent: () => import('./shared/components/notif-doc-redirect.component').then(m => m.NotifDocRedirectComponent)
      },

      // Redirecciones cortas
      { path: 'admin', redirectTo: 'admin/dashboard', pathMatch: 'full' },
      { path: 'designer', redirectTo: 'admin/politicas', pathMatch: 'full' },
      { path: 'client', redirectTo: 'client/dashboard', pathMatch: 'full' },
      { path: 'employee', redirectTo: 'employee/inbox', pathMatch: 'full' }
    ]
  },
  
  { path: '**', redirectTo: '/login' }
];
