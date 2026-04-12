import { Component, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TimelineModule } from 'primeng/timeline';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ToastModule } from 'primeng/toast';
import { TextareaModule } from 'primeng/textarea';
import { MessageService } from 'primeng/api';
import { Ticket, TicketStatus, TicketPriority, HistorialCambio } from '../../core/models/ticket.model';
import { TicketService } from '../../core/services/ticket.service';
import { AuthService } from '../../core/services/auth.service';

type DialogMode = 'create' | 'view' | 'edit';
type Severity = 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined;

@Component({
  selector: 'app-ticket-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule,
    DialogModule, ButtonModule, InputTextModule, SelectModule,
    TimelineModule, TagModule, DividerModule, ToastModule, TextareaModule,
  ],
  templateUrl: './ticket-dialog.component.html',
})
export class TicketDialogComponent {
  private readonly ticketService  = inject(TicketService);
  private readonly messageService = inject(MessageService);
  private readonly authService    = inject(AuthService);
  private readonly fb             = inject(FormBuilder);

  visible       = signal(false);
  mode          = signal<DialogMode>('create');
  currentTicket = signal<Ticket | null>(null);
  groupId       = signal('');
  nuevoComentario = '';
  activeTab     = signal<'comentarios' | 'historial'>('comentarios');

  // Form inicializado con valores vacíos para que nunca sea undefined en el template
  form: FormGroup = this.fb.group({
    titulo:      ['', [Validators.required, Validators.minLength(3)]],
    descripcion: ['', [Validators.required]],
    estado:      ['Pendiente', [Validators.required]],
    prioridad:   ['Media',     [Validators.required]],
    asignadoA:   ['',          [Validators.required]],
    fechaLimite: ['',          [Validators.required]],
  });

  readonly dialogHeader = computed(() => ({
    create: 'Nuevo Ticket',
    view:   'Detalle del Ticket',
    edit:   'Editar Ticket',
  }[this.mode()]));

  // ── Permisos diferenciados creador vs. asignado ───────────────
  private readonly currentUserEmail = computed(() =>
    this.authService.getCurrentUser()?.email ?? ''
  );

  /** ¿El usuario actual es el creador del ticket? */
  readonly isCreator = computed(() => {
    const t = this.currentTicket();
    return !t || this.currentUserEmail() === t.creadoPor;
  });

  /** ¿El usuario actual es el asignado al ticket? */
  readonly isAssignee = computed(() => {
    const t = this.currentTicket();
    return !!t && this.currentUserEmail() === t.asignadoA;
  });

  /** Puede editar todos los campos (creador o modo create) */
  readonly canEditAll = computed(() =>
    this.mode() === 'create' || (this.mode() === 'edit' && this.isCreator())
  );

  /** Puede cambiar solo el estado (asignado pero no creador) */
  readonly canChangeStatusOnly = computed(() =>
    this.mode() === 'edit' && !this.isCreator() && this.isAssignee()
  );

  /** Muestra el formulario de edición */
  readonly isEditable = computed(() => this.mode() === 'create' || this.mode() === 'edit');

  estadoOptions: { label: string; value: TicketStatus }[] = [
    { label: 'Pendiente',    value: 'Pendiente' },
    { label: 'En progreso',  value: 'En progreso' },
    { label: 'Revisión',     value: 'Revisión' },
    { label: 'Finalizado',   value: 'Finalizado' },
    { label: 'Bloqueado',    value: 'Bloqueado' },
  ];

  prioridadOptions: { label: string; value: TicketPriority }[] = [
    { label: 'Baja',     value: 'Baja' },
    { label: 'Media',    value: 'Media' },
    { label: 'Alta',     value: 'Alta' },
    { label: 'Crítica',  value: 'Crítica' },
  ];

  // ── Public API ────────────────────────────────────────────────
  open(ticket: Ticket | null, mode: DialogMode, groupId: string): void {
    this.mode.set(mode);
    this.groupId.set(groupId);
    this.nuevoComentario = '';
    this.visible.set(true);
    this.currentTicket.set(ticket);
    this.buildForm(ticket);
    if (ticket && this.authService.isBackendMode() && this.authService.isLogged()) {
      this.ticketService.fetchByIdFromBackend(ticket.id).subscribe((fresh) => {
        if (!fresh) return;
        this.currentTicket.set(fresh);
        this.buildForm(fresh);
      });
    }
  }

  close(): void { this.visible.set(false); }

