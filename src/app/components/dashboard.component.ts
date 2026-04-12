import { Component, inject, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { ToolbarModule } from 'primeng/toolbar';
import { ProgressBarModule } from 'primeng/progressbar';
import { DividerModule } from 'primeng/divider';
import { ChipModule } from 'primeng/chip';
import { ChartModule } from 'primeng/chart';
import { MessageService } from 'primeng/api';
import { TicketService } from '../core/services/ticket.service';
import { GroupCrudService } from '../core/services/group-crud.service';
import { AuthService } from '../core/services/auth.service';
import { Ticket, TicketStatus, TicketPriority } from '../core/models/ticket.model';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CardModule, ButtonModule, TagModule, TableModule, ToolbarModule, ProgressBarModule, DividerModule, ChipModule, ChartModule],
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
  readonly bloqueados  = this.ticketService.totalBloqueados;
  readonly total       = this.ticketService.total;

  readonly completionPct = computed(() =>
    this.total() === 0 ? 0 : Math.round((this.finalizados() / this.total()) * 100)
  );

  readonly recentTickets = computed(() => this.ticketService.recentAll(10));

  readonly userName = computed(() =>
    this.authService.getCurrentUser()?.nombreCompleto ?? 'Usuario'
  );

  readonly currentEmail = computed(() =>
    this.authService.getCurrentUser()?.email ?? ''
  );

  /** Grupos donde el usuario actual es miembro */
  readonly myGroups = computed(() => {
    const email = this.currentEmail();
    return this.groupService.groups().filter((g) =>
      g.miembrosList?.some((m: string) => m === email) || g.autor === email
    );
  });

  // ── Datos para gráfico de estados (donut PrimeNG) ──────────────────────────
  /** Datos del gráfico reactive: se actualiza cuando cambian los totales */
  readonly chartData = computed(() => ({
    labels: ['Pendiente', 'En Progreso', 'Revisión', 'Finalizado', 'Bloqueado'],
    datasets: [
      {
        data: [
          this.pendientes(),
          this.enProgreso(),
          this.revision(),
          this.finalizados(),
          this.bloqueados(),
        ],
        backgroundColor: [
          '#6b7280', // Pendiente — gris
          '#3b82f6', // En Progreso — azul
          '#f59e0b', // Revisión — ámbar
          '#22c55e', // Finalizado — verde
          '#ef4444', // Bloqueado — rojo
        ],
        hoverBackgroundColor: [
          '#4b5563',
          '#2563eb',
          '#d97706',
          '#16a34a',
          '#dc2626',
        ],
        borderWidth: 2,
        borderColor: 'transparent',
      },
    ],
  }));

  readonly chartOptions = {
    cutout: '65%',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const pct = total === 0 ? 0 : Math.round((ctx.parsed / total) * 100);
            return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
          },
        },
      },
    },
  };

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
