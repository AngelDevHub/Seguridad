import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupCrudService, Group } from '../../core/services/group-crud.service';

type TagSeverity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [
    ReactiveFormsModule, TableModule, ButtonModule, DialogModule,
    InputTextModule, InputNumberModule, SelectModule, ToastModule,
    ConfirmDialogModule, TagModule, IconFieldModule, InputIconModule, ToolbarModule,
  ],
  templateUrl: './group.component.html',
})
export class GroupComponent implements OnInit {
  private readonly groupService        = inject(GroupCrudService);
  private readonly messageService      = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly fb                  = inject(FormBuilder);

  groups        = this.groupService.groups;
  dialogVisible = signal(false);
  isEditMode    = signal(false);
  editingId     = signal<string | null>(null);
  isSaving      = signal(false);

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
      tockets:   [data?.tockets   ?? 0,  [Validators.required, Validators.min(0)]],
    });
  }

  openNewDialog():         void { this.isEditMode.set(false); this.editingId.set(null); this.buildForm();       this.dialogVisible.set(true); }
  openEditDialog(g: Group): void { this.isEditMode.set(true);  this.editingId.set(g.id);  this.buildForm(g);     this.dialogVisible.set(true); }
  closeDialog():           void { this.dialogVisible.set(false); }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Completa todos los campos requeridos.', life: 4000 });
      return;
    }
    this.isSaving.set(true);
    const data = this.form.value as Omit<Group, 'id'>;
    if (this.isEditMode()) {
      const ok = this.groupService.update(this.editingId()!, data);
      this.isSaving.set(false);
      if (ok) { this.messageService.add({ severity: 'success', summary: 'Grupo actualizado', detail: `"${data.nombre}" actualizado.`, life: 3500 }); this.closeDialog(); }
      else      { this.messageService.add({ severity: 'error',   summary: 'Error',             detail: 'No se pudo actualizar.',                   life: 4000 }); }
    } else {
      this.groupService.add(data); this.isSaving.set(false);
      this.messageService.add({ severity: 'success', summary: 'Grupo creado', detail: `"${data.nombre}" agregado.`, life: 3500 });
      this.closeDialog();
    }
  }

  confirmDelete(g: Group): void {
    this.confirmationService.confirm({
      header: 'Eliminar grupo',
      message: `¿Eliminar <strong>"${g.nombre}"</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const ok = this.groupService.delete(g.id);
        this.messageService.add( ok
          ? { severity: 'info',  summary: 'Eliminado', detail: `"${g.nombre}" fue eliminado.`, life: 3500 }
          : { severity: 'error', summary: 'Error',     detail: 'No se pudo eliminar.',          life: 4000 });
      },
    });
  }

  nivelSeverity(n: string): TagSeverity {
    return ({ 'Básico': 'success', 'Intermedio': 'warn', 'Avanzado': 'danger' } as any)[n] ?? 'info';
  }
  shortId(id: string): string { return id.slice(-6).toUpperCase(); }
  hasError(f: string, e: string) { const c = this.form.get(f); return !!(c?.touched && c.hasError(e)); }
  onGlobalFilter(event: Event, dt: any): void { dt.filterGlobal((event.target as HTMLInputElement).value, 'contains'); }
}
