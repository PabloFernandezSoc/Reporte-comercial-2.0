import type { AnalisisCliente } from "@/lib/analytics";
import type { MetaCliente } from "@/lib/types";
import type { PuntoBanda } from "./charts";

/** Serie para el gráfico de banda de normalidad de un cliente. */
export function puntosBanda(an: AnalisisCliente, sc: MetaCliente | null, ultimos = 24, extra?: { p: string; real: number }): PuntoBanda[] {
  const pts: PuntoBanda[] = an.venta.puntos.slice(-ultimos).map((p) => ({
    p: p.p,
    real: p.real,
    esperado: p.esperado != null ? Math.round(p.esperado) : null,
    banda: p.bajo != null && p.alto != null ? [Math.round(p.bajo), Math.round(p.alto)] : null,
    meta: sc?.m[p.p] ? +sc.m[p.p] : null,
    z: p.z,
  }));
  if (extra) pts.push({ p: extra.p, real: extra.real, esperado: null, banda: null, meta: sc?.m[extra.p] ? +sc.m[extra.p] : null, z: null, enCurso: true });
  return pts;
}
