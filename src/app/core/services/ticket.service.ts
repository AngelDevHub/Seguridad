import { Injectable, signal, computed } from '@angular/core';
import { Ticket, TicketStatus, TicketComment, HistorialCambio } from '../models/ticket.model';

const STORAGE_KEY = 'tickets';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function now(): string {
  return new Date().toISOString();
}

function futureDate(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly _tickets = signal<Ticket[]>(this.load());
  readonly tickets = this._tickets.asReadonly();

  // ── Global computed stats ──────────────────────────────────────
  readonly totalPendientes  = computed(() => this._tickets().filter(t => t.estado === 'Pendiente').length);
  readonly totalEnProgreso  = computed(() => this._tickets().filter(t => t.estado === 'En progreso').length);
  readonly totalRevision    = computed(() => this._tickets().filter(t => t.estado === 'Revisión').length);
  readonly totalFinalizados = computed(() => this._tickets().filter(t => t.estado === 'Finalizado').length);
  readonly total            = computed(() => this._tickets().length);

  // ── Load / Seed ────────────────────────────────────────────────
  private load(): Ticket[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Ticket[] = JSON.parse(raw);
        if (parsed.length > 0 && parsed[0].historialCambios !== undefined) return parsed;
      }
      return this.seedData();
    } catch {
      return this.seedData();
    }
  }

  private seedData(): Ticket[] {
    try {
      const groupsRaw = localStorage.getItem('groups');
      const groups: any[] = groupsRaw ? JSON.parse(groupsRaw) : [];
      if (groups.length === 0) return [];

      const estados: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizado'];
      const prioridades             = ['Alta', 'Media', 'Baja', 'Crítica'] as const;
      const titulos = [
        'Diseñar pantalla principal',
        'Corregir bug de autenticación',
        'Documentar endpoints de API',
        'Revisar métricas del servidor',
      ];
      const tickets: Ticket[] = [];

      groups.slice(0, 2).forEach((g: any) => {
        estados.forEach((estado, i) => {
          const historial: HistorialCambio[] = [{
            id: generateId(), campo: 'estado', valorAnterior: '', valorNuevo: estado,
            fecha: now(), usuario: 'Sistema',
          }];
          tickets.push({
            id: generateId(), groupId: g.id,
            titulo: titulos[i], descripcion: `Descripción detallada del ticket ${i + 1} en el grupo "${g.nombre}".`,
            estado, asignadoA: g.autor ?? 'Sin asignar',
            prioridad: prioridades[i],
            fechaCreacion: now(), fechaLimite: futureDate((i + 1) * 5),
            comentarios: [], historialCambios: historial,
          });
        });
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
      return tickets;
    } catch {
      return [];
    }
  }

  private persist(tickets: Ticket[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    this._tickets.set([...tickets]);
  }

  // ── Queries ───────────────────────────────────────────────────
  byGroup(groupId: string): Ticket[] {
    return this._tickets().filter(t => t.groupId === groupId);
  }

  byGroupAndStatus(groupId: string, status: TicketStatus): Ticket[] {
    return this._tickets().filter(t => t.groupId === groupId && t.estado === status);
  }

  getById(id: string): Ticket | undefined {
    return this._tickets().find(t => t.id === id);
  }

  recentAll(limit = 10): Ticket[] {
    return [...this._tickets()]
      .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion))
      .slice(0, limit);
  }

  // ── CRUD ──────────────────────────────────────────────────────
  add(data: Omit<Ticket, 'id' | 'fechaCreacion' | 'comentarios' | 'historialCambios'>, usuario = 'Sistema'): Ticket {
    const historial: HistorialCambio[] = [{
      id: generateId(), campo: 'estado', valorAnterior: '', valorNuevo: data.estado,
      fecha: now(), usuario,
    }];
    const ticket: Ticket = {
      id: generateId(), ...data, fechaCreacion: now(),
      comentarios: [], historialCambios: historial,
    };
    this.persist([...this._tickets(), ticket]);
    return ticket;
  }

  update(id: string, changes: Partial<Omit<Ticket, 'id' | 'groupId' | 'fechaCreacion' | 'comentarios' | 'historialCambios'>>, usuario = 'Sistema'): boolean {
    const list  = this._tickets();
    const idx   = list.findIndex(t => t.id === id);
    if (idx === -1) return false;

    const old = list[idx];
    const historial = [...old.historialCambios];

    (Object.keys(changes) as (keyof typeof changes)[]).forEach(key => {
      const oldVal = String(old[key] ?? '');
      const newVal = String(changes[key] ?? '');
      if (oldVal !== newVal) {
        historial.push({ id: generateId(), campo: key, valorAnterior: oldVal, valorNuevo: newVal, fecha: now(), usuario });
      }
    });

    const updated = list.map((t, i) => i === idx ? { ...t, ...changes, historialCambios: historial } : t);
    this.persist(updated);
    return true;
  }

  delete(id: string): boolean {
    const filtered = this._tickets().filter(t => t.id !== id);
    if (filtered.length === this._tickets().length) return false;
    this.persist(filtered);
    return true;
  }

  // ── Comentarios ───────────────────────────────────────────────
  addComment(ticketId: string, autor: string, texto: string): boolean {
    const list = this._tickets();
    const idx  = list.findIndex(t => t.id === ticketId);
    if (idx === -1) return false;
    const comment: TicketComment = { id: generateId(), autor, texto, fecha: now() };
    const updated = list.map((t, i) =>
      i === idx ? { ...t, comentarios: [...t.comentarios, comment] } : t
    );
    this.persist(updated);
    return true;
  }

  // ── Cambio rápido de estado ───────────────────────────────────
  changeStatus(ticketId: string, newStatus: TicketStatus, usuario = 'Sistema'): boolean {
    return this.update(ticketId, { estado: newStatus }, usuario);
  }
}
