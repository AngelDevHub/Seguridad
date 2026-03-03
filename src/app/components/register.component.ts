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
      usuario: ['', [Validators.required, Validators.pattern(/\S/)]],
      email: ['', [Validators.required, Validators.email]],
      contrasena: ['', [Validators.required, Validators.minLength(10), Validators.pattern(/.*[@#$%&*!].*/)]],
      confirmarContrasena: ['', Validators.required],
      nombreCompleto: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÀ-ÿ\u00f1\u00d1]+(\s[a-zA-ZÀ-ÿ\u00f1\u00d1]+)*$/)]],
      direccion: ['', [Validators.required, Validators.pattern(/\S/)]],
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

  /** Elimina espacios duplicados y espacios iniciales en el nombre */
  onNameInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Reemplaza espacios múltiples por uno solo; no permite espacio al inicio
    const cleaned = input.value.replace(/^ +/, '').replace(/ {2,}/g, ' ');
    if (cleaned !== input.value) {
      input.value = cleaned;
      this.form.get('nombreCompleto')!.setValue(cleaned, { emitEvent: false });
    }
  }

  /** Recorta espacios al perder el foco (blur) y actualiza el control reactivo */
  trimField(controlName: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const trimmed = input.value.trim();
    if (trimmed !== input.value) {
      input.value = trimmed;
      this.form.get(controlName)!.setValue(trimmed);
    }
  }

  /** Bloquea cualquier tecla que no sea un dígito (0-9) en el teléfono */
  onlyDigits(event: KeyboardEvent): boolean {
    const char = String.fromCharCode(event.charCode);
    return /^[0-9]$/.test(char);
  }

  /** Trunca el valor del teléfono a 10 dígitos y elimina no-numéricos (cubre paste) */
  limitDigits(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 10);
    if (digits !== input.value) {
      input.value = digits;
      this.form.get('telefono')!.setValue(digits, { emitEvent: false });
    }
  }

  /** Bloquea punto, coma y 'e' en el campo edad para evitar decimales */
  onlyIntegers(event: KeyboardEvent): boolean {
    return !['.',',','e','E','+','-'].includes(event.key);
  }
}
