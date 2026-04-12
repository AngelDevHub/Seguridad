import { Directive, Input, TemplateRef, ViewContainerRef, inject, signal, effect } from '@angular/core';
import { PermissionsService } from '../services/permissions.service';

/**
 * Directiva estructural que muestra un elemento solo si el usuario
 * posee el permiso (o alguno de los permisos) indicado.
 *
 * Uso:
 *   <button *appHasPermission="'tickets:crear'">Crear</button>
 *   <div *appHasPermission="['usuarios:crear','usuarios:editar']">Admin</div>
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class IfHasPermissionDirective {
  private readonly permsSvc = inject(PermissionsService);
  private readonly tplRef   = inject(TemplateRef<unknown>);
  private readonly vcRef    = inject(ViewContainerRef);

  /** Permiso(s) requeridos — reactivo mediante Signal interna */
  private readonly requires = signal<string | string[]>('');
  private hasView = false;

  @Input({ required: true })
  set appHasPermission(value: string | string[]) {
    this.requires.set(value);
  }

  constructor() {
    // effect() lee: requires() y permsSvc.permissions() (ambas Signals)
    // Se re-ejecuta automáticamente cuando cualquiera de las dos cambia.
    effect(() => {
      const req     = this.requires();
      const allowed = Array.isArray(req)
        ? this.permsSvc.hasAnyPermission(req)
        : this.permsSvc.hasPermission(req);

      if (allowed && !this.hasView) {
        this.vcRef.createEmbeddedView(this.tplRef);
        this.hasView = true;
      } else if (!allowed && this.hasView) {
        this.vcRef.clear();
        this.hasView = false;
      }
    });
  }
}