  switchToEdit(): void {
    this.mode.set('edit');
    this.buildForm(this.currentTicket());
  }

  // ── Form ──────────────────────────────────────────────────────
  private buildForm(t: Ticket | null): void {
    this.form.reset({
      titulo:      t?.titulo      ?? '',
      descripcion: t?.descripcion ?? '',
      estado:      t?.estado      ?? 'Pendiente',
      prioridad:   t?.prioridad   ?? 'Media',
      asignadoA:   t?.asignadoA   ?? '',
      fechaLimite: t?.fechaLimite ? t.fechaLimite.slice(0, 10) : '',
    });
    // Si solo puede cambiar estado, deshabilita los demás campos
    if (this.canChangeStatusOnly()) {
      this.form.get('titulo')?.disable();
      this.form.get('descripcion')?.disable();
      this.form.get('prioridad')?.disable();
      this.form.get('asignadoA')?.disable();
      this.form.get('fechaLimite')?.disable();
    }
  }

  save(): void {
    if (this.form.invalid && !this.canChangeStatusOnly()) {
      this.form.markAllAsTouched();
      this.messageService.add({ severity: 'warn', summary: 'Formulario inválido', detail: 'Corrige los errores.', life: 3500 });
      return;
    }
    const val     = this.form.getRawValue(); // getRawValue incluye campos deshabilitados
    const usuario = this.authService.getCurrentUser()?.email ?? 'Usuario';

    if (this.mode() === 'create') {
      this.ticketService.add({
        titulo: val.titulo, descripcion: val.descripcion,
        estado: val.estado, prioridad: val.prioridad,
        asignadoA: val.asignadoA,
        creadoPor: usuario,
        fechaLimite: new Date(val.fechaLimite).toISOString(),
        groupId: this.groupId(),
      }, usuario);
      this.messageService.add({ severity: 'success', summary: 'Ticket creado', detail: `"${val.titulo}" creado.`, life: 3000 });
    } else if (this.mode() === 'edit' && this.currentTicket()) {
      const ticketId = this.currentTicket()!.id;
      const prevStatus = this.currentTicket()!.estado;
      const nextStatus = val.estado as TicketStatus;

      if (this.isCreator()) {
        const changes: any = {
          titulo: val.titulo,
          descripcion: val.descripcion,
          prioridad: val.prioridad,
          asignadoA: val.asignadoA,
          fechaLimite: new Date(val.fechaLimite).toISOString(),
        };
        this.ticketService.update(ticketId, changes, usuario);
        if (nextStatus !== prevStatus) {
          this.ticketService.changeStatus(ticketId, nextStatus, usuario);
        }
      } else {
        if (nextStatus !== prevStatus) {
          this.ticketService.changeStatus(ticketId, nextStatus, usuario);
        }
      }
      this.messageService.add({ severity: 'success', summary: 'Ticket actualizado', detail: 'Cambios guardados.', life: 3000 });
    }
    this.close();
  }

  addComment(): void {
    if (!this.nuevoComentario.trim() || !this.currentTicket()) return;
    const usuario = this.authService.getCurrentUser()?.email ?? 'Usuario';
    this.ticketService.addComment(this.currentTicket()!.id, usuario, this.nuevoComentario.trim());
    this.currentTicket.set(this.ticketService.getById(this.currentTicket()!.id) ?? null);
    this.nuevoComentario = '';
    this.messageService.add({ severity: 'success', summary: 'Comentario agregado', life: 2500 });
  }

  historialToTimeline(h: HistorialCambio[]) {
    return [...h].reverse().map(e => ({
      status:  `${e.campo}: ${e.valorAnterior || '(nuevo)'} → ${e.valorNuevo}`,
      date:    this.formatDate(e.fecha),
      icon:    'pi pi-history',
      color:   '#6366f1',
      usuario: e.usuario,
    }));
  }

  statusSeverity(s: TicketStatus): Severity {
    return ({ 'Pendiente': 'secondary', 'En progreso': 'info', 'Revisión': 'warn', 'Finalizado': 'success', 'Bloqueado': 'danger' } as any)[s];
  }
  prioritySeverity(p: TicketPriority): Severity {
    return ({ 'Baja': 'success', 'Media': 'info', 'Alta': 'warn', 'Crítica': 'danger' } as any)[p];
  }
  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  }
  hasError(f: string, e: string): boolean {
    const c = this.form.get(f);
    return !!(c?.touched && c.hasError(e));
  }
}
