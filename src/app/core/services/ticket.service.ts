import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, tap, Observable } from 'rxjs';
import { Ticket, TicketStatus, TicketComment, HistorialCambio } from '../models/ticket.model';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'tickets';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function now(): string { return new Date().toISOString(); }
function futureDate(days: number): string { return new Date(Date.now() + days * 86_400_000).toISOString(); }

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly _tickets = signal<Ticket[]>(this.load());
  readonly tickets = this._tickets.asReadonly();

  constructor() {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      this.refreshAll();
    }
  }

  // ── Global computed stats ──────────────────────────────────────
  readonly totalPendientes  = computed(() => this._tickets().filter(t => t.estado === 'Pendiente').length);
  readonly totalEnProgreso  = computed(() => this._tickets().filter(t => t.estado === 'En progreso').length);
  readonly totalRevision    = computed(() => this._tickets().filter(t => t.estado === 'Revisión').length);
  readonly totalFinalizados = computed(() => this._tickets().filter(t => t.estado === 'Finalizado').length);
  readonly totalBloqueados  = computed(() => this._tickets().filter(t => t.estado === 'Bloqueado').length);
  readonly total            = computed(() => this._tickets().length);

  // ── Load / Seed ────────────────────────────────────────────────
  private load(): Ticket[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Ticket[] = JSON.parse(raw);
        if (parsed.length > 0 && parsed[0].historialCambios !== undefined) {
          // Migración: agregar creadoPor si falta en tickets existentes
          return parsed.map(t => ({ ...t, creadoPor: t.creadoPor ?? 'admin@test.com' }));
        }
      }
      return this.seedData();
    } catch { return this.seedData(); }
  }

  private seedData(): Ticket[] {
    try {
      const groupsRaw = localStorage.getItem('groups');
      const groups: any[] = groupsRaw ? JSON.parse(groupsRaw) : [];
      if (groups.length === 0) return [];

      const estados: TicketStatus[] = ['Pendiente', 'En progreso', 'Revisión', 'Finalizado', 'Bloqueado'];
      const prioridades             = ['Alta', 'Media', 'Baja', 'Crítica', 'Media'] as const;
      const titulos = [
        'Diseñar pantalla principal',
        'Corregir bug de autenticación',
        'Documentar endpoints de API',
        'Revisar métricas del servidor',
        'Migrar base de datos',
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
            titulo: titulos[i],
            descripcion: `Descripción detallada del ticket ${i + 1} en el grupo "${g.nombre}".`,
            estado, asignadoA: g.autor ?? 'Sin asignar',
            creadoPor: 'admin@test.com',
            prioridad: prioridades[i],
            fechaCreacion: now(), fechaLimite: futureDate((i + 1) * 5),
            comentarios: [], historialCambios: historial,
          });
        });
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
      return tickets;
    } catch { return []; }
  }

  private persist(tickets: Ticket[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
    this._tickets.set([...tickets]);
  }

  refreshAll(): void {
    if (!this.auth.isBackendMode() || !this.auth.isLogged()) return;
    this.http.get<ApiResponse<Ticket[]>>(`${environment.apiUrl}/tickets`).pipe(
      catchError(() => of(null)),
    ).subscribe((res) => {
      if (!res || !res.data) return;
      const list = (res.data ?? []).map((t: any) => ({
        ...t,
        comentarios: t.comentarios ?? [],
        historialCambios: t.historialCambios ?? [],
      })) as Ticket[];
      this.persist(list);
    });
  }

  fetchByIdFromBackend(id: string): Observable<Ticket | null> {
    if (!this.auth.isBackendMode() || !this.auth.isLogged()) return of(null);
    const ticketId = String(id ?? '').trim();
    if (!ticketId) return of(null);
    return this.http.get<ApiResponse<Ticket>>(`${environment.apiUrl}/tickets/${ticketId}`).pipe(
      map((r) => (r && r.data ? (r.data as any as Ticket) : null)),
      tap((t) => {
        if (!t) return;
        const next = [...this._tickets().filter((x) => x.id !== t.id), t]
          .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
        this.persist(next);
      }),
      catchError(() => of(null)),
    );
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
  byUser(email: string): Ticket[] {
    return this._tickets().filter(t => t.asignadoA === email);
  }

  // ── CRUD ──────────────────────────────────────────────────────
  add(data: Omit<Ticket, 'id' | 'fechaCreacion' | 'comentarios' | 'historialCambios'>, usuario = 'Sistema'): Ticket {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      const payload: any = {
        titulo: data.titulo,
        descripcion: data.descripcion,
        estado: data.estado,
        prioridad: data.prioridad,
        asignadoA: data.asignadoA,
        fechaLimite: data.fechaLimite,
        groupId: data.groupId,
      };
      this.http.post<ApiResponse<Ticket>>(`${environment.apiUrl}/tickets`, payload).pipe(
        catchError(() => of(null)),
      ).subscribe((res) => {
        if (!res || !res.data) return;
        const created = res.data as any as Ticket;
        const merged = [...this._tickets().filter((x) => x.id !== created.id), created]
          .sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
        this.persist(merged);
      });
      const temp: Ticket = {
        id: generateId(),
        ...data,
        fechaCreacion: now(),
        comentarios: [],
        historialCambios: [{
          id: generateId(), campo: 'estado', valorAnterior: '', valorNuevo: data.estado,
          fecha: now(), usuario,
        }],
      };
      return temp;
    }
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
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      const payload: any = {};
      if (changes.titulo !== undefined) payload.titulo = changes.titulo;
      if (changes.descripcion !== undefined) payload.descripcion = changes.descripcion;
      if (changes.estado !== undefined) payload.estado = changes.estado;
      if (changes.prioridad !== undefined) payload.prioridad = changes.prioridad;
      if (changes.asignadoA !== undefined) payload.asignadoA = changes.asignadoA;
      if (changes.fechaLimite !== undefined) payload.fechaLimite = changes.fechaLimite;

      this.http.patch<ApiResponse<Ticket>>(`${environment.apiUrl}/tickets/${id}`, payload).pipe(
        catchError(() => of(null)),
      ).subscribe((res) => {
        if (!res || !res.data) return;
        const updated = res.data as any as Ticket;
        const next = this._tickets().map((t) => t.id === id ? updated : t);
        this.persist(next);
      });
      return true;
    }
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
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      this.http.delete<ApiResponse<any>>(`${environment.apiUrl}/tickets/${id}`).pipe(
        catchError(() => of(null)),
      ).subscribe((res) => {
        if (!res) return;
        const filtered = this._tickets().filter(t => t.id !== id);
        this.persist(filtered);
      });
      return true;
    }
    const filtered = this._tickets().filter(t => t.id !== id);
    if (filtered.length === this._tickets().length) return false;
    this.persist(filtered);
    return true;
  }

  // ── Comentarios ───────────────────────────────────────────────
  addComment(ticketId: string, autor: string, texto: string): boolean {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      this.http.post<ApiResponse<Ticket>>(`${environment.apiUrl}/tickets/${ticketId}/comments`, { texto }).pipe(
        catchError(() => of(null)),
      ).subscribe((res) => {
        if (!res || !res.data) return;
        const updated = res.data as any as Ticket;
        const next = this._tickets().map((t) => t.id === ticketId ? updated : t);
        this.persist(next);
      });
      return true;
    }
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
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      this.http.post<ApiResponse<Ticket>>(`${environment.apiUrl}/tickets/${ticketId}/move`, { toStatus: newStatus }).pipe(
        catchError(() => of(null)),
      ).subscribe((res) => {
        if (!res || !res.data) return;
        const updated = res.data as any as Ticket;
        const next = this._tickets().map((t) => t.id === ticketId ? updated : t);
        this.persist(next);
      });
      return true;
    }
    return this.update(ticketId, { estado: newStatus }, usuario);
  }
}
