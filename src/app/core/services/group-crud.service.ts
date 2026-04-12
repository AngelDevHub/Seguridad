import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import { AuthService } from './auth.service';

export interface Group {
  id: string;
  nombre: string;
  categoria: string;
  nivel: 'Básico' | 'Intermedio' | 'Avanzado';
  autor: string;
  miembros: number;
  tickets: number;
  miembrosList: string[]; // emails o usernames de miembros
  invitedList?: string[];
  _creadorId?: string;
}

const STORAGE_KEY = 'groups';

/** Genera un UUID v4 válido usando la API nativa del browser */
function generateId(): string {
  // crypto.randomUUID() disponible en todos los browsers modernos (Chrome 92+, Firefox 95+, Edge 92+)
  return crypto.randomUUID();
}

/** Valida si un string es un UUID v4 válido */
function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

@Injectable({ providedIn: 'root' })
export class GroupCrudService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly _groups = signal<Group[]>(this.load());
  readonly groups = this._groups.asReadonly();

  private load(): Group[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Group[] = JSON.parse(raw);
        if (parsed.length > 0 && !('categoria' in parsed[0])) return this.seedData();
        // Migrar datos viejos sin miembrosList
        const migrated = parsed.map(g => ({ ...g, miembrosList: g.miembrosList ?? [] }));
        // Si hay IDs inválidos (no son UUIDs), limpiar y re-seedar
        const hasInvalidIds = migrated.some(g => !isValidUUID(g.id));
        if (hasInvalidIds) {
          console.warn('[GroupCrudService] IDs inválidos detectados en caché. Limpiando localStorage...');
          localStorage.removeItem(STORAGE_KEY);
          return this.seedData();
        }
        return migrated;
      }
      return this.seedData();
    } catch {
      return this.seedData();
    }
  }

  refreshFromBackend(): void {
    this.http.get<ApiResponse<any[]>>(`${environment.apiUrl}/groups`).pipe(
      catchError(() => of(null)),
    ).subscribe((res) => {
      if (!res || !res.data) return;
      const mapped: Group[] = (res.data ?? []).map((g: any) => ({
        id: g.id,
        nombre: g.nombre,
        categoria: g.categoria ?? 'General',
        nivel: g.nivel ?? 'Básico',
        autor: g.autor ?? '',
        miembros: g.miembros ?? 0,
        tickets: g.tickets ?? 0,
        miembrosList: Array.isArray(g.miembrosList) ? g.miembrosList : [],
      }));
      // Al recibir datos del backend, reemplazamos completamente el caché local
      // (esto limpia cualquier dato de seedData() con IDs falsos)
      localStorage.removeItem(STORAGE_KEY);
      this.persist(mapped);
    });
  }

  removeFromCache(groupId: string): void {
    const id = String(groupId ?? '').trim();
    if (!id) return;
    const next = this._groups().filter((g) => g.id !== id);
    this.persist(next);
  }

  private seedData(): Group[] {
    const initial: Group[] = [
      { id: generateId(), nombre: 'Alpha Dev', categoria: 'Desarrollo', nivel: 'Avanzado',    autor: 'Ángel V.',  miembros: 12, tickets: 340, miembrosList: ['angel@dev.com', 'laura@dev.com'] },
      { id: generateId(), nombre: 'Beta QA',   categoria: 'Calidad',    nivel: 'Intermedio', autor: 'Laura M.',  miembros: 8,  tickets: 210, miembrosList: ['carlos@qa.com'] },
      { id: generateId(), nombre: 'Gamma UX',  categoria: 'Diseño',     nivel: 'Básico',     autor: 'Carlos R.', miembros: 5,  tickets: 95,  miembrosList: [] },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  private persist(groups: Group[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    this._groups.set([...groups]);
  }

  fetchByIdFromBackend(id: string) {
    return this.http.get<ApiResponse<any>>(`${environment.apiUrl}/groups/${id}`).pipe(
      map((r) => {
        if (!r || !r.data) return null;
        const g = r.data as any;
        const mapped: Group = {
          id: g.id,
          nombre: g.nombre,
          categoria: g.categoria ?? 'General',
          nivel: g.nivel ?? 'Básico',
          autor: g.autor ?? '',
          miembros: g.miembros ?? 0,
          tickets: g.tickets ?? 0,
          miembrosList: Array.isArray(g.miembrosList) ? g.miembrosList : (Array.isArray(g.miembros_list) ? g.miembros_list : []),
          invitedList: Array.isArray(g.invitedList) ? g.invitedList : (Array.isArray(g.invited_list) ? g.invited_list : []),
          _creadorId: g._creadorId ?? g.creador_id ?? undefined,
        };
        return mapped;
      }),
      catchError(() => of(null)),
    );
  }
  getById(id: string): Group | undefined {
    return this._groups().find(g => g.id === id);
  }

  add(data: Pick<Group, 'nombre' | 'categoria' | 'nivel'> & Partial<Pick<Group, 'autor'>>): Observable<Group | null> {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      const payload: any = {
        nombre: data.nombre,
        categoria: data.categoria,
        nivel: data.nivel,
      };
      return this.http.post<ApiResponse<Group>>(`${environment.apiUrl}/groups`, payload).pipe(
        map((r) => {
          if (!r || !r.data) return null;
          const created = r.data as any as Group;
          const next = [...this._groups().filter((g) => g.id !== created.id), created];
          this.persist(next);
          return created;
        }),
        catchError(() => of(null)),
      );
    }

    const newGroup: Group = {
      id: generateId(),
      nombre: data.nombre,
      categoria: data.categoria,
      nivel: data.nivel,
      autor: data.autor ?? '',
      miembros: 1,
      tickets: 0,
      miembrosList: [],
    };
    this.persist([...this._groups(), newGroup]);
    return of(newGroup);
  }

  update(id: string, data: Partial<Pick<Group, 'nombre' | 'categoria' | 'nivel'>>): Observable<Group | null> {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      const payload: any = {};
      if (data.nombre !== undefined) payload.nombre = data.nombre;
      if (data.categoria !== undefined) payload.categoria = data.categoria;
      if (data.nivel !== undefined) payload.nivel = data.nivel;

      return this.http.patch<ApiResponse<Group>>(`${environment.apiUrl}/groups/${id}`, payload).pipe(
        map((r) => {
          if (!r || !r.data) return null;
          const updated = r.data as any as Group;
          const next = this._groups().map((g) => g.id === id ? updated : g);
          this.persist(next);
          return updated;
        }),
        catchError(() => of(null)),
      );
    }

    const list = this._groups();
    const idx = list.findIndex(g => g.id === id);
    if (idx === -1) return of(null);
    const updated: Group = { ...list[idx], ...data };
    this.persist(list.map(g => g.id === id ? updated : g));
    return of(updated);
  }

  delete(id: string): Observable<boolean> {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      return this.http.delete<ApiResponse<any>>(`${environment.apiUrl}/groups/${id}`).pipe(
        map((r) => {
          if (!r) return false;
          const filtered = this._groups().filter(g => g.id !== id);
          this.persist(filtered);
          return true;
        }),
        catchError(() => of(false)),
      );
    }

    const filtered = this._groups().filter(g => g.id !== id);
    if (filtered.length === this._groups().length) return of(false);
    this.persist(filtered);
    return of(true);
  }

  addMember(groupId: string, email: string): Observable<Group | null> {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      return this.http.post<ApiResponse<Group>>(`${environment.apiUrl}/groups/${groupId}/members`, { email }).pipe(
        map((r) => {
          if (!r || !r.data) return null;
          const updated = r.data as any as Group;
          const next = this._groups().map((g) => g.id === groupId ? updated : g);
          this.persist(next);
          return updated;
        }),
        catchError(() => of(null)),
      );
    }

    const group = this._groups().find(g => g.id === groupId);
    if (!group) return of(null);
    const identifier = email.trim().toLowerCase();
    if (!identifier || group.miembrosList.includes(identifier)) return of(null);
    const updated: Group = { ...group, miembrosList: [...group.miembrosList, identifier], miembros: group.miembrosList.length + 1 };
    const next = this._groups().map(g => g.id === groupId ? updated : g);
    this.persist(next);
    return of(updated);
  }

  removeMember(groupId: string, email: string): Observable<Group | null> {
    if (this.auth.isBackendMode() && this.auth.isLogged()) {
      return this.http.delete<ApiResponse<Group>>(`${environment.apiUrl}/groups/${groupId}/members/${encodeURIComponent(email)}`).pipe(
        map((r) => {
          if (!r || !r.data) return null;
          const updated = r.data as any as Group;
          const next = this._groups().map((g) => g.id === groupId ? updated : g);
          this.persist(next);
          return updated;
        }),
        catchError(() => of(null)),
      );
    }

    const group = this._groups().find(g => g.id === groupId);
    if (!group) return of(null);
    const identifier = email.trim().toLowerCase();
    const newList = group.miembrosList.filter(m => m !== identifier);
    if (newList.length === group.miembrosList.length) return of(null);
    const updated: Group = { ...group, miembrosList: newList, miembros: newList.length };
    const next = this._groups().map(g => g.id === groupId ? updated : g);
    this.persist(next);
    return of(updated);
  }
}
