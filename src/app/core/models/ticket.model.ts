export type TicketStatus   = 'Pendiente' | 'En progreso' | 'Revisión' | 'Finalizado' | 'Bloqueado';
export type TicketPriority = 'Baja' | 'Media' | 'Alta' | 'Crítica';

export interface TicketComment {
  id: string;
  autor: string;
  texto: string;
  fecha: string; // ISO string
}

export interface HistorialCambio {
  id: string;
  campo: string;
  valorAnterior: string;
  valorNuevo: string;
  fecha: string; // ISO string
  usuario: string;
}

export interface Ticket {
  id: string;
  titulo: string;
  descripcion: string;
  estado: TicketStatus;
  asignadoA: string;
  prioridad: TicketPriority;
  fechaCreacion: string; // ISO string
  fechaLimite: string;   // ISO string
  groupId: string;
  /** Email del usuario que creó el ticket */
  creadoPor: string;
  comentarios: TicketComment[];
  historialCambios: HistorialCambio[];
}
