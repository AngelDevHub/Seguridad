import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ToolbarModule } from 'primeng/toolbar';
import { ChipModule } from 'primeng/chip';
import { DividerModule } from 'primeng/divider';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupCrudService, Group } from '../../core/services/group-crud.service';
import { IfHasPermissionDirective } from '../../core/directives/if-has-permission.directive';
import { AuthService } from '../../core/services/auth.service';
import { ALL_PERMISSIONS } from '../../core/services/permissions.service';

type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule,
    SelectModule, ToastModule, ConfirmDialogModule, TagModule, IconFieldModule,
    InputIconModule, ToolbarModule, ChipModule, DividerModule, CardModule, TooltipModule,
    CheckboxModule, ProgressSpinnerModule,
    IfHasPermissionDirective,
  ],
  templateUrl: './group.component.html',
})
export class GroupComponent implements OnInit {
  private readonly groupService        = inject(GroupCrudService);
  private readonly messageService      = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb                  = inject(FormBuilder);
  private readonly router              = inject(Router);
  private readonly authService         = inject(AuthService);

  groups        = this.groupService.groups;
  dialogVisible = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);
  isSaving      = signal(false);

  // Member management
  selectedGroupRow: Group | null = null;  // used for p-table [(selection)]
  selectedGroup   = signal<Group | null>(null);
  newMemberInput  = '';

  // ── Permisos por grupo (por miembro) ─────────────────────────────────────
  permDialogVisible  = signal(false);
  permDialogMember   = signal<string>('');     // email del miembro seleccionado
  permDialogLoading  = signal(false);
  permDialogSaving   = signal(false);
  // Permisos activos del miembro en el grupo (seleccionados con checkbox)
  permDialogSelected = signal<string[]>([]);

  // Todos los permisos que se pueden asignar dentro de un grupo
  readonly GROUP_ASSIGNABLE_PERMS = [
    { key: 'tickets:crear',    label: 'Crear tickets',    icon: 'pi-plus-circle' },
    { key: 'tickets:editar',   label: 'Editar tickets',   icon: 'pi-pencil' },
    { key: 'tickets:ver',      label: 'Ver tickets',      icon: 'pi-eye' },
    { key: 'tickets:asignar',  label: 'Asignar tickets',  icon: 'pi-user-edit' },
    { key: 'tickets:eliminar', label: 'Eliminar tickets', icon: 'pi-trash' },
    { key: 'tickets:move',     label: 'Mover tickets (Kanban)', icon: 'pi-arrows-alt' },
    { key: 'grupos:invitar',   label: 'Invitar miembros', icon: 'pi-user-plus' },
    { key: 'grupos:editar',    label: 'Editar este grupo',icon: 'pi-file-edit' },
    { key: 'grupos:eliminar',  label: 'Eliminar grupo',   icon: 'pi-times-circle' },
  ];

  nivelOptions = [
    { label: 'Básico',     value: 'Básico' },
    { label: 'Intermedio', value: 'Intermedio' },
    { label: 'Avanzado',   value: 'Avanzado' },
  ];

  form!: FormGroup;

  ngOnInit(): void { this.buildForm(); }

  private buildForm(data?: Partial<Group>): void {
    const currentName = this.authService.getCurrentUser()?.nombreCompleto ?? '';
    this.form = this.fb.group({
      nombre:    [data?.nombre    ?? '', [Validators.required, Validators.minLength(2)]],
      categoria: [data?.categoria ?? '', [Validators.required]],
      nivel:     [data?.nivel     ?? 'Básico', [Validators.required]],
      autor:     [{ value: data?.autor ?? currentName, disabled: true }],
      miembros:  [{ value: data?.miembros ?? 1, disabled: true }],
      tickets:   [{ value: data?.tickets ?? 0, disabled: true }],
    });
  }

  openNewDialog(): void {
    this.isEditMode.set(false); this.editingId.set(null); this.buildForm(); this.dialogVisible.set(true);
  }
  openEditDialog(g: Group): void {
    this.isEditMode.set(true); this.editingId.set(g.id); this.buildForm(g); this.dialogVisible.set(true);
  }
  closeDialog(): void { this.dialogVisible.set(false); }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Completa todos los campos.', life: 4000 });
      return;
    }
    this.isSaving.set(true);
    const formVal = this.form.value;

    if (this.isEditMode()) {
      const currentUserId = this.authService.getCurrentUser()?.id ?? '';
      const creatorId = this.selectedGroup()?._creadorId ?? '';
      const isAdmin = (this.authService.getCurrentUser()?.permissions ?? []).includes('usuarios:asignarPermisos');
      if (!isAdmin && (!creatorId || creatorId !== currentUserId)) {
        this.isSaving.set(false);
        this.messageService.add({ severity: 'warn', summary: 'Sin permisos', detail: 'Solo el creador puede editar este grupo.', life: 3500 });
        return;
      }
      this.groupService.update(this.editingId()!, {
        nombre: formVal.nombre,
        categoria: formVal.categoria,
        nivel: formVal.nivel,
      }).subscribe((updated) => {
        this.isSaving.set(false);
        if (updated) {
          if (this.selectedGroup()?.id === updated.id) this.selectedGroup.set(updated);
          this.messageService.add({ severity: 'success', summary: 'Grupo actualizado', detail: `"${updated.nombre}" actualizado.`, life: 3500 });
          this.closeDialog();
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar.', life: 4000 });
        }
      });
    } else {
      this.groupService.add({
        nombre: formVal.nombre,
        categoria: formVal.categoria,
        nivel: formVal.nivel,
      }).subscribe((created) => {
        this.isSaving.set(false);
        if (created) {
          this.messageService.add({ severity: 'success', summary: 'Grupo creado', detail: `"${created.nombre}" agregado.`, life: 3500 });
          this.closeDialog();
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo crear.', life: 4000 });
        }
      });
    }
  }

  confirmDelete(g: Group): void {
    this.confirmationService.confirm({
      header: 'Eliminar grupo', message: `¿Eliminar <strong>"${g.nombre}"</strong>?`,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const currentUserId = this.authService.getCurrentUser()?.id ?? '';
        const creatorId = (this.groupService.getById(g.id)?._creadorId) ?? this.selectedGroup()?._creadorId ?? '';
        const isAdmin = (this.authService.getCurrentUser()?.permissions ?? []).includes('usuarios:asignarPermisos');
        if (!isAdmin && (!creatorId || creatorId !== currentUserId)) {
          this.messageService.add({ severity: 'warn', summary: 'Sin permisos', detail: 'Solo el creador puede eliminar este grupo.', life: 3500 });
          return;
        }
        if (this.selectedGroup()?.id === g.id) this.selectedGroup.set(null);
        this.groupService.delete(g.id).subscribe((ok) => {
          this.messageService.add(ok
            ? { severity: 'info',  summary: 'Eliminado', detail: `"${g.nombre}" fue eliminado.`, life: 3500 }
            : { severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.', life: 4000 });
        });
      },
    });
  }

  // ── Member management ──────────────────────────────────────────
  selectGroup(g: Group | Group[] | undefined): void {
    if (!g || Array.isArray(g)) return;
    const local = this.groupService.getById(g.id) ?? g;
    this.selectedGroup.set(local);
    if (this.authService.isBackendMode() && this.authService.isLogged()) {
      this.groupService.fetchByIdFromBackend(g.id).subscribe((fresh) => {
        if (fresh) {
          this.selectedGroup.set(fresh);
          return;
        }
        this.groupService.removeFromCache(g.id);
        if (this.selectedGroup()?.id === g.id) this.selectedGroup.set(null);
        this.messageService.add({ severity: 'warn', summary: 'Grupo no disponible', detail: 'El grupo ya no existe o ya no tienes acceso.', life: 3500 });
      });
    }
  }
  clearSelection(): void { this.selectedGroup.set(null); }

  viewTickets(g: Group): void { this.router.navigate(['/group', g.id]); }

  addMember(): void {
    const id = this.selectedGroup()?.id;
    if (!id || !this.newMemberInput.trim()) return;
    this.groupService.addMember(id, this.newMemberInput.trim()).subscribe((updated) => {
      if (updated) {
        this.selectedGroup.set(updated);
        if (this.authService.isBackendMode() && this.authService.isLogged()) {
          this.groupService.fetchByIdFromBackend(id).subscribe((fresh) => {
            if (fresh) this.selectedGroup.set(fresh);
          });
        }
        this.newMemberInput = '';
        this.messageService.add({ severity: 'success', summary: 'Miembro agregado / invitación enviada', life: 2500 });
      } else {
        this.messageService.add({ severity: 'warn', summary: 'Ya existe o inválido', life: 3000 });
      }
    });
  }

  removeMember(identifier: string): void {
    const id = this.selectedGroup()?.id;
    if (!id) return;
    this.groupService.removeMember(id, identifier).subscribe((updated) => {
      if (updated) {
        this.selectedGroup.set(updated);
        if (this.authService.isBackendMode() && this.authService.isLogged()) {
          this.groupService.fetchByIdFromBackend(id).subscribe((fresh) => {
            if (fresh) this.selectedGroup.set(fresh);
          });
        }
        this.messageService.add({ severity: 'info', summary: 'Miembro eliminado', life: 2500 });
      } else {
        this.messageService.add({ severity: 'warn', summary: 'No se pudo eliminar', life: 2500 });
      }
    });
  }

  // ── Permisos por grupo ────────────────────────────────────────────────────

  /** Abre el diálogo de permisos para un miembro específico del grupo */
  openPermissionsDialog(memberEmail: string): void {
    const group = this.selectedGroup();
    if (!group) return;

    this.permDialogMember.set(memberEmail);
    this.permDialogSelected.set([]);
    this.permDialogVisible.set(true);
    this.permDialogLoading.set(true);

    // Buscar el userId del miembro por su email para llamar la API
    this.authService.listUsersWithBackend().subscribe((users) => {
      const memberUser = users.find(u => u.email?.toLowerCase() === memberEmail.toLowerCase());
      if (!memberUser?.id) {
        this.permDialogLoading.set(false);
        this.messageService.add({ severity: 'warn', summary: 'Usuario no encontrado', detail: `No se encontró el usuario "${memberEmail}" en el sistema.`, life: 4000 });
        this.permDialogVisible.set(false);
        return;
      }

      // Cargar los permisos actuales del miembro en este grupo específico
      this.authService.getUserGroupPermissions(memberUser.id, group.id).subscribe((currentPerms) => {
        this.permDialogSelected.set(currentPerms ?? []);
        this.permDialogLoading.set(false);
        // Guardar el userId para usarlo al salvar
        this._permDialogUserId = memberUser.id!;
      });
    });
  }

  private _permDialogUserId = '';

  /** Persiste los permisos seleccionados en el backend */
  saveGroupPermissions(): void {
    const group = this.selectedGroup();
    if (!group || !this._permDialogUserId) return;

    this.permDialogSaving.set(true);
    this.authService.setUserGroupPermissions(
      this._permDialogUserId,
      group.id,
      this.permDialogSelected()
    ).subscribe({
      next: (saved) => {
        this.permDialogSaving.set(false);
        this.permDialogVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Permisos guardados',
          detail: `Permisos de "${this.permDialogMember()}" en "${group.nombre}" actualizados.`,
          life: 4000,
        });
      },
      error: () => {
        this.permDialogSaving.set(false);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron guardar los permisos.', life: 4000 });
      }
    });
  }

  togglePermission(permKey: string): void {
    const current = this.permDialogSelected();
    if (current.includes(permKey)) {
      this.permDialogSelected.set(current.filter(p => p !== permKey));
    } else {
      this.permDialogSelected.set([...current, permKey]);
    }
  }

  isPermSelected(permKey: string): boolean {
    return this.permDialogSelected().includes(permKey);
  }

  // ── Helpers ───────────────────────────────────────────────────
  nivelSeverity(n: string): TagSeverity {
    return ({ 'Básico': 'success', 'Intermedio': 'warn', 'Avanzado': 'danger' } as any)[n] ?? 'info';
  }
  shortId(id: string): string { return id.slice(-6).toUpperCase(); }
  hasError(f: string, e: string) { const c = this.form.get(f); return !!(c?.touched && c.hasError(e)); }
  onGlobalFilter(e: Event, dt: any): void { dt.filterGlobal((e.target as HTMLInputElement).value, 'contains'); }
}
