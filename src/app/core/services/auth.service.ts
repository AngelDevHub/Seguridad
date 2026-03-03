import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {

  getUsers(): any[] {
    const usersStr = localStorage.getItem('users');
    if (usersStr) return JSON.parse(usersStr);
    const defaultUsers = [{ email: 'admin@test.com', password: '123456' }];
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    return defaultUsers;
  }

  private saveUsers(users: any[]): void {
    localStorage.setItem('users', JSON.stringify(users));
  }

  login(email: string, password: string): boolean {
    const users = this.getUsers();
    const match = users.find((u: any) => u.email === email && u.password === password);
    if (match) {
      localStorage.setItem('logged', 'true');
      localStorage.setItem('currentUserEmail', email);
      return true;
    }
    return false;
  }

  register(userData: any): boolean {
    const users = this.getUsers();
    if (users.find((u: any) => u.email === userData.email)) return false;
    users.push(userData);
    this.saveUsers(users);
    return true;
  }

  getCurrentUser(): any | null {
    const email = localStorage.getItem('currentUserEmail');
    if (!email) return null;
    return this.getUsers().find((u: any) => u.email === email) ?? null;
  }

  updateUser(originalEmail: string, data: any): { ok: boolean; reason?: string } {
    const users = this.getUsers();
    const idx = users.findIndex((u: any) => u.email === originalEmail);
    if (idx === -1) return { ok: false, reason: 'not_found' };
    // If email changed, verify it's not taken by another user
    if (data.email !== originalEmail && users.find((u: any) => u.email === data.email)) {
      return { ok: false, reason: 'email_taken' };
    }
    users[idx] = { ...users[idx], ...data };
    this.saveUsers(users);
    localStorage.setItem('currentUserEmail', users[idx].email);
    return { ok: true };
  }

  deleteUser(email: string): void {
    const users = this.getUsers().filter((u: any) => u.email !== email);
    this.saveUsers(users);
    this.logout();
  }

  isLogged(): boolean {
    return localStorage.getItem('logged') === 'true';
  }

  logout() {
    localStorage.removeItem('logged');
    localStorage.removeItem('currentUserEmail');
  }
}