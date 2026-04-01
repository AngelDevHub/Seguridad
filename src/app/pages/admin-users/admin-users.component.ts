import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToolbarModule } from 'primeng/toolbar';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TooltipModule } from 'primeng/tooltip';
import { PasswordModule } from 'primeng/password';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService, AppUser } from '../../core/services/auth.service';
import { PermissionsService, ALL_PERMISSIONS } from '../../core/services/permissions.service';
import { IfHasPermissionDirective } from '../../core/directives/if-has-permission.directive';

type DialogMode = 'create' | 'edit' | 'permissions';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, ConfirmDialogModule, DialogModule,
    InputTextModule, MultiSelectModule, ToolbarModule, CardModule, ChipModule,
    ToggleSwitchModule, IconFieldModule, InputIconModule, TooltipModule, PasswordModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  private readonly authSvc     = inject(AuthService);
  private readonly permsSvc    = inject(PermissionsService);
  private readonly msgSvc      = inject(MessageService);
  private readonly confirmSvc  = inject(ConfirmationService);
  private readonly fb          = inject(FormBuilder);

  // ── State ────────────────────────────────────────────────────
  users             = signal<AppUser[]>([]);
  dialogMode        = signal<DialogMode>('create');
  formDialogVisible  = false;   // dialog Crear / Editar
  permsDialogVisible = false;   // dialog Asignar Permisos
  editingEmail       = '';
  editingId          = '';
  isSaving           = signal(false);

  // ── All permissions grouped for multiselect ──────────────────
  readonly allPermissions = ALL_PERMISSIONS.map(p => ({ label: p, value: p }));

  readonly permGroups = [
    {
      label: 'Tickets',
      items: ['tickets:ver','tickets:crear','tickets:editar','tickets:asignar','tickets:eliminar']
        .map(p => ({ label: p, value: p })),
    },
    {
      label: 'Grupos',
      items: ['grupos:ver','grupos:crear','grupos:editar','grupos:eliminar','grupos:invitar']
        .map(p => ({ label: p, value: p })),
    },
    {
      label: 'Usuarios',
      items: ['usuarios:ver','usuarios:crear','usuarios:editar','usuarios:eliminar','usuarios:asignarPermisos']
        .map(p => ({ label: p, value: p })),
    },
  ];

  // ── Forms ────────────────────────────────────────────────────
  form: FormGroup = this.fb.group({
    nombreCompleto: ['', [Validators.required, Validators.minLength(2)]],
    email:          ['', [Validators.required, Validators.email]],
    password:       ['', [Validators.required, Validators.minLength(6)]],
    permissions:    [[] as string[]],
  });

  permsForm: FormGroup = this.fb.group({
    permissions: [[] as string[]],
  });

  ngOnInit(): void { this.loadUsers(); }

  loadUsers(): void {
    this.authSvc.listUsersWithBackend().subscribe((list) => {
      if (list.length) {
        this.users.set(list);
      } else {
        this.users.set(this.authSvc.getUsers());
      }
    });
  }

  // ── Dialogs ──────────────────────────────────────────────────
  openCreate(): void {
    this.dialogMode.set('create');
    this.editingEmail = '';
    this.editingId = '';
    this.form.reset({ permissions: [] });
    this.form.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.form.get('password')?.updateValueAndValidity();
    this.formDialogVisible = true;
  }

  openEdit(u: AppUser): void {
    this.dialogMode.set('edit');
    this.editingEmail = u.email;
    this.editingId = u.id ?? '';
    this.form.reset({
      nombreCompleto: u.nombreCompleto ?? '',
      email:          u.email,
      password:       '',
      permissions:    u.permissions ?? [],
    });
    this.form.get('password')?.setValidators([]);
    this.form.get('password')?.updateValueAndValidity();
    this.formDialogVisible = true;
  }

  openPermissions(u: AppUser): void {
    this.editingEmail = u.email;
    this.editingId = u.id ?? '';
    this.permsForm.reset({ permissions: u.permissions ?? [] });
    this.permsDialogVisible = true;
  }

  closeDialog(): void {
    this.formDialogVisible  = false;
    this.permsDialogVisible = false;
  }

  save(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.isSaving.set(true);

    const val = this.form.value;

    if (this.dialogMode() === 'create') {
      this.authSvc.createUserWithBackend({
        nombreCompleto: val.nombreCompleto,
        email: val.email,
        password: val.password,
        permissions: val.permissions ?? [],
      }).subscribe((created) => {
        if (created) {
          this.msgSvc.add({ severity: 'success', summary: 'Usuario creado', detail: `${val.nombreCompleto} registrado.`, life: 3000 });
          this.closeDialog();
          this.loadUsers();
        } else {
          const ok = this.authSvc.register({
            nombreCompleto: val.nombreCompleto,
            email: val.email,
            password: val.password,
            permissions: val.permissions ?? [],
          });
          if (ok) {
            if (val.permissions?.length) {
              this.authSvc.updateUserPermissions(val.email, val.permissions);
            }
            this.msgSvc.add({ severity: 'success', summary: 'Usuario creado (local)', detail: `${val.nombreCompleto} registrado.`, life: 3000 });
            this.closeDialog();
            this.loadUsers();
          } else {
            this.msgSvc.add({ severity: 'error', summary: 'Error', detail: 'El email ya está registrado.', life: 4000 });
          }
        }
        this.isSaving.set(false);
      });
      return;
    } else {
      const data: Partial<AppUser> = { nombreCompleto: val.nombreCompleto, email: val.email, permissions: val.permissions ?? [] };
      if (val.password?.trim()) data['password'] = val.password;
      if (this.editingId) {
        this.authSvc.updateUserWithBackend(this.editingId, data).subscribe((updated) => {
          if (updated) {
            this.msgSvc.add({ severity: 'success', summary: 'Actualizado', detail: 'Datos guardados.', life: 3000 });
            this.closeDialog();
            this.loadUsers();
          } else {
            const res = this.authSvc.updateUser(this.editingEmail, data);
            if (res.ok) {
              this.msgSvc.add({ severity: 'success', summary: 'Actualizado (local)', detail: 'Datos guardados.', life: 3000 });
              this.closeDialog();
              this.loadUsers();
            } else {
              const msg = res.reason === 'email_taken' ? 'El nuevo email ya está en uso.' : 'Usuario no encontrado.';
              this.msgSvc.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 });
            }
          }
          this.isSaving.set(false);
        });
        return;
      } else {
        const res = this.authSvc.updateUser(this.editingEmail, data);
        if (res.ok) {
          this.msgSvc.add({ severity: 'success', summary: 'Actualizado', detail: 'Datos guardados.', life: 3000 });
          this.closeDialog();
          this.loadUsers();
        } else {
          const msg = res.reason === 'email_taken' ? 'El nuevo email ya está en uso.' : 'Usuario no encontrado.';
          this.msgSvc.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 });
        }
      }
    }
    this.isSaving.set(false);
  }

  savePermissions(): void {
    const perms: string[] = this.permsForm.value.permissions ?? [];
    if (this.editingId) {
      this.authSvc.updateUserWithBackend(this.editingId, { permissions: perms }).subscribe((updated) => {
        if (updated) {
          const current = this.authSvc.getCurrentUser();
          if (current?.id === this.editingId) {
            this.permsSvc.setPermissions(perms);
          }
          this.msgSvc.add({ severity: 'success', summary: 'Permisos actualizados', life: 3000 });
          this.closeDialog();
          this.loadUsers();
        }
      });
      return;
    }
    const ok = this.authSvc.updateUserPermissions(this.editingEmail, perms);
    if (ok) {
      const current = this.authSvc.getCurrentUser();
      if (current?.email === this.editingEmail) {
        this.permsSvc.setPermissions(perms);
      }
      this.msgSvc.add({ severity: 'success', summary: 'Permisos actualizados', life: 3000 });
      this.closeDialog();
      this.loadUsers();
    }
  }

  confirmDelete(u: AppUser): void {
    this.confirmSvc.confirm({
      header: 'Eliminar usuario',
      message: `¿Eliminar a <strong>${u.nombreCompleto ?? u.email}</strong>? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (u.id) {
          this.authSvc.deleteUserWithBackend(u.id).subscribe((ok) => {
            if (ok) {
              this.msgSvc.add({ severity: 'info', summary: 'Usuario eliminado', life: 3000 });
              this.loadUsers();
            } else {
              this.authSvc.deleteUser(u.email);
              this.msgSvc.add({ severity: 'info', summary: 'Usuario eliminado (local)', life: 3000 });
              this.loadUsers();
            }
          });
        } else {
          this.authSvc.deleteUser(u.email);
          this.msgSvc.add({ severity: 'info', summary: 'Usuario eliminado', life: 3000 });
          this.loadUsers();
        }
      },
    });
  }

  toggleActive(u: AppUser): void {
    if (u.id) {
      this.authSvc.updateUserWithBackend(u.id, { active: !u.active }).subscribe(() => this.loadUsers());
    } else {
      this.authSvc.toggleUserActive(u.email);
      this.loadUsers();
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  dialogHeader(): string {
    return { create: 'Nuevo Usuario', edit: 'Editar Usuario', permissions: 'Asignar Permisos' }[this.dialogMode()];
  }

  hasError(f: string, e: string, form = this.form): boolean {
    const c = form.get(f);
    return !!(c?.touched && c.hasError(e));
  }

  onGlobalFilter(e: Event, dt: any): void {
    dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }
}
