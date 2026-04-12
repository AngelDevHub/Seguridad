import { Component, inject, signal, computed, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
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
import { AuthService } from '../../core/services/auth.service';
import { PermissionsService } from '../../core/services/permissions.service';
import { Ticket, TicketStatus, TicketPriority } from '../../core/models/ticket.model';
import { TicketDialogComponent } from './ticket-dialog.component';
import { IfHasPermissionDirective } from '../../core/directives/if-has-permission.directive';
import { QuickFiltersComponent } from '../../components/quick-filters.component';

type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-group-tickets',
  standalone: true,
  imports: [
    RouterLink, FormsModule, DragDropModule,
    TableModule, ButtonModule, TagModule, SelectModule, ToastModule, ConfirmDialogModule,
    ToolbarModule, IconFieldModule, InputIconModule, InputTextModule, TooltipModule,
    TicketDialogComponent, IfHasPermissionDirective, QuickFiltersComponent,
  ],
  templateUrl: './group-tickets.component.html',
})
export class GroupTicketsComponent implements OnInit, OnDestroy {
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);
  private readonly groupService   = inject(GroupCrudService);
  private readonly ticketService  = inject(TicketService);
  private readonly authService    = inject(AuthService);
  readonly permsSvc       = inject(PermissionsService);
  private readonly messageService = inject(MessageService);
  private readonly confirmService = inject(ConfirmationService);

  @ViewChild('ticketDialog') ticketDialog!: TicketDialogComponent;
  @ViewChild('quickFilters') quickFilters!: QuickFiltersComponent;

  groupId  = signal('');
  group    = signal<Group | null>(null);
  viewMode = signal<'kanban' | 'lista'>('kanban');

  // Filters (list view)
  filterEstado    = signal<string>('');
  filterPrioridad = signal<string>('');

  readonly currentUserEmail = computed(() =>
    this.authService.getCurrentUser()?.email ?? ''
  );

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

  readonly columnsKanban: { status: TicketStatus; label: string; color: string; connectedTo: string }[] = [
    { status: 'Pendiente',   label: 'Pendiente',   color: '#6b7280', connectedTo: 'Pendiente' },
    { status: 'En progreso', label: 'En Progreso', color: '#3b82f6', connectedTo: 'En progreso' },
    { status: 'Revisión',    label: 'Revisión',    color: '#f59e0b', connectedTo: 'Revisión' },
    { status: 'Finalizado',  label: 'Finalizado',  color: '#22c55e', connectedTo: 'Finalizado' },
    { status: 'Bloqueado',   label: 'Bloqueado',   color: '#ef4444', connectedTo: 'Bloqueado' },
  ];

  /** IDs de los drop lists para conectarlos entre sí */
  readonly dropListIds = this.columnsKanban.map(c => 'col-' + c.status.replace(/\s/g, '-'));

  estadoOptions    = [ { label: 'Todos', value: '' }, { label: 'Pendiente', value: 'Pendiente' }, { label: 'En progreso', value: 'En progreso' }, { label: 'Revisión', value: 'Revisión' }, { label: 'Finalizado', value: 'Finalizado' }, { label: 'Bloqueado', value: 'Bloqueado' }];
  prioridadOptions = [ { label: 'Todas', value: '' }, { label: 'Baja', value: 'Baja' }, { label: 'Media', value: 'Media' }, { label: 'Alta', value: 'Alta' }, { label: 'Crítica', value: 'Crítica' } ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.groupId.set(id);
    this.permsSvc.setActiveGroup(id);
    this.authService.getMyGroupPermissions(id).subscribe((perms) => {
      this.permsSvc.setGroupPermissions(id, perms);
    });
    this.group.set(this.groupService.getById(id) ?? null);
    if (!this.group()) this.router.navigate(['/group']);
  }

  ngOnDestroy(): void {
    this.permsSvc.clearActiveGroup();
  }

  ticketsByStatus(status: TicketStatus): Ticket[] {
    const base = this.tickets().filter(t => t.estado === status);
    // Aplica filtro rápido si hay uno activo
    return this.quickFilters ? this.quickFilters.applyTo(base) : base;
  }

  /** CDK Drag & Drop — mover ticket a otra columna (doble validación) */
  onTicketDrop(event: CdkDragDrop<Ticket[]>, targetStatus: TicketStatus): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const ticket: Ticket = event.previousContainer.data[event.previousIndex];
    const currentUser    = this.currentUserEmail();

    // ── Validación 1: el usuario debe tener el permiso tickets:move ─────────
    if (!this.permsSvc.hasPermission('tickets:move')) {
      this.messageService.add({
        severity: 'error',
        summary: 'Sin permiso',
        detail: 'No tienes el permiso “tickets:move” para mover tickets.',
        life: 4000,
      });
      return; // NO mover el ticket
    }

    // ── Validación 2: el ticket debe estar asignado al usuario actual ────────
    const asignadoA = ticket.asignadoA ?? '';
    if (!asignadoA || asignadoA !== currentUser) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Ticket no asignado a ti',
        detail: `Solo puedes mover tickets asignados a tu cuenta.`,
        life: 4000,
      });
      return; // NO mover el ticket
    }

    // ── Ambas validaciones superadas — proceder con el movimiento ─────────
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );
    this.ticketService.changeStatus(ticket.id, targetStatus, currentUser);
    this.messageService.add({
      severity: 'info',
      summary: `Estado → ${targetStatus}`,
      detail: ticket.titulo,
      life: 2500,
    });
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
    return ({ 'Pendiente': 'secondary', 'En progreso': 'info', 'Revisión': 'warn', 'Finalizado': 'success', 'Bloqueado': 'danger' } as any)[s];
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
