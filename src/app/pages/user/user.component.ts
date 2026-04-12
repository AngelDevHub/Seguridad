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
import { TicketService } from '../../core/services/ticket.service';
import { TableModule } from 'primeng/table';
import { environment } from '../../../environments/environment';

import { AppUser } from '../../core/services/auth.service';

export type UserProfile = AppUser & {
  fechaRegistro?: string;
};

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule, DividerModule, TagModule, AvatarModule,
    ButtonModule, InputTextModule, InputNumberModule,
    ToastModule, ConfirmDialogModule, ToolbarModule, FieldsetModule, TableModule,
  ],
  templateUrl: './user.component.html',
})
export class UserComponent implements OnInit {
  private readonly authService          = inject(AuthService);
  private readonly ticketService         = inject(TicketService);
  private readonly messageService        = inject(MessageService);
  private readonly confirmationService   = inject(ConfirmationService);
  private readonly router                = inject(Router);
  private readonly fb                    = inject(FormBuilder);

  profile   = signal<UserProfile | null>(null);
  isEditing = signal<boolean>(false);
  isSaving  = signal<boolean>(false);
  editForm!:  FormGroup;

  readonly avatarLabel = computed(() =>
    this.profile()?.nombreCompleto?.charAt(0)?.toUpperCase() ?? '?'
  );

  /** Tickets asignados al usuario actual */
  readonly myTickets = computed(() => {
    const email = this.profile()?.email ?? '';
    return email ? this.ticketService.byUser(email) : [];
  });

  readonly myTicketsOpen     = computed(() => this.myTickets().filter(t => t.estado === 'Pendiente' || t.estado === 'Bloqueado').length);
  readonly myTicketsProgress = computed(() => this.myTickets().filter(t => t.estado === 'En progreso' || t.estado === 'Revisión').length);
  readonly myTicketsDone     = computed(() => this.myTickets().filter(t => t.estado === 'Finalizado').length);

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    const initial = user ?? {
      email: 'usuario@demo.com',
      password: '',
      permissions: [],
      active: true,
      nombreCompleto: 'Usuario Demo',
      usuario: 'demo',
      telefono: '',
      direccion: '',
      edad: 0,
      fechaRegistro: 'N/A',
    };
    this.profile.set(this.withDerivedFields(initial));
    this.buildForm();

    if (this.authService.isBackendMode() && this.authService.isLogged()) {
      this.authService.getMeWithBackend().subscribe((fresh) => {
        if (!fresh) return;
        this.profile.set(this.withDerivedFields({ ...this.profile(), ...fresh }));
        if (!this.isEditing()) this.buildForm();
      });
    }
  }

  private withDerivedFields(p: UserProfile): UserProfile {
    const permissions = p.permissions ?? [];
    const fechaRaw = p.fechaRegistro ?? p.fechaInicio ?? '';
    const fechaRegistro = fechaRaw ? String(fechaRaw).slice(0, 10) : 'N/A';

    const edad = typeof p.edad === 'number' && p.edad > 0 ? p.edad : (p.edad ?? 0);

    return {
      ...p,
      usuario: p.usuario ?? p.username ?? '',
      telefono: p.telefono ?? '',
      direccion: p.direccion ?? '',
      edad,
      fechaRegistro,
    };
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
    const current = this.profile()!;
    const updated: UserProfile = { ...current, ...this.editForm.value };

    if (current.id) {
      this.authService.updateUserWithBackend(current.id, updated).subscribe((res) => {
        this.isSaving.set(false);
        if (res) {
          this.profile.set(this.withDerivedFields({ ...updated, ...res, permissions: res.permissions ?? updated.permissions }));
          localStorage.setItem(environment.currentUserKey, JSON.stringify({
            id: res.id ?? current.id,
            nombre_completo: (res.nombreCompleto ?? updated.nombreCompleto) ?? '',
            username: (updated.usuario ?? res.usuario ?? res.username) ?? '',
            email: (res.email ?? updated.email) ?? '',
            permissions: res.permissions ?? updated.permissions ?? [],
            telefono: updated.telefono ?? res.telefono ?? '',
            direccion: updated.direccion ?? res.direccion ?? '',
            fecha_inicio: res.fechaInicio ?? current.fechaInicio ?? null,
            fecha_nacimiento: res.fechaNacimiento ?? current.fechaNacimiento ?? null,
          }));
          this.isEditing.set(false);
          this.messageService.add({ severity: 'success', summary: 'Perfil actualizado', detail: 'Los cambios se guardaron correctamente.', life: 3500 });
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el perfil.', life: 5000 });
        }
      });
      return;
    }

    const originalEmail = current.email;
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
        const p = this.profile()!;
        if (p.id) {
          this.authService.deleteUserWithBackend(p.id).subscribe(() => {
            this.authService.logout();
            this.messageService.add({ severity: 'error', summary: 'Perfil eliminado', detail: 'Redirigiendo...', life: 2500 });
            setTimeout(() => this.router.navigate(['/login']), 2600);
          });
        } else {
          this.authService.deleteUser(p.email);
          this.messageService.add({ severity: 'error', summary: 'Perfil eliminado', detail: 'Redirigiendo...', life: 2500 });
          setTimeout(() => this.router.navigate(['/login']), 2600);
        }
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
