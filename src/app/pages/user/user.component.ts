import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToolbarModule } from 'primeng/toolbar';
import { FieldsetModule } from 'primeng/fieldset';
import { MessageService, ConfirmationService } from 'primeng/api';
import { AuthService } from '../../core/services/auth.service';

export interface UserProfile {
  usuario: string;
  nombreCompleto: string;
  email: string;
  telefono: string;
  direccion: string;
  edad: number;
  rol: string;
  fechaRegistro: string;
}

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule, DividerModule, TagModule, AvatarModule,
    ButtonModule, InputTextModule, InputNumberModule,
    ToastModule, ConfirmDialogModule, ToolbarModule, FieldsetModule,
  ],
  templateUrl: './user.component.html',
})
export class UserComponent implements OnInit {
  private readonly authService       = inject(AuthService);
  private readonly messageService    = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router            = inject(Router);
  private readonly fb                = inject(FormBuilder);

  profile   = signal<UserProfile | null>(null);
  isEditing = signal<boolean>(false);
  isSaving  = signal<boolean>(false);
  editForm!:  FormGroup;

  readonly avatarLabel = computed(() =>
    this.profile()?.nombreCompleto?.charAt(0)?.toUpperCase() ?? '?'
  );

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.profile.set(user ?? {
      usuario: 'angel.vanguardia', nombreCompleto: 'Ángel Vanguardia',
      email: 'angel@miproyecto.dev', telefono: '5512345678',
      direccion: 'Av. Reforma 123, CDMX', edad: 28,
      rol: 'Administrador', fechaRegistro: 'Enero 2024',
    });
    this.buildForm();
  }

  private buildForm(): void {
    const p = this.profile()!;
    this.editForm = this.fb.group({
      usuario:        [p.usuario,        [Validators.required, Validators.pattern(/\S/)]],
      nombreCompleto: [p.nombreCompleto, [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ\u00f1\u00d1]+(\s[a-zA-ZÀ-ÿ\u00f1\u00d1]+)*$/)]],
      email:          [p.email,          [Validators.required, Validators.email]],
      telefono:       [p.telefono,       [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      direccion:      [p.direccion,      [Validators.required, Validators.pattern(/\S/)]],
      edad:           [p.edad,           [Validators.required, Validators.min(18)]],
    });
  }

  startEdit()  { this.buildForm(); this.isEditing.set(true); }
  cancelEdit() { this.isEditing.set(false); }

  saveProfile(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Corrige los errores antes de guardar.', life: 4000 });
      return;
    }
    this.isSaving.set(true);
    const originalEmail = this.profile()!.email;
    const updated: UserProfile = { ...this.profile()!, ...this.editForm.value };
    const result = this.authService.updateUser(originalEmail, updated);
    this.isSaving.set(false);
    if (result.ok || result.reason === 'not_found') {
      this.profile.set(updated);
      this.isEditing.set(false);
      this.messageService.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Los cambios se guardaron correctamente.', life: 3500 });
    } else {
      this.messageService.add({ severity: 'error', summary: 'Correo ya registrado', detail: 'Ese correo ya está en uso por otra cuenta.', life: 5000 });
    }
  }

  confirmDelete(): void {
    this.confirmationService.confirm({
      header: 'Eliminar perfil',
      message: '¿Estás seguro? Esta acción es irreversible.',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.authService.deleteUser(this.profile()!.email);
        this.messageService.add({ severity: 'error', summary: 'Perfil eliminado', detail: 'Redirigiendo...', life: 2500 });
        setTimeout(() => this.router.navigate(['/login']), 2600);
      },
    });
  }

  trimField(ctrl: string, e: Event): void {
    const v = (e.target as HTMLInputElement).value.trim();
    this.editForm.get(ctrl)!.setValue(v);
  }
  onlyDigits(e: KeyboardEvent): boolean { return /^[0-9]$/.test(String.fromCharCode(e.charCode)); }
  limitDigits(e: Event): void {
    const i = e.target as HTMLInputElement;
    const d = i.value.replace(/\D/g,'').slice(0,10);
    if (d !== i.value) { i.value = d; this.editForm.get('telefono')!.setValue(d, { emitEvent: false }); }
  }
  onlyIntegers(e: KeyboardEvent): boolean { return !['.',',','e','E','+','-'].includes(e.key); }
  hasError(f: string, e: string) { const c = this.editForm.get(f); return !!(c?.touched && c.hasError(e)); }
}
