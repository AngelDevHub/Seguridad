import { Injectable, signal } from '@angular/core';

export const ALL_PERMISSIONS: string[] = [
  'tickets:crear', 'tickets:editar', 'tickets:ver', 'tickets:asignar', 'tickets:eliminar',
  'grupos:ver',    'grupos:crear',   'grupos:editar', 'grupos:eliminar', 'grupos:invitar',
  'usuarios:ver',  'usuarios:crear', 'usuarios:editar', 'usuarios:eliminar', 'usuarios:asignarPermisos',
];

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  /** Signal privada con la lista actual de permisos del usuario */
  private readonly _permissions = signal<string[]>([]);

  /** Permisos del usuario actual (solo lectura) */
  readonly permissions = this._permissions.asReadonly();

  /** Carga los permisos del usuario (llamar tras login) */
  setPermissions(perms: string[]): void {
    this._permissions.set([...perms]);
  }

  /** Limpia los permisos (llamar al cerrar sesión) */
  clearPermissions(): void {
    this._permissions.set([]);
  }

  /** Verifica si el usuario tiene un permiso específico */
  hasPermission(permission: string): boolean {
    return this._permissions().includes(permission);
  }

  /** Verifica si el usuario tiene al menos uno de los permisos indicados */
  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(p => this._permissions().includes(p));
  }

  /** Verifica si el usuario tiene TODOS los permisos indicados */
  hasAllPermissions(permissions: string[]): boolean {
    return permissions.every(p => this._permissions().includes(p));
  }
}
