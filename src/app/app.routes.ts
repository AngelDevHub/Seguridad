import { Routes } from '@angular/router';

export const routes: Routes = [
    { path: 'login', loadComponent: () => import('./components/login.component').then(m => m.LoginComponent) },
    { path: 'register', loadComponent: () => import('./components/register.component').then(m => m.RegisterComponent) },
    { path: 'dashboard', loadComponent: () => import('./components/dashboard.component').then(m => m.DashboardComponent) },
    { path: '', redirectTo: 'login', pathMatch: 'full' }
];