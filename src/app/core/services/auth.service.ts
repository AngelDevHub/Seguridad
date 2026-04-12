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
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, map, throwError } from 'rxjs';

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
  fechaInicio?: string;
  fechaNacimiento?: string;
}

const STORAGE_KEY = 'users';
const AUTH_MODE_KEY = 'erp.authMode';
type AuthMode = 'backend' | 'local';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // ── JWT via Cookie HttpOnly ─────────────────────────────────────────────────────
  // El token JWT es gestionado por el navegador como cookie HttpOnly.
  // ms-users lo emite en Set-Cookie al hacer login.
  // El interceptor de Angular envía la cookie automáticamente (withCredentials).
  // Angular NO tiene acceso a la cookie (es HttpOnly) — esto es intencional.

  /** ¿Hay una sesión activa? Verifica el perfil guardado en sessionStorage */
  isLogged(): boolean {
    return (
      !!sessionStorage.getItem(environment.currentUserKey) ||
      !!localStorage.getItem(environment.currentUserKey) ||
      (localStorage.getItem('logged') === 'true' && !!localStorage.getItem('currentUserEmail'))
    );
  }

  isBackendMode(): boolean {
    return localStorage.getItem(AUTH_MODE_KEY) === 'backend';
  }

  private persistCurrentUser(profile: any, mode: AuthMode): void {
    const raw = JSON.stringify(profile);
    sessionStorage.setItem(environment.currentUserKey, raw);
    localStorage.setItem(environment.currentUserKey, raw);
    localStorage.setItem(AUTH_MODE_KEY, mode);
    localStorage.setItem('logged', 'true');
    if (profile?.email) localStorage.setItem('currentUserEmail', String(profile.email));
  }

  clearLocalSession(): void {
    sessionStorage.removeItem(environment.currentUserKey);
    localStorage.removeItem(environment.currentUserKey);
    localStorage.removeItem(environment.jwtKey);
    localStorage.removeItem(AUTH_MODE_KEY);
    localStorage.removeItem('logged');
    localStorage.removeItem('currentUserEmail');
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
          if (response && response.data) {
            // El JWT ya está en la cookie HttpOnly — solo guardamos el perfil
            this.persistCurrentUser(
              { ...response.data.user, permissions: response.data.permissions ?? [] },
              'backend',
            );
          }
        }),
        map((response) => {
          if (!response || !response.data) return null;
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
        catchError((err: unknown) => {
          const httpErr = err as HttpErrorResponse;
          if (httpErr?.status === 0 || httpErr?.status === 502 || httpErr?.status === 503) {
            return of(null);
          }
          return throwError(() => err);
        }),
      );
  }

  /**
   * Registro REAL contra POST /users/auth/register del Gateway.
   */
  registerWithBackend(userData: any): Observable<any> {
    const edadNum = Number(userData.edad);
    const fechaNacimiento = Number.isFinite(edadNum) && edadNum > 0
      ? this.birthDateFromAge(edadNum)
      : undefined;

    const payload = {
      nombre_completo: userData.nombreCompleto,
      direccion: userData.direccion,
      telefono: userData.telefono,
      username: userData.usuario,
      email: userData.email,
      password: userData.contrasena,
      fecha_nacimiento: fechaNacimiento,
    };

    return this.http.post(`${environment.apiUrl}/users/auth/register`, payload);
  }

  private computeAge(fechaNacimiento?: string): number | undefined {
    if (!fechaNacimiento) return undefined;
    const d = new Date(fechaNacimiento);
    if (Number.isNaN(d.getTime())) return undefined;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age >= 0 ? age : undefined;
  }

  private birthDateFromAge(edad: number): string {
    const now = new Date();
    const birth = new Date(now.getFullYear() - edad, now.getMonth(), now.getDate());
    return birth.toISOString().slice(0, 10);
  }

  private mapBackendUser(u: any): AppUser {
    const fechaNacimiento = u.fecha_nacimiento ?? u.fechaNacimiento ?? undefined;
    const edad = u.edad ?? this.computeAge(fechaNacimiento);
    const fechaInicio = u.fecha_inicio ?? u.fechaInicio ?? undefined;
    return {
      id: u.id,
      email: u.email,
      password: '',
      nombreCompleto: u.nombre_completo ?? u.nombreCompleto,
      usuario: u.username ?? u.usuario,
      username: u.username ?? u.usuario,
      telefono: u.telefono ?? undefined,
      direccion: u.direccion ?? undefined,
      edad: typeof edad === 'number' ? edad : undefined,
      permissions: u.permissions ?? [],
      active: u.activo ?? u.active ?? true,
      fechaInicio: fechaInicio ? String(fechaInicio) : undefined,
      fechaNacimiento: fechaNacimiento ? String(fechaNacimiento) : undefined,
    };
  }

  getUserByIdWithBackend(id: string): Observable<AppUser | null> {
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/users/${id}`).pipe(
      map((r) => (r && r.data ? this.mapBackendUser(r.data) : null)),
      tap((u) => {
        if (!u) return;
        sessionStorage.setItem(
          environment.currentUserKey,
          JSON.stringify({
            id: u.id,
            nombre_completo: u.nombreCompleto,
            username: u.usuario ?? u.username,
            email: u.email,
            permissions: u.permissions ?? [],
            telefono: u.telefono ?? '',
            direccion: u.direccion ?? '',
            fecha_inicio: u.fechaInicio ?? null,
            fecha_nacimiento: u.fechaNacimiento ?? null,
          }),
        );
      }),
      catchError(() => of(null)),
    );
  }

  listUsersWithBackend(): Observable<AppUser[]> {
    return this.http
      .get<ApiResponse<any[]>>(`${environment.apiUrl}/users`)
      .pipe(
        map((r) => (r && r.data ? (r.data ?? []).map((u) => this.mapBackendUser(u)) : [])),
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
      map((r) => (r && r.data ? this.mapBackendUser(r.data) : null)),
      catchError(() => of(null)),
    );
  }

  updateUserWithBackend(id: string, data: Partial<AppUser>): Observable<AppUser | null> {
    const payload: any = {};
    if (data.nombreCompleto !== undefined) payload.nombre_completo = data.nombreCompleto;
    if (data.email !== undefined) payload.email = data.email;
    if (data.usuario !== undefined) payload.username = data.usuario;
    if (data.username !== undefined) payload.username = data.username;
    if (data.telefono !== undefined) payload.telefono = data.telefono;
    if (data.direccion !== undefined) payload.direccion = data.direccion;
    if (data.edad !== undefined && Number.isFinite(Number(data.edad))) payload.fecha_nacimiento = this.birthDateFromAge(Number(data.edad));
    if (data.password !== undefined && String(data.password).trim()) payload.password = data.password;
    if (data.active !== undefined) payload.activo = data.active;
    if (data.permissions !== undefined) payload.permissions = data.permissions;

    return this.http.patch<ApiResponse<any>>(`${environment.apiUrl}/users/${id}`, payload).pipe(
      map((r) => (r && r.data ? this.mapBackendUser(r.data) : null)),
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
      const username = match.usuario ?? match.username ?? String(match.email).split('@')[0] ?? match.email;
      this.persistCurrentUser(
        {
          id: match.id ?? null,
          nombre_completo: match.nombreCompleto ?? '',
          username,
          email: match.email,
          permissions: match.permissions ?? [],
          telefono: match.telefono ?? '',
          direccion: match.direccion ?? '',
          fecha_inicio: match.fechaInicio ?? null,
          fecha_nacimiento: match.fechaNacimiento ?? null,
        },
        'local',
      );
      return match;
    }
    return null;
  }

  // ── Perfil del usuario actual ─────────────────────────────────────────────

  /** Obtiene el perfil del usuario backeado (desde sessionStorage o localStorage) */
  getCurrentUser(): AppUser | null {
    // Primero intentar desde sesión (backend real)
    const backendUser = sessionStorage.getItem(environment.currentUserKey)
      ?? localStorage.getItem(environment.currentUserKey);
    if (backendUser) {
      try {
        const parsed = JSON.parse(backendUser);
        const fechaNacimiento = parsed.fecha_nacimiento ?? undefined;
        const edad = this.computeAge(fechaNacimiento);
        // Mapear al formato AppUser para compatibilidad
        return {
          id: parsed.id,
          email: parsed.email,
          password: '',
          nombreCompleto: parsed.nombre_completo,
          usuario: parsed.username,
          username: parsed.username,
          telefono: parsed.telefono ?? undefined,
          direccion: parsed.direccion ?? undefined,
          edad: typeof edad === 'number' ? edad : undefined,
          permissions: parsed.permissions ?? [],
          active: true,
          fechaInicio: parsed.fecha_inicio ?? undefined,
          fechaNacimiento: parsed.fecha_nacimiento ?? undefined,
        };
      } catch { /* fallback al mock */ }
    }

    // Fallback: mock local
    const email = localStorage.getItem('currentUserEmail');
    if (!email) return null;
    return this.getUsers().find((u) => u.email === email) ?? null;
  }

  getMyGroupPermissions(groupId: string): Observable<string[]> {
    if (!this.isBackendMode() || !this.isLogged()) return of([]);
    const id = String(groupId ?? '').trim();
    if (!id) return of([]);
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/users/me/group-permissions/${id}`).pipe(
      map((r) => (r && Array.isArray(r.data) ? r.data : [])),
      catchError(() => of([])),
    );
  }

  getMeWithBackend(): Observable<AppUser | null> {
    if (!this.isBackendMode() || !this.isLogged()) return of(null);
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/users/me`).pipe(
      map((r) => (r && r.data ? this.mapBackendUser(r.data) : null)),
      catchError(() => of(null)),
    );
  }

  refreshMeFromBackend(): Observable<AppUser | null> {
    return this.getMeWithBackend().pipe(
      tap((u) => {
        if (!u) return;
        this.persistCurrentUser(
          {
            id: u.id,
            nombre_completo: u.nombreCompleto ?? '',
            username: u.username ?? '',
            email: u.email,
            permissions: u.permissions ?? [],
            telefono: u.telefono ?? '',
            direccion: u.direccion ?? '',
            fecha_inicio: u.fechaInicio ?? null,
            fecha_nacimiento: u.fechaNacimiento ?? null,
          },
          'backend',
        );
      }),
    );
  }

  getUserGroupPermissions(userId: string, groupId: string): Observable<string[]> {
    if (!this.isBackendMode() || !this.isLogged()) return of([]);
    const u = String(userId ?? '').trim();
    const g = String(groupId ?? '').trim();
    if (!u || !g) return of([]);
    return this.http.get<ApiResponse<string[]>>(`${environment.apiUrl}/users/${u}/group-permissions/${g}`).pipe(
      map((r) => (r && Array.isArray(r.data) ? r.data : [])),
      catchError(() => of([])),
    );
  }

  setUserGroupPermissions(userId: string, groupId: string, permissions: string[]): Observable<string[]> {
    if (!this.isBackendMode() || !this.isLogged()) return of([]);
    const u = String(userId ?? '').trim();
    const g = String(groupId ?? '').trim();
    if (!u || !g) return of([]);
    return this.http.put<ApiResponse<string[]>>(
      `${environment.apiUrl}/users/${u}/group-permissions/${g}`,
      { permissions: permissions ?? [] },
    ).pipe(
      map((r) => (r && Array.isArray(r.data) ? r.data : [])),
      catchError(() => of([])),
    );
  }

  // ── Logout ──────────────────────────────────────────────────────────────────────

  logout(): void {
    // Llamar al endpoint de logout del Gateway para que NestJS limpie la cookie
    // HttpOnly en el servidor (el navegador no puede limpiar HttpOnly cookies)
    this.http.post(`${environment.apiUrl}/users/auth/logout`, {}, { withCredentials: true })
      .subscribe({ error: () => { } }); // fire-and-forget

    // Limpiar el perfil local
    sessionStorage.removeItem(environment.currentUserKey);
    localStorage.removeItem(environment.currentUserKey);
    localStorage.removeItem(environment.jwtKey);
    localStorage.removeItem(AUTH_MODE_KEY);
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
    const idx = users.findIndex((u) => u.email === originalEmail);
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
    const idx = users.findIndex((u) => u.email === email);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], permissions };
    this.saveUsers(users);
    return true;
  }

  toggleUserActive(email: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex((u) => u.email === email);
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
