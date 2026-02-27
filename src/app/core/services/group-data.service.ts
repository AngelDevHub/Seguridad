import { Injectable, signal, computed } from '@angular/core';

export interface GroupStats {
  total: number;
  advances: number;
}

@Injectable({ providedIn: 'root' })
export class GroupDataService {
  /** Número total de elementos en el grupo */
  private readonly _total = signal<number>(124);

  /** Número de avances registrados */
  private readonly _advances = signal<number>(87);

  /** Señales públicas de sólo lectura */
  readonly total = this._total.asReadonly();
  readonly advances = this._advances.asReadonly();

  /** Porcentaje de avance calculado reactivamente */
  readonly progressPercent = computed<number>(() => {
    const t = this._total();
    return t > 0 ? Math.round((this._advances() / t) * 100) : 0;
  });

  /** Actualiza el total del grupo */
  setTotal(value: number): void {
    this._total.set(value);
  }

  /** Actualiza los avances del grupo */
  setAdvances(value: number): void {
    this._advances.set(value);
  }
}
