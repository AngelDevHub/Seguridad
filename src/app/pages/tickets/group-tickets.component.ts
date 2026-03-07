import { Component, inject, signal, computed, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToolbarModule } from 'primeng/toolbar';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule } from '@angular/forms';
import { MessageService, ConfirmationService } from 'primeng/api';
import { GroupCrudService, Group } from '../../core/services/group-crud.service';
import { TicketService } from '../../core/services/ticket.service';
import { Ticket, TicketStatus, TicketPriority } from '../../core/models/ticket.model';
import { TicketDialogComponent } from './ticket-dialog.component';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-group-tickets',
  standalone: true,
  imports: [
    RouterLink, FormsModule,
    TableModule, ButtonModule, TagModule, SelectModule, ToastModule, ConfirmDialogModule,
    ToolbarModule, IconFieldModule, InputIconModule, InputTextModule, TooltipModule,
    TicketDialogComponent,
  ],
  templateUrl: './group-tickets.component.html',
})
export class GroupTicketsComponent implements OnInit {
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly groupService   = inject(GroupCrudService);
  private readonly ticketService  = inject(TicketService);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);

  @ViewChild('ticketDialog') ticketDialog!: TicketDialogComponent;

  groupId = signal('');
  group   = signal<Group | null>(null);
  viewMode = signal<'kanban' | 'lista'>('kanban');

  // Filters (list view)
  filterEstado    = signal<string>('');
  filterPrioridad = signal<string>('');

  readonly tickets = computed(() => {
    const id = this.groupId();
    return id ? this.ticketService.byGroup(id) : [];
  });

  readonly filteredTickets = computed(() => {
    let t = this.tickets();
    if (this.filterEstado())    t = t.filter(x => x.estado === this.filterEstado());
    if (this.filterPrioridad()) t = t.filter(x => x.prioridad === this.filterPrioridad());
    return t;
  });

  readonly columnsKanban: { status: TicketStatus; label: string; color: string }[] = [
    { status: 'Pendiente',    label: 'Pendiente',   color: '#6b7280' },
    { status: 'En progreso',  label: 'En Progreso', color: '#3b82f6' },
    { status: 'Revisión',     label: 'Revisión',    color: '#f59e0b' },
    { status: 'Finalizado',   label: 'Finalizado',  color: '#22c55e' },
  ];

  estadoOptions    = [ { label: 'Todos', value: '' }, { label: 'Pendiente', value: 'Pendiente' }, { label: 'En progreso', value: 'En progreso' }, { label: 'Revisión', value: 'Revisión' }, { label: 'Finalizado', value: 'Finalizado' }];
  prioridadOptions = [ { label: 'Todas', value: '' }, { label: 'Baja', value: 'Baja' }, { label: 'Media', value: 'Media' }, { label: 'Alta', value: 'Alta' }, { label: 'Crítica', value: 'Crítica' } ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.groupId.set(id);
    this.group.set(this.groupService.getById(id) ?? null);
    if (!this.group()) this.router.navigate(['/group']);
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    return this.tickets().filter(t => t.estado === status);
  }

  newTicket():             void { this.ticketDialog.open(null,   'create', this.groupId()); }
  viewTicket(t: Ticket):  void { this.ticketDialog.open(t,      'view',   this.groupId()); }
  editTicket(t: Ticket):  void { this.ticketDialog.open(t,      'edit',   this.groupId()); }

  confirmDelete(t: Ticket): void {
    this.confirmService.confirm({
      header: 'Eliminar ticket',
      message: `¿Eliminar <strong>"${t.titulo}"</strong>? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar', rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.ticketService.delete(t.id);
        this.messageService.add({ severity: 'info', summary: 'Ticket eliminado', detail: `"${t.titulo}" eliminado.`, life: 3000 });
      },
    });
  }

  statusSeverity(s: TicketStatus): Severity {
    return ({ 'Pendiente': 'secondary', 'En progreso': 'info', 'Revisión': 'warn', 'Finalizado': 'success' } as any)[s];
  }

  prioritySeverity(p: TicketPriority): Severity {
    return ({ 'Baja': 'success', 'Media': 'info', 'Alta': 'warn', 'Crítica': 'danger' } as any)[p];
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-MX');
  }

  onGlobalFilter(e: Event, dt: any): void {
    dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }

  clearFilters(): void {
    this.filterEstado.set('');
    this.filterPrioridad.set('');
  }
}
