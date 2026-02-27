import { Routes } from '@angular/router';

export const routes: Routes = [
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
    children: [
      {
        path: 'group',
        loadComponent: () =>
          import('./pages/group/group.component').then((m) => m.GroupComponent),
      },
      {
        path: 'user',
        loadComponent: () =>
          import('./pages/user/user.component').then((m) => m.UserComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/dashboard.component').then((m) => m.DashboardComponent),
      },
      // Redirige a /group si se navega a la raíz del layout
      { path: '', redirectTo: 'group', pathMatch: 'full' },
    ],
  },
];