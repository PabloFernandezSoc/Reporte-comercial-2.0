/** Etapa comercial del servicio según el estado en Bit ERP. */
export type Etapa = "proyeccion" | "curso" | "finalizado" | "sinclasif";

export const ETAPAS: Record<Etapa, string> = {
  proyeccion: "Programado (agendado)",
  curso: "En curso",
  finalizado: "Finalizado",
  sinclasif: "Sin clasificar",
};

/** Hecho agregado: una combinación cliente × mandante × período × etapa × ejecutiva × tipo. */
export interface Hecho {
  c: string; // cliente
  m: string; // mandante
  p: string; // período YYYY-MM
  e: Etapa;
  x: string; // ejecutiva
  t: string; // tipo de servicio
  v: number; // venta
  k: number; // costo
  u: number; // utilidad
  s: number; // servicios (fletes únicos)
  w?: string; // semana ISO de la fecha del servicio (ej. "2026-W46")
}

export interface MetaCliente {
  c: string; // nombre en el scorecard
  s: string; // segmento
  m: Record<string, number>; // meta por período
  r?: Record<string, number>; // venta de referencia del scorecard
  cal?: string; // calificación comercial (ACTIVO, SPOT, Churn, INACTIVO…)
  x?: string; // ejecutiva responsable según el plan
}

export interface Metas {
  general: Record<string, number>;
  seg: Record<string, Record<string, number>>;
  clientes: MetaCliente[];
  q4?: { archivo: string; importado: string; periodos: string[] };
}

export interface RespuestaDatos {
  fuente: "erp" | "demo";
  actualizado: string; // ISO
  hoy: string; // YYYY-MM-DD
  filas: number;
  mapeo: Record<string, string>;
  avisos: string[];
  hechos: Hecho[];
  ultimaFecha: Record<string, string>; // cliente → última fecha de servicio (YYYY-MM-DD)
  metas: Metas | null;
  metasFuente: "privado" | "demo" | "ninguna";
  anulados: { servicios: number; venta: number };
  muestra?: Record<string, unknown>[]; // primeras filas crudas del ERP (diagnóstico de mapeo)
  dims?: Record<string, Record<string, number>>; // venta por valores de columnas categóricas
}

export const SEGMENTOS = ["FFWW", "CD", "CAPEX", "CHURN", "SIN CLASIFICAR"] as const;
