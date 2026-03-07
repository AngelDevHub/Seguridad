import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // ── Ruta raíz → /login ────────────────────────────────────────
  { path: '', redirectTo: 'login', pathMatch: 'full' },

  // ── Rutas públicas (sin layout) ──────────────────────────────
  {
    path: 'login',
    loadComponent: () =>
      import('./components/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register.component').then((m) => m.RegisterComponent),
  },

  // ── Rutas protegidas dentro del AppLayout ────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./layout/app-layout.component').then((m) => m.AppLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'group',
        loadComponent: () =>
          import('./pages/group/group.component').then((m) => m.GroupComponent),
      },
      {
        path: 'group/:id',
        loadComponent: () =>
          import('./pages/tickets/group-tickets.component').then((m) => m.GroupTicketsComponent),
      },
      {
        path: 'user',
        loadComponent: () =>
          import('./pages/user/user.component').then((m) => m.UserComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },

  // ── Cualquier ruta desconocida → login ────────────────────────
  { path: '**', redirectTo: 'login' },
];
