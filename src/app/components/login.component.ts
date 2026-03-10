import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { PermissionsService } from '../core/services/permissions.service';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterModule,
    CardModule, InputTextModule, PasswordModule, ButtonModule, MessageModule,
  ],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly permsSvc   = inject(PermissionsService);
  private readonly router      = inject(Router);
  private readonly fb          = inject(FormBuilder);

  form: FormGroup = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  error = '';

  login(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.value;
    const user = this.authService.login(email, password);

    if (user) {
      // Simula carga de permisos desde JWT → carga los permisos del usuario
      this.permsSvc.setPermissions(user.permissions ?? []);
      this.router.navigate(['/dashboard']);
    } else {
      this.error = 'Credenciales incorrectas o cuenta inactiva';
    }
  }
}