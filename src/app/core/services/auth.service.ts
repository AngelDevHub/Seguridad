import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {

  getUsers() {
    const usersStr = localStorage.getItem('users');
    if (usersStr) {
      return JSON.parse(usersStr);
    }
    const defaultUsers = [{ email: 'admin@test.com', password: '123456' }];
    localStorage.setItem('users', JSON.stringify(defaultUsers));
    return defaultUsers;
  }

  login(email: string, password: string): boolean {
    const users = this.getUsers();
    if (users.find((u: any) => u.email === email && u.password === password)) {
      localStorage.setItem('logged', 'true');
      return true;
    }

    return false;
  }

  register(userData: any): boolean {
    const users = this.getUsers();
    if (users.find((u: any) => u.email === userData.email)) {
      return false; 
    }
    users.push(userData);
    localStorage.setItem('users', JSON.stringify(users));
    return true;
  }

  isLogged(): boolean {
    return localStorage.getItem('logged') === 'true';
  }

  logout() {
    localStorage.removeItem('logged');
  }
}