import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';

export function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('contrasena');
  const confirmPassword = control.get('confirmarContrasena');
  if (password && confirmPassword && password.value !== confirmPassword.value && confirmPassword.value) {
    confirmPassword.setErrors({ passwordsMismatch: true });
    return { passwordsMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule
  ],
  templateUrl: './register.component.html'
})
export class RegisterComponent {

  form: FormGroup;
  error = '';
  success = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      usuario: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(10), Validators.pattern(/.*[@#$%&*!].*/)]],
      confirmarContrasena: ['', Validators.required],
      nombreCompleto: ['', Validators.required],
      direccion: ['', Validators.required],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      edad: ['', [Validators.required, Validators.min(18)]]
    }, { validators: passwordsMatchValidator });
  }

  register() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const userData = this.form.value;
    const userToSave = { ...userData, password: userData.contrasena };

    if (this.authService.register(userToSave)) {
      this.success = true;
      this.error = '';
      setTimeout(() => {
        this.router.navigate(['/login']);
      }, 1500);
    } else {
      this.error = 'El correo ya está registrado';
      this.success = false;
    }
  }
}
