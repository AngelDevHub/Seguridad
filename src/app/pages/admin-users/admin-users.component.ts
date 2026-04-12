import { Component, inject, signal, computed, OnInit, DestroyRef } from '@angular/core';
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
import { SelectModule } from 'primeng/select';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService, AppUser } from '../../core/services/auth.service';
import { PermissionsService, ALL_PERMISSIONS } from '../../core/services/permissions.service';
import { IfHasPermissionDirective } from '../../core/directives/if-has-permission.directive';
import { GroupCrudService } from '../../core/services/group-crud.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type DialogMode = 'create' | 'edit' | 'permissions' | 'groupPermissions';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, TagModule, ToastModule, ConfirmDialogModule, DialogModule,
    InputTextModule, MultiSelectModule, SelectModule, ToolbarModule, CardModule, ChipModule,
    ToggleSwitchModule, IconFieldModule, InputIconModule, TooltipModule, PasswordModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './admin-users.component.html',
})
export class AdminUsersComponent implements OnInit {
  private readonly authSvc     = inject(AuthService);
  private readonly permsSvc    = inject(PermissionsService);
  private readonly groupSvc    = inject(GroupCrudService);
  private readonly msgSvc      = inject(MessageService);
  private readonly confirmSvc  = inject(ConfirmationService);
  private readonly fb          = inject(FormBuilder);
  private readonly destroyRef  = inject(DestroyRef);

  // ── State ────────────────────────────────────────────────────
  users             = signal<AppUser[]>([]);
  dialogMode        = signal<DialogMode>('create');
  formDialogVisible  = false;   // dialog Crear / Editar
  permsDialogVisible = false;   // dialog Asignar Permisos
  groupPermsDialogVisible = false;
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

  readonly groupPermOptions = [
    'tickets:ver',
    'tickets:crear',
    'tickets:editar',
    'tickets:move',
    'grupos:invitar',
  ].map((p) => ({ label: p, value: p }));

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

  groupPermsForm: FormGroup = this.fb.group({
    groupId: ['', Validators.required],
    permissions: [[] as string[]],
  });

  readonly groupOptions = computed(() =>
    this.groupSvc.groups().map((g) => ({
      label: `${g.nombre}${g.categoria ? ` — ${g.categoria}` : ''}`,
      value: g.id,
      raw: g,
    })),
  );
  groupSearch = signal('');
  readonly filteredGroupOptions = computed(() => {
    const q = this.groupSearch().trim().toLowerCase();
    const all = this.groupOptions();
    if (!q) return all.map(({ label, value }) => ({ label, value }));
    return all
      .filter(({ raw }) =>
        raw.nombre.toLowerCase().includes(q) ||
        (raw.categoria ?? '').toLowerCase().includes(q),
      )
      .map(({ label, value }) => ({ label, value }));
  });
  membershipStatus = signal<'no_miembro' | 'invitado' | 'miembro'>('no_miembro');
  groupSearchText = '';

  ngOnInit(): void {
    this.loadUsers();
    if (this.authSvc.isBackendMode() && this.authSvc.isLogged()) {
      this.groupSvc.refreshFromBackend();
    }
    this.groupPermsForm.get('groupId')?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((groupId) => {
      const id = String(groupId ?? '').trim();
      if (!id || !this.editingId) return;
      this.loadGroupPermissions(this.editingId, id);
    });
  }

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
    this.groupPermsDialogVisible = false;
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
            this.authSvc.refreshMeFromBackend().subscribe();
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

  openGroupPermissions(u: AppUser): void {
    this.dialogMode.set('groupPermissions');
    this.editingEmail = u.email;
    this.editingId = u.id ?? '';
    const firstGroup = this.groupOptions()[0]?.value ?? '';
    this.groupPermsForm.reset({ groupId: firstGroup, permissions: [] });
    this.groupPermsDialogVisible = true;
    if (!firstGroup) {
      this.msgSvc.add({ severity: 'warn', summary: 'Sin grupos disponibles', detail: 'No hay grupos para asignar permisos.', life: 4000 });
      return;
    }
    if (this.editingId && firstGroup) {
      this.loadGroupPermissions(this.editingId, firstGroup);
    }
  }

  private loadGroupPermissions(userId: string, groupId: string): void {
    this.authSvc.getUserGroupPermissions(userId, groupId).subscribe((perms) => {
      this.groupPermsForm.patchValue({ permissions: perms ?? [] }, { emitEvent: false });
    });
    this.groupSvc.fetchByIdFromBackend(groupId).subscribe((g) => {
      if (!g) { this.membershipStatus.set('no_miembro'); return; }
      const email = this.editingEmail.toLowerCase();
      const isMember = (g.miembrosList ?? []).some((e) => String(e).toLowerCase() === email);
      if (isMember) { this.membershipStatus.set('miembro'); return; }
      const isInvited = (g.invitedList ?? []).some((e) => String(e).toLowerCase() === email);
      this.membershipStatus.set(isInvited ? 'invitado' : 'no_miembro');
    });
  }

  membershipSeverity() {
    return ({ no_miembro: 'secondary', invitado: 'warn', miembro: 'success' } as any)[this.membershipStatus()];
  }

  saveGroupPermissions(): void {
    if (this.groupPermsForm.invalid) {
      this.groupPermsForm.markAllAsTouched();
      return;
    }
    if (!this.editingId) return;
    const groupId = String(this.groupPermsForm.value.groupId ?? '').trim();
    const perms: string[] = this.groupPermsForm.value.permissions ?? [];
    this.isSaving.set(true);
    this.groupSvc.addMember(groupId, this.editingEmail).subscribe(() => {
      this.authSvc.setUserGroupPermissions(this.editingId!, groupId, perms).subscribe((saved) => {
        this.msgSvc.add({ severity: 'success', summary: 'Onboarding aplicado', detail: 'Miembro agregado/invitado y permisos asignados.', life: 3500 });
        const current = this.authSvc.getCurrentUser();
        if (current?.id === this.editingId) {
          this.permsSvc.setGroupPermissions(groupId, saved ?? perms);
        }
        this.isSaving.set(false);
        this.closeDialog();
      });
    });
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
    return {
      create: 'Nuevo Usuario',
      edit: 'Editar Usuario',
      permissions: 'Asignar Permisos',
      groupPermissions: 'Permisos por Grupo',
    }[this.dialogMode()];
  }

  hasError(f: string, e: string, form = this.form): boolean {
    const c = form.get(f);
    return !!(c?.touched && c.hasError(e));
  }

  onGlobalFilter(e: Event, dt: any): void {
    dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }
}
