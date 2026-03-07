import { Component, inject, signal, OnInit } from '@angular/core';
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
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupCrudService, Group } from '../../core/services/group-crud.service';

type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    TableModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule,
    SelectModule, ToastModule, ConfirmDialogModule, TagModule, IconFieldModule,
    InputIconModule, ToolbarModule, ChipModule, DividerModule, CardModule,
  ],
  templateUrl: './group.component.html',
})
export class GroupComponent implements OnInit {
  private readonly groupService        = inject(GroupCrudService);
  private readonly messageService      = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb                  = inject(FormBuilder);
  private readonly router              = inject(Router);

  groups        = this.groupService.groups;
  dialogVisible = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);
  isSaving      = signal(false);

  // Member management
  selectedGroupRow: Group | null = null;  // used for p-table [(selection)]
  selectedGroup   = signal<Group | null>(null);
  newMemberInput  = '';

  nivelOptions = [
    { label: 'Básico',     value: 'Básico' },
    { label: 'Intermedio', value: 'Intermedio' },
    { label: 'Avanzado',   value: 'Avanzado' },
  ];

  form!: FormGroup;

  ngOnInit(): void { this.buildForm(); }

  private buildForm(data?: Partial<Group>): void {
    this.form = this.fb.group({
      nombre:    [data?.nombre    ?? '', [Validators.required, Validators.minLength(2)]],
      categoria: [data?.categoria ?? '', [Validators.required]],
      nivel:     [data?.nivel     ?? 'Básico', [Validators.required]],
      autor:     [data?.autor     ?? '', [Validators.required]],
      miembros:  [data?.miembros  ?? 1,  [Validators.required, Validators.min(1)]],
      tickets:   [data?.tickets   ?? 0,  [Validators.required, Validators.min(0)]],
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
    const full: Omit<Group, 'id'> = { ...formVal, miembrosList: [] };

    if (this.isEditMode()) {
      const existing = this.groupService.getById(this.editingId()!);
      full.miembrosList = existing?.miembrosList ?? [];
      const ok = this.groupService.update(this.editingId()!, full);
      this.isSaving.set(false);
      if (ok) { this.messageService.add({ severity: 'success', summary: 'Grupo actualizado', detail: `"${formVal.nombre}" actualizado.`, life: 3500 }); this.closeDialog(); }
    } else {
      this.groupService.add(full);
      this.isSaving.set(false);
      this.messageService.add({ severity: 'success', summary: 'Grupo creado', detail: `"${formVal.nombre}" agregado.`, life: 3500 });
      this.closeDialog();
    }
  }

  confirmDelete(g: Group): void {
    this.confirmationService.confirm({
      header: 'Eliminar grupo', message: `¿Eliminar <strong>"${g.nombre}"</strong>?`,
      icon: 'pi pi-exclamation-triangle', acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        if (this.selectedGroup()?.id === g.id) this.selectedGroup.set(null);
        const ok = this.groupService.delete(g.id);
        this.messageService.add(ok
          ? { severity: 'info',  summary: 'Eliminado', detail: `"${g.nombre}" fue eliminado.`, life: 3500 }
          : { severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.', life: 4000 });
      },
    });
  }

  // ── Member management ──────────────────────────────────────────
  selectGroup(g: Group | Group[] | undefined): void {
    if (!g || Array.isArray(g)) return;
    this.selectedGroup.set(this.groupService.getById(g.id) ?? g);
  }
  clearSelection(): void { this.selectedGroup.set(null); }

  viewTickets(g: Group): void { this.router.navigate(['/group', g.id]); }

  addMember(): void {
    const id = this.selectedGroup()?.id;
    if (!id || !this.newMemberInput.trim()) return;
    const ok = this.groupService.addMember(id, this.newMemberInput.trim());
    if (ok) {
      this.selectedGroup.set(this.groupService.getById(id) ?? null);
      this.newMemberInput = '';
      this.messageService.add({ severity: 'success', summary: 'Miembro agregado',  life: 2500 });
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Ya existe o inválido', life: 3000 });
    }
  }

  removeMember(identifier: string): void {
    const id = this.selectedGroup()?.id;
    if (!id) return;
    this.groupService.removeMember(id, identifier);
    this.selectedGroup.set(this.groupService.getById(id) ?? null);
    this.messageService.add({ severity: 'info', summary: 'Miembro eliminado', life: 2500 });
  }

  // ── Helpers ───────────────────────────────────────────────────
  nivelSeverity(n: string): TagSeverity {
    return ({ 'Básico': 'success', 'Intermedio': 'warn', 'Avanzado': 'danger' } as any)[n] ?? 'info';
  }
  shortId(id: string): string { return id.slice(-6).toUpperCase(); }
  hasError(f: string, e: string) { const c = this.form.get(f); return !!(c?.touched && c.hasError(e)); }
  onGlobalFilter(e: Event, dt: any): void { dt.filterGlobal((e.target as HTMLInputElement).value, 'contains'); }
}
