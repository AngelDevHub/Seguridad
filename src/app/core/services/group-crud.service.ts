import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';

export interface Group {
  id: string;
  nombre: string;
  categoria: string;
  nivel: 'Básico' | 'Intermedio' | 'Avanzado';
  autor: string;
  miembros: number;
  tickets: number;
  miembrosList: string[]; // emails o usernames de miembros
}

const STORAGE_KEY = 'groups';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

@Injectable({ providedIn: 'root' })
export class GroupCrudService {
  private readonly http = inject(HttpClient);
  private readonly _groups = signal<Group[]>(this.load());
  readonly groups = this._groups.asReadonly();

  constructor() {
    this.refreshFromBackend();
  }

  private load(): Group[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Group[] = JSON.parse(raw);
        if (parsed.length > 0 && !('categoria' in parsed[0])) return this.seedData();
        // Migrate old data without miembrosList
        const migrated = parsed.map(g => ({ ...g, miembrosList: g.miembrosList ?? [] }));
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
      if (!res || !res.success) return;
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
      if (mapped.length) this.persist(mapped);
    });
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

  getById(id: string): Group | undefined {
    return this._groups().find(g => g.id === id);
  }

  add(data: Pick<Group, 'nombre' | 'categoria' | 'nivel'> & Partial<Pick<Group, 'autor'>>): Observable<Group | null> {
    if (localStorage.getItem(environment.jwtKey)) {
      const payload: any = {
        nombre: data.nombre,
        categoria: data.categoria,
        nivel: data.nivel,
      };
      return this.http.post<ApiResponse<Group>>(`${environment.apiUrl}/groups`, payload).pipe(
        map((r) => {
          if (!r.success) return null;
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
    if (localStorage.getItem(environment.jwtKey)) {
      const payload: any = {};
      if (data.nombre !== undefined) payload.nombre = data.nombre;
      if (data.categoria !== undefined) payload.categoria = data.categoria;
      if (data.nivel !== undefined) payload.nivel = data.nivel;

      return this.http.patch<ApiResponse<Group>>(`${environment.apiUrl}/groups/${id}`, payload).pipe(
        map((r) => {
          if (!r.success) return null;
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
    if (localStorage.getItem(environment.jwtKey)) {
      return this.http.delete<ApiResponse<any>>(`${environment.apiUrl}/groups/${id}`).pipe(
        map((r) => {
          if (!r.success) return false;
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
    if (localStorage.getItem(environment.jwtKey)) {
      return this.http.post<ApiResponse<Group>>(`${environment.apiUrl}/groups/${groupId}/members`, { email }).pipe(
        map((r) => {
          if (!r.success) return null;
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
    if (localStorage.getItem(environment.jwtKey)) {
      return this.http.delete<ApiResponse<Group>>(`${environment.apiUrl}/groups/${groupId}/members/${encodeURIComponent(email)}`).pipe(
        map((r) => {
          if (!r.success) return null;
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
