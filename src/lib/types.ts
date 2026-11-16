/** Etapa comercial del servicio según el estado en Bit ERP. */
export type Etapa = "proyeccion" | "curso" | "finalizado" | "sinclasif";

export const ETAPAS: Record<Etapa, string> = {
  proyeccion: "Proyección de carga",
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
}

export interface MetaCliente {
  c: string; // nombre en el scorecard
  s: string; // segmento
  m: Record<string, number>; // meta por período
  r?: Record<string, number>; // venta de referencia del scorecard
}

export interface Metas {
  general: Record<string, number>;
  seg: Record<string, Record<string, number>>;
  clientes: MetaCliente[];
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
}

export const SEGMENTOS = ["FFWW", "CD", "CAPEX", "CHURN", "SIN CLASIFICAR"] as const;
