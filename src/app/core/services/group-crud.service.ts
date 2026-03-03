import { Injectable, signal } from '@angular/core';

export interface Group {
  id: string;
  nombre: string;
  categoria: string;
  nivel: 'Básico' | 'Intermedio' | 'Avanzado';
  autor: string;
  miembros: number;
  tockets: number;
}

const STORAGE_KEY = 'groups';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

@Injectable({ providedIn: 'root' })
export class GroupCrudService {
  private readonly _groups = signal<Group[]>(this.load());
  readonly groups = this._groups.asReadonly();

  private load(): Group[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: Group[] = JSON.parse(raw);
        // Si los datos anteriores tienen campos viejos, reiniciamos con seed
        if (parsed.length > 0 && !('categoria' in parsed[0])) {
          return this.seedData();
        }
        return parsed;
      }
      return this.seedData();
    } catch {
      return this.seedData();
    }
  }

  private seedData(): Group[] {
    const initial: Group[] = [
      { id: generateId(), nombre: 'Alpha Dev', categoria: 'Desarrollo', nivel: 'Avanzado',    autor: 'Ángel V.',   miembros: 12, tockets: 340 },
      { id: generateId(), nombre: 'Beta QA',   categoria: 'Calidad',     nivel: 'Intermedio', autor: 'Laura M.',   miembros: 8,  tockets: 210 },
      { id: generateId(), nombre: 'Gamma UX',  categoria: 'Diseño',      nivel: 'Básico',     autor: 'Carlos R.',  miembros: 5,  tockets: 95  },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  private persist(groups: Group[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    this._groups.set([...groups]);
  }

  add(data: Omit<Group, 'id'>): Group {
    const newGroup: Group = { id: generateId(), ...data };
    this.persist([...this._groups(), newGroup]);
    return newGroup;
  }

  update(id: string, data: Omit<Group, 'id'>): boolean {
    const list = this._groups();
    const idx = list.findIndex(g => g.id === id);
    if (idx === -1) return false;
    this.persist(list.map(g => g.id === id ? { ...g, ...data } : g));
    return true;
  }

  delete(id: string): boolean {
    const filtered = this._groups().filter(g => g.id !== id);
    if (filtered.length === this._groups().length) return false;
    this.persist(filtered);
    return true;
  }
}
