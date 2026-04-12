import { Component, inject, Injector } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { PermissionsService } from '../core/services/permissions.service';
import { TicketService } from '../core/services/ticket.service';
import { GroupCrudService } from '../core/services/group-crud.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    CardModule, InputTextModule, PasswordModule, ButtonModule, MessageModule, ToastModule
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly permsSvc   = inject(PermissionsService);
  private readonly injector    = inject(Injector);
  private readonly router      = inject(Router);
  private readonly fb          = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';
  // Contador para el easter egg
  logoClickCount = 0;
  private readonly messageService = inject(MessageService);

  onLogoClick(): void {
    this.logoClickCount++;
    if (this.logoClickCount === 5) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Easter Egg',
        detail: 'catch u',
        life: 5000,
      });
      // Reiniciar contador después de activarlo
      this.logoClickCount = 0;
    }
  }

  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.error = '';
    const { email, password } = this.form.value;
    this.authService.loginWithBackend(email, password).subscribe({
      next: (backendUser) => {
        if (backendUser) {
          this.permsSvc.setPermissions(backendUser.permissions ?? []);
          this.injector.get(TicketService).refreshAll();
          this.injector.get(GroupCrudService).refreshFromBackend();
          this.router.navigate(['/dashboard']);
          return;
        }

        const user = this.authService.login(email, password);
        if (user) {
          this.permsSvc.setPermissions(user.permissions ?? []);
          this.router.navigate(['/dashboard']);
          return;
        }

        this.error = 'Credenciales incorrectas o cuenta inactiva';
      },
      error: () => {
        this.error = 'Credenciales incorrectas o cuenta inactiva';
      },
    });
  }
}
