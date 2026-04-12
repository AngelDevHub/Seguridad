import { Injectable, computed, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';

export const ALL_PERMISSIONS: string[] = [
  'tickets:crear', 'tickets:editar', 'tickets:ver', 'tickets:asignar', 'tickets:eliminar',
  'tickets:move',
  'grupos:ver',    'grupos:crear',   'grupos:editar', 'grupos:eliminar', 'grupos:invitar',
  'usuarios:ver',  'usuarios:crear', 'usuarios:editar', 'usuarios:eliminar', 'usuarios:asignarPermisos',
];

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly auth = inject(AuthService);
  private readonly _global = signal<string[]>([]);
  private readonly _groupPerms = signal<Record<string, string[]>>({});
  private readonly _activeGroupId = signal<string>('');

  readonly permissions = computed(() => {
    const global = this._global();
    const groupId = this._activeGroupId();
    const scoped = groupId ? (this._groupPerms()[groupId] ?? []).map((p) => `group:${groupId}:${p}`) : [];
    return [...new Set([...global, ...scoped])];
  });

  /** Carga los permisos del usuario (llamar tras login) */
  setPermissions(perms: string[]): void {
    this._global.set([...(perms ?? [])]);
  }

  /** Limpia los permisos (llamar al cerrar sesión) */
  clearPermissions(): void {
    this._global.set([]);
    this._groupPerms.set({});
    this._activeGroupId.set('');
  }

  setActiveGroup(groupId: string): void {
    this._activeGroupId.set(String(groupId ?? ''));
  }

  clearActiveGroup(): void {
    this._activeGroupId.set('');
  }

  setGroupPermissions(groupId: string, perms: string[]): void {
    const id = String(groupId ?? '');
    if (!id) return;
    this._groupPerms.update((m) => ({ ...m, [id]: [...(perms ?? [])] }));
  }

  refreshPermissionsForGroup(groupId: string): void {
    const id = String(groupId ?? '').trim();
    if (!id) return;
    if (!this.auth.isBackendMode() || !this.auth.isLogged()) return;
    this.auth.getMyGroupPermissions(id).subscribe((perms) => {
      this.setGroupPermissions(id, perms ?? []);
    });
  }

  /** Verifica si el usuario tiene un permiso específico */
  hasPermission(permission: string): boolean {
    const p = String(permission ?? '');
    const list = this.permissions();
    if (list.includes(p)) return true;
    const groupId = this._activeGroupId();
    return !!groupId && list.includes(`group:${groupId}:${p}`);
  }

  /** Verifica si el usuario tiene al menos uno de los permisos indicados */
  hasAnyPermission(permissions: string[]): boolean {
    return (permissions ?? []).some((p) => this.hasPermission(p));
  }

  /** Verifica si el usuario tiene TODOS los permisos indicados */
  hasAllPermissions(permissions: string[]): boolean {
    return (permissions ?? []).every((p) => this.hasPermission(p));
  }
}
