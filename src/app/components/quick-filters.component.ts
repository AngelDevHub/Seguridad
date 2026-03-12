import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../core/services/auth.service';
import { TicketPriority } from '../core/models/ticket.model';

export type QuickFilter = 'none' | 'mine' | 'unassigned' | 'high-priority';

/**
 * Componente reutilizable de Filtros Rápidos.
 * Emite el filtro activo mediante Output signal `activeFilter`.
 */
@Component({
  selector: 'app-quick-filters',
  standalone: true,
  imports: [ButtonModule, TagModule, TooltipModule, FormsModule],
  template: `
    <div class="flex align-items-center gap-2 flex-wrap">
      <span class="text-600 text-sm font-semibold">Filtros rápidos:</span>

      <p-button
        [label]="'Mis tickets'"
        icon="pi pi-user"
        [severity]="active() === 'mine' ? 'primary' : 'secondary'"
        [outlined]="active() !== 'mine'"
        size="small"
        (onClick)="toggle('mine')"
        pTooltip="Tickets asignados a ti" />

      <p-button
        [label]="'Sin asignar'"
        icon="pi pi-user-minus"
        [severity]="active() === 'unassigned' ? 'primary' : 'secondary'"
        [outlined]="active() !== 'unassigned'"
        size="small"
        (onClick)="toggle('unassigned')"
        pTooltip="Tickets sin usuario asignado" />

      <p-button
        [label]="'Alta prioridad'"
        icon="pi pi-exclamation-triangle"
        [severity]="active() === 'high-priority' ? 'danger' : 'secondary'"
        [outlined]="active() !== 'high-priority'"
        size="small"
        (onClick)="toggle('high-priority')"
        pTooltip="Tickets con prioridad Alta o Crítica" />

      @if (active() !== 'none') {
        <p-button icon="pi pi-times" severity="secondary" [text]="true" size="small"
          (onClick)="toggle('none')" pTooltip="Limpiar filtro" />
      }
    </div>
  `,
})
export class QuickFiltersComponent {
  private readonly authSvc = inject(AuthService);

  /** Filtro activo actual */
  readonly active = signal<QuickFilter>('none');

  /** Email del usuario actual para filtro "Mis tickets" */
  readonly currentEmail = computed(() =>
    this.authSvc.getCurrentUser()?.email ?? ''
  );

  toggle(f: QuickFilter): void {
    this.active.set(this.active() === f ? 'none' : f);
  }

  /**
   * Aplica el filtro activo a un array de tickets.
   * Se llama desde el componente padre.
   */
  applyTo<T extends { asignadoA: string; prioridad: TicketPriority }>(tickets: T[]): T[] {
    switch (this.active()) {
      case 'mine':
        return tickets.filter(t => t.asignadoA === this.currentEmail());
      case 'unassigned':
        return tickets.filter(t => !t.asignadoA || t.asignadoA.trim() === '');
      case 'high-priority':
        return tickets.filter(t => t.prioridad === 'Alta' || t.prioridad === 'Crítica');
      default:
        return tickets;
    }
  }
}
