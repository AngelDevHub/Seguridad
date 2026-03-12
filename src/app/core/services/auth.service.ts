import { Injectable } from '@angular/core';
import { ALL_PERMISSIONS } from './permissions.service';

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
  /** Si true, no puede ser eliminado desde la UI */
  isProtected?: boolean;
}

const STORAGE_KEY = 'users';

@Injectable({ providedIn: 'root' })
export class AuthService {

  getUsers(): AppUser[] {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: AppUser[] = JSON.parse(raw);
      // Migración: si algún usuario no tiene permissions/active, los agrega
      const migrated = parsed.map(u => ({
        ...u,
        permissions: u.permissions ?? (u.email === 'admin@test.com' ? ALL_PERMISSIONS : []),
        active: u.active ?? true,
      }));
      return migrated;
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

  /** Intenta iniciar sesión. Devuelve el usuario si la autenticación fue exitosa, null si no. */
  login(email: string, password: string): AppUser | null {
    const users = this.getUsers();
    const match = users.find(u => u.email === email && u.password === password && u.active);
    if (match) {
      localStorage.setItem('logged', 'true');
      localStorage.setItem('currentUserEmail', email);
      return match;
    }
    return null;
  }

  register(userData: Partial<AppUser>): boolean {
    const users = this.getUsers();
    if (users.find(u => u.email === userData.email)) return false;
    const newUser: AppUser = {
      email: userData.email!,
      password: userData.password!,
      nombreCompleto: userData.nombreCompleto,
      telefono: userData.telefono,
      edad: userData.edad,
      usuario: userData.usuario,
      direccion: userData.direccion,
      permissions: [],
      active: true,
    };
    users.push(newUser);
    this.saveUsers(users);
    return true;
  }

  getCurrentUser(): AppUser | null {
    const email = localStorage.getItem('currentUserEmail');
    if (!email) return null;
    return this.getUsers().find(u => u.email === email) ?? null;
  }

  updateUser(originalEmail: string, data: Partial<AppUser>): { ok: boolean; reason?: string } {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email === originalEmail);
    if (idx === -1) return { ok: false, reason: 'not_found' };
    if (data.email && data.email !== originalEmail && users.find(u => u.email === data.email)) {
      return { ok: false, reason: 'email_taken' };
    }
    users[idx] = { ...users[idx], ...data };
    this.saveUsers(users);
    if (data.email) localStorage.setItem('currentUserEmail', data.email);
    return { ok: true };
  }

  updateUserPermissions(email: string, permissions: string[]): boolean {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], permissions };
    this.saveUsers(users);
    return true;
  }

  toggleUserActive(email: string): boolean {
    const users = this.getUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return false;
    users[idx] = { ...users[idx], active: !users[idx].active };
    this.saveUsers(users);
    return true;
  }

  deleteUser(email: string): void {
    const users = this.getUsers().filter(u => u.email !== email);
    this.saveUsers(users);
    if (localStorage.getItem('currentUserEmail') === email) this.logout();
  }

  isLogged(): boolean {
    return localStorage.getItem('logged') === 'true';
  }

  logout(): void {
    localStorage.removeItem('logged');
    localStorage.removeItem('currentUserEmail');
  }
}