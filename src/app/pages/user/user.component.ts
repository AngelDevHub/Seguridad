import { Component, signal } from '@angular/core';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { TagModule } from 'primeng/tag';
import { AvatarModule } from 'primeng/avatar';

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
  imports: [CardModule, DividerModule, TagModule, AvatarModule],
  templateUrl: './user.component.html',
  styles: [`
    .page-header { margin-bottom: 24px; }

    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-surface-900, #1a1a2e);
      margin: 0;
    }

    .page-subtitle {
      font-size: 0.85rem;
      color: var(--p-surface-500, #757575);
      margin: 4px 0 0 0;
    }

    /* ── Profile hero card ────────────────────────── */
    .profile-hero {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 24px;
    }

    .profile-name {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--p-surface-900, #1a1a2e);
      margin: 0 0 6px 0;
    }

    .profile-username {
      font-size: 0.85rem;
      color: var(--p-surface-500, #9e9e9e);
      margin: 0;
    }

    .hero-tags {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }

    /* ── Fields grid ──────────────────────────────── */
    .section-title {
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--p-surface-400, #9e9e9e);
      margin: 0 0 16px 0;
    }

    .fields-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px 32px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .field-label {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--p-surface-400, #9e9e9e);
      margin: 0;
    }

    .field-value {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.9rem;
      color: var(--p-surface-700, #424242);
      font-weight: 500;
    }

    .field-value i {
      color: var(--p-primary-color, #6366f1);
      font-size: 0.9rem;
      width: 16px;
      text-align: center;
    }

    .profile-card {
      max-width: 700px;
    }
  `],
})
export class UserComponent {
  readonly profile = signal<UserProfile>({
    usuario: 'angel.vanguardia',
    nombreCompleto: 'Ángel Vanguardia',
    email: 'angel@miproyecto.dev',
    telefono: '5512345678',
    direccion: 'Av. Reforma 123, CDMX',
    edad: 28,
    rol: 'Administrador',
    fechaRegistro: 'Enero 2024',
  });
}
