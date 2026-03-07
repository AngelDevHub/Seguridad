import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { ProgressBarModule } from 'primeng/progressbar';
import { DividerModule } from 'primeng/divider';
import { MessageService } from 'primeng/api';
import { TicketService } from '../core/services/ticket.service';
import { GroupCrudService } from '../core/services/group-crud.service';
import { AuthService } from '../core/services/auth.service';
import { Ticket, TicketStatus, TicketPriority } from '../core/models/ticket.model';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CardModule, ButtonModule, TagModule, TableModule, ToolbarModule, ProgressBarModule, DividerModule],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  private readonly ticketService = inject(TicketService);
  private readonly groupService  = inject(GroupCrudService);
  private readonly authService   = inject(AuthService);
  private readonly router        = inject(Router);

  readonly pendientes  = this.ticketService.totalPendientes;
  readonly enProgreso  = this.ticketService.totalEnProgreso;
  readonly revision    = this.ticketService.totalRevision;
  readonly finalizados = this.ticketService.totalFinalizados;
  readonly total       = this.ticketService.total;

  readonly completionPct = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.finalizados() / this.total()) * 100)
  );

  readonly recentTickets = computed(() => this.ticketService.recentAll(10));

  readonly userName = computed(() =>
    this.authService.getCurrentUser()?.nombreCompleto ?? 'Usuario'
  );

  statusSeverity(s: TicketStatus): Severity {
    return ({ 'Pendiente': 'secondary', 'En progreso': 'info', 'Revisión': 'warn', 'Finalizado': 'success' } as any)[s];
  }
  prioritySeverity(p: TicketPriority): Severity {
    return ({ 'Baja': 'success', 'Media': 'info', 'Alta': 'warn', 'Crítica': 'danger' } as any)[p];
  }
  groupName(groupId: string): string {
    return this.groupService.getById(groupId)?.nombre ?? groupId;
  }
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX');
  }
  goToGroup(groupId: string): void { this.router.navigate(['/group', groupId]); }
  logout(): void { this.authService.logout(); this.router.navigate(['/login']); }
}
