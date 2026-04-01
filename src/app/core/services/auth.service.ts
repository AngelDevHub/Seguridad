// src/app/core/services/auth.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Servicio de autenticación con DOBLE MODO:
//
//   MODO REAL    — llama a POST /users/auth/login del Gateway → ms-users
//   MODO FALLBACK — si el backend no responde, usa el mock local (localStorage)
//                   para no romper el desarrollo offline
//
// La interfaz AppUser y todos los métodos de gestión local se mantienen
// idénticos para no romper los componentes de PrimeNG ya existentes.
// ─────────────────────────────────────────────────────────────────────────────
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ALL_PERMISSIONS } from './permissions.service';
import { ApiResponse, LoginApiResponse } from '../models/api.model';

// ── Interfaz local (NO modificar — usada por componentes PrimeNG) ─────────────
export interface AppUser {
  nombreCompleto?: string;
  email: string;
  password: string;
  telefono?: string;
  edad?: number;
  usuario?: string;
  direccion?: string;
  permissions: string[];
  active: boolean;
  isProtected?: boolean;
  // Campos adicionales del backend (opcionales para retrocompatibilidad)
  id?: string;
  username?: string;
}

const STORAGE_KEY     = 'users';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // ── JWT real ────────────────────────────────────────────────────────────────

  /** Guarda el JWT en localStorage tras un login exitoso con el backend */
  private saveToken(token: string): void {
    localStorage.setItem(environment.jwtKey, token);
  }

  /** Obtiene el token actual (usado por el interceptor) */
  getToken(): string | null {
    return localStorage.getItem(environment.jwtKey);
  }

  /** ¿Hay una sesión activa? (token O flag legacy) */
  isLogged(): boolean {
    return !!localStorage.getItem(environment.jwtKey) ||
           localStorage.getItem('logged') === 'true';
  }

  // ── Login contra el API Gateway → ms-users ──────────────────────────────────

  /**
   * Login REAL contra POST /users/auth/login del Gateway.
   * Guarda el JWT y el perfil del usuario.
   * Retorna Observable<AppUser | null>
   */
  loginWithBackend(username: string, password: string): Observable<AppUser | null> {
    return this.http
      .post<ApiResponse<LoginApiResponse>>(
        `${environment.apiUrl}/users/auth/login`,
        { username, password },
      )
      .pipe(
        tap((response) => {
          if (response.success && response.data.access_token) {
            this.saveToken(response.data.access_token);
            localStorage.setItem(
              environment.currentUserKey,
              JSON.stringify({ ...response.data.user, permissions: response.data.permissions ?? [] }),
            );
            // Compatibilidad con guard legacy
            localStorage.setItem('logged', 'true');
            localStorage.setItem('currentUserEmail', response.data.user.email);
          }
        }),
        map((response) => {
          if (!response.success) return null;
          return {
            id: response.data.user.id,
            email: response.data.user.email,
            password: '',
            nombreCompleto: response.data.user.nombre_completo,
            username: response.data.user.username,
            permissions: response.data.permissions ?? [],
            active: true,
          } satisfies AppUser;
        }),
        catchError(() => of(null)),
      );
  }

  /**
   * Registro REAL contra POST /users/auth/register del Gateway.
   */
  registerWithBackend(userData: any): Observable<any> {
    const payload = {
      nombre_completo: userData.nombreCompleto,
      direccion: userData.direccion,
      telefono: userData.telefono,
      username: userData.usuario,
      email: userData.email,
      password: userData.contrasena,
      // No incluimos edad porque backend no la soporta actualmente, ni tampoco confirmarContrasena.
    };

    return this.http.post(`${environment.apiUrl}/users/auth/register`, payload);
  }

  private mapBackendUser(u: any): AppUser {
    return {
      id: u.id,
      email: u.email,
      password: '',
      nombreCompleto: u.nombre_completo ?? u.nombreCompleto,
      usuario: u.username ?? u.usuario,
      username: u.username ?? u.usuario,
      telefono: u.telefono ?? undefined,
      direccion: u.direccion ?? undefined,
      permissions: u.permissions ?? [],
      active: u.activo ?? u.active ?? true,
    };
  }

  listUsersWithBackend(): Observable<AppUser[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${environment.apiUrl}/users`)
      .pipe(
        map((r) => (r.success ? (r.data ?? []).map((u) => this.mapBackendUser(u)) : [])),
        catchError(() => of([])),
      );
  }

  createUserWithBackend(data: { nombreCompleto: string; email: string; password: string; permissions?: string[] }): Observable<AppUser | null> {
    const username = String(data.email).split('@')[0] || `user_${Date.now()}`;
    const payload: any = {
      nombre_completo: data.nombreCompleto,
      email: data.email,
      username,
      password: data.password,
      permissions: data.permissions ?? [],
    };
    return this.http.post<ApiResponse<any>>(`${environment.apiUrl}/users`, payload).pipe(
      map((r) => (r.success ? this.mapBackendUser(r.data) : null)),
      catchError(() => of(null)),
    );
  }

  updateUserWithBackend(id: string, data: Partial<AppUser>): Observable<AppUser | null> {
    const payload: any = {};
    if (data.nombreCompleto !== undefined) payload.nombre_completo = data.nombreCompleto;
    if (data.email !== undefined) payload.email = data.email;
    if (data.username !== undefined) payload.username = data.username;
    if (data.password !== undefined && String(data.password).trim()) payload.password = data.password;
    if (data.active !== undefined) payload.activo = data.active;
    if (data.permissions !== undefined) payload.permissions = data.permissions;

    return this.http.patch<ApiResponse<any>>(`${environment.apiUrl}/users/${id}`, payload).pipe(
      map((r) => (r.success ? this.mapBackendUser(r.data) : null)),
      catchError(() => of(null)),
    );
  }

  deleteUserWithBackend(id: string): Observable<boolean> {
    return this.http.delete(`${environment.apiUrl}/users/${id}`, { observe: 'response' }).pipe(
      map((res) => res.status >= 200 && res.status < 300),
      catchError(() => of(false)),
    );
  }

  // ── Login LOCAL (mock — para desarrollo sin backend) ─────────────────────────

  /**
   * Login contra el mock local de localStorage.
   * PRESERVADO para compatibilidad — no rompe el componente LoginComponent.
   */
  login(email: string, password: string): AppUser | null {
    const users = this.getUsers();
    const match = users.find(
      (u) => u.email === email && u.password === password && u.active,
    );
    if (match) {
      localStorage.setItem('logged', 'true');
      localStorage.setItem('currentUserEmail', email);
      return match;
    }
    return null;
  }

  // ── Perfil del usuario actual ─────────────────────────────────────────────

  /** Obtiene el perfil del usuario backeado (desde localStorage o mock) */
  getCurrentUser(): AppUser | null {
    // Primero intentar desde la sesión real del backend
    const backendUser = localStorage.getItem(environment.currentUserKey);
    if (backendUser) {
      try {
        const parsed = JSON.parse(backendUser);
        // Mapear al formato AppUser para compatibilidad
        return {
          id:             parsed.id,
          email:          parsed.email,
          password:       '',
          nombreCompleto: parsed.nombre_completo,
          username:       parsed.username,
          permissions:    parsed.permissions ?? [],
          active:         true,
        };
      } catch { /* fallback al mock */ }
    }

    // Fallback: mock local
    const email = localStorage.getItem('currentUserEmail');
    if (!email) return null;
    return this.getUsers().find((u) => u.email === email) ?? null;
  }

  // ── Logout ────────────────────────────────────────────────────────────────

  logout(): void {
    // Limpiar tokens reales
    localStorage.removeItem(environment.jwtKey);
    localStorage.removeItem(environment.currentUserKey);
    // Limpiar flags legacy
    localStorage.removeItem('logged');
    localStorage.removeItem('currentUserEmail');
    this.router.navigate(['/login']);
  }

  // ── Gestión de usuarios locales (PRESERVADOS — usan los componentes PrimeNG) ─

  getUsers(): AppUser[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: AppUser[] = JSON.parse(raw);
      return parsed.map((u) => ({
        ...u,
        permissions: u.permissions ?? (u.email === 'admin@test.com' ? ALL_PERMISSIONS : []),
        active: u.active ?? true,
      }));
    }
    return this.seedUsers();
  }

  private seedUsers(): AppUser[] {
    const initial: AppUser[] = [
      {
        email: 'admin@test.com',
        password: '123456',
        nombreCompleto: 'Administrador',
        permissions: ALL_PERMISSIONS,
        active: true,
        isProtected: true,
      },
      {
        email: 'superAdmin@sistema.com',
        password: 'SuperAdmin2024!',
        nombreCompleto: 'Super Administrador',
        usuario: 'superAdmin',
        permissions: ALL_PERMISSIONS,
        active: true,
        isProtected: true,
      },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  private saveUsers(users: AppUser[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  register(userData: Partial<AppUser>): boolean {
    const users = this.getUsers();
    if (users.find((u) => u.email === userData.email)) return false;
    users.push({
      email: userData.email!,
      password: userData.password!,
      nombreCompleto: userData.nombreCompleto,
      telefono: userData.telefono,
      edad: userData.edad,
      usuario: userData.usuario,
      direccion: userData.direccion,
      permissions: [],
      active: true,
    });
    this.saveUsers(users);
    return true;
  }

  updateUser(originalEmail: string, data: Partial<AppUser>): { ok: boolean; reason?: string } {
    const users = this.getUsers();
    const idx   = users.findIndex((u) => u.email === originalEmail);
    if (idx === -1) return { ok: false, reason: 'not_found' };
    if (data.email && data.email !== originalEmail && users.find((u) => u.email === data.email)) {
      return { ok: false, reason: 'email_taken' };
    }
    users[idx] = { ...users[idx], ...data };
    this.saveUsers(users);
    if (data.email) localStorage.setItem('currentUserEmail', data.email);
    return { ok: true };
  }

  updateUserPermissions(email: string, permissions: string[]): boolean {
    const users = this.getUsers();
    const idx   = users.findIndex((u) => u.email === email);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], permissions };
    this.saveUsers(users);
    return true;
  }

  toggleUserActive(email: string): boolean {
    const users = this.getUsers();
    const idx   = users.findIndex((u) => u.email === email);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], active: !users[idx].active };
    this.saveUsers(users);
    return true;
  }

  deleteUser(email: string): void {
    const users = this.getUsers().filter((u) => u.email !== email);
    this.saveUsers(users);
    if (localStorage.getItem('currentUserEmail') === email) this.logout();
  }
}
