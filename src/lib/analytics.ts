/** Modelo de análisis: filtros, agregaciones, metas, fluctuaciones y alertas. */
import {
  analizarSerie,
  diagnosticar,
  indiceEstacional,
  mediana,
  type AnalisisSerie,
  type ResultadoDiagnostico,
  type Umbrales,
} from "./anomaly";
import { clp, mes, pct, rangoPeriodos, sumarMes } from "./format";
import { Cruce, segmentoPorNombre } from "./metas";
import type { Etapa, Hecho, MetaCliente, Metas, RespuestaDatos } from "./types";

export interface Filtros {
  desde: string;
  hasta: string;
  segmento: string;
  ejecutiva: string;
  etapa: Etapa | "";
  buscar: string;
}

export interface InfoCliente {
  nombre: string;
  segmento: string;
  scorecard: MetaCliente | null;
  ejecutiva: string;
  calificacion: string;
  segProvisorio: boolean; // segmento deducido por nombre: confirmar
}

export interface Modelo {
  datos: RespuestaDatos;
  metas: Metas | null;
  periodos: string[];
  mesActual: string;
  mesCerrado: string;
  clientes: Map<string, InfoCliente>;
  ejecutivas: string[];
  segmentos: string[];
  estacional: number[];
}

export function construirModelo(datos: RespuestaDatos, metas: Metas | null, alias: Record<string, string>): Modelo {
  const cruce = new Cruce(metas, alias);
  const mesActual = datos.hoy.slice(0, 7);
  const mesCerrado = sumarMes(mesActual, -1);
  const ps = [...new Set(datos.hechos.map((h) => h.p))].sort();
  const periodos = ps.length ? rangoPeriodos(ps[0], ps[ps.length - 1] > mesActual ? ps[ps.length - 1] : mesActual) : [mesActual];

  const ejeVenta = new Map<string, Map<string, number>>();
  for (const h of datos.hechos) {
    if (!ejeVenta.has(h.c)) ejeVenta.set(h.c, new Map());
    if (h.x) {
      const m = ejeVenta.get(h.c)!;
      m.set(h.x, (m.get(h.x) || 0) + h.v + 1);
    }
  }
  const clientes = new Map<string, InfoCliente>();
  for (const [c, m] of ejeVenta) {
    const sc = cruce.buscar(c);
    // si el ERP no informa ejecutiva, se usa la del plan de metas
    const eje = [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || sc?.x || "";
    // sin fila en el plan: segmento provisorio por nombre para que los totales por cartera cuadren
    const seg = sc && (sc.s === "FFWW" || sc.s === "CD") ? sc.s : segmentoPorNombre(c);
    clientes.set(c, { nombre: c, segmento: seg, scorecard: sc, ejecutiva: eje, calificacion: sc?.cal ?? "", segProvisorio: !sc || sc.sf === "nombre" });
  }
  const ejecutivas = [...new Set([...clientes.values()].map((c) => c.ejecutiva).filter(Boolean))].sort();
  const segmentos = ["FFWW", "CD", "CAPEX", "CHURN", "SIN CLASIFICAR"].filter((s) => [...clientes.values()].some((c) => c.segmento === s));

  // estacionalidad de la empresa con meses cerrados
  const cerrados = periodos.filter((p) => p <= mesCerrado);
  const tot = new Map<string, number>();
  for (const h of datos.hechos) tot.set(h.p, (tot.get(h.p) || 0) + h.v);
  const estacional = indiceEstacional(cerrados, cerrados.map((p) => tot.get(p) || 0));

  return { datos, metas, periodos, mesActual, mesCerrado, clientes, ejecutivas, segmentos, estacional };
}

/* ---------------- filtros ---------------- */

export const ejecutivaDe = (M: Modelo, h: Hecho) => h.x || M.clientes.get(h.c)?.ejecutiva || "";

export function periodosFiltrados(M: Modelo, F: Filtros): string[] {
  return M.periodos.filter((p) => (!F.desde || p >= F.desde) && (!F.hasta || p <= F.hasta));
}

const normB = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function pasaCliente(M: Modelo, F: Filtros, c: string): boolean {
  const info = M.clientes.get(c);
  if (F.segmento && info?.segmento !== F.segmento) return false;
  if (F.buscar && !normB(c).includes(normB(F.buscar))) return false;
  return true;
}

/** Lo programado (servicios agendados a futuro) no es venta realizada: se excluye salvo que se pida. */
export const esRealizado = (h: Hecho) => h.e !== "proyeccion";

export function hechosFiltrados(M: Modelo, F: Filtros, opts: { ignorarPeriodo?: boolean; ignorarEtapa?: boolean; incluirProgramado?: boolean } = {}): Hecho[] {
  return M.datos.hechos.filter((h) => {
    if (!opts.ignorarPeriodo && ((F.desde && h.p < F.desde) || (F.hasta && h.p > F.hasta))) return false;
    if (!opts.ignorarEtapa && F.etapa && h.e !== F.etapa) return false;
    if (!F.etapa && !opts.incluirProgramado && !esRealizado(h)) return false;
    if (F.ejecutiva && ejecutivaDe(M, h) !== F.ejecutiva) return false;
    return pasaCliente(M, F, h.c);
  });
}

/* ---------------- agregaciones ---------------- */

export interface PuntoMes {
  p: string;
  venta: number;
  costo: number;
  util: number;
  serv: number;
  prog: number; // venta programada (agendada a futuro), aparte de la venta realizada
  etapas: Record<Etapa, number>;
}

export function serieMensual(hechos: Hecho[], periodos: string[]): PuntoMes[] {
  const m = new Map<string, PuntoMes>();
  periodos.forEach((p) => m.set(p, { p, venta: 0, costo: 0, util: 0, serv: 0, prog: 0, etapas: { proyeccion: 0, curso: 0, finalizado: 0, sinclasif: 0 } }));
  for (const h of hechos) {
    const o = m.get(h.p);
    if (!o) continue;
    o.etapas[h.e] += h.s;
    if (!esRealizado(h)) {
      o.prog += h.v;
      continue;
    }
    o.venta += h.v;
    o.costo += h.k;
    o.util += h.u;
    o.serv += h.s;
  }
  return periodos.map((p) => m.get(p)!);
}

export interface ClienteAgg {
  nombre: string;
  segmento: string;
  ejecutiva: string;
  scorecard: MetaCliente | null;
  venta: number;
  costo: number;
  util: number;
  serv: number;
  margen: number;
  ticket: number;
  meta: number;
  cumpl: number | null;
  meses: Record<string, { v: number; s: number; u: number }>;
  mandantes: number;
}

export function metaCliente(sc: MetaCliente | null, periodos: string[]): number {
  if (!sc) return 0;
  return periodos.reduce((a, p) => a + (+sc.m[p] || 0), 0);
}

export function agruparClientes(M: Modelo, F: Filtros, hechos: Hecho[], periodos: string[]): ClienteAgg[] {
  const map = new Map<string, ClienteAgg & { _m: Set<string> }>();
  const nuevo = (c: string) => {
    const info = M.clientes.get(c);
    return {
      nombre: c, segmento: info?.segmento ?? "SIN CLASIFICAR", ejecutiva: info?.ejecutiva ?? "", scorecard: info?.scorecard ?? null,
      venta: 0, costo: 0, util: 0, serv: 0, margen: 0, ticket: 0, meta: 0, cumpl: null, meses: {}, mandantes: 0, _m: new Set<string>(),
    };
  };
  for (const h of hechos) {
    let o = map.get(h.c);
    if (!o) map.set(h.c, (o = nuevo(h.c)));
    o.venta += h.v;
    o.costo += h.k;
    o.util += h.u;
    o.serv += h.s;
    if (h.m) o._m.add(h.m);
    const mm = (o.meses[h.p] ||= { v: 0, s: 0, u: 0 });
    mm.v += h.v;
    mm.s += h.s;
    mm.u += h.u;
  }
  // clientes con meta en el rango pero sin venta: también cuentan (son brecha)
  if (!F.etapa) {
    for (const [c, info] of M.clientes) {
      if (map.has(c) || !info.scorecard) continue;
      if (F.ejecutiva && info.ejecutiva !== F.ejecutiva) continue;
      if (!pasaCliente(M, F, c)) continue;
      if (metaCliente(info.scorecard, periodos) > 0) map.set(c, nuevo(c));
    }
  }
  const vistos = new Set<MetaCliente>();
  return [...map.values()]
    .map(({ _m, ...o }) => {
      // si dos nombres del ERP calzan con la misma fila del scorecard, la meta se cuenta una vez
      const meta = o.scorecard && !vistos.has(o.scorecard) ? metaCliente(o.scorecard, periodos) : 0;
      if (o.scorecard) vistos.add(o.scorecard);
      return {
        ...o,
        mandantes: _m.size,
        meta,
        cumpl: meta > 0 ? (o.venta / meta) * 100 : null,
        margen: o.venta > 0 ? (o.util / o.venta) * 100 : 0,
        ticket: o.serv > 0 ? o.venta / o.serv : 0,
      };
    })
    .sort((a, b) => b.venta - a.venta);
}

/** Meta del mes según el nivel de filtro: general, segmento o suma de clientes. */
export function metaPeriodo(M: Modelo, F: Filtros, p: string, lista: ClienteAgg[]): { v: number; fuente: "general" | "segmento" | "clientes" } {
  const mt = M.metas;
  if (!mt) return { v: 0, fuente: "clientes" };
  const sinFiltroCli = !F.ejecutiva && !F.buscar;
  if (sinFiltroCli && !F.segmento && mt.general[p]) return { v: mt.general[p], fuente: "general" };
  if (sinFiltroCli && F.segmento && mt.seg[F.segmento]?.[p]) return { v: mt.seg[F.segmento][p], fuente: "segmento" };
  const vistos = new Set<MetaCliente>();
  let v = 0;
  for (const c of lista) {
    if (!c.scorecard || vistos.has(c.scorecard)) continue;
    vistos.add(c.scorecard);
    v += +c.scorecard.m[p] || 0;
  }
  return { v, fuente: "clientes" };
}

export function etiquetaFuenteMeta(f: string) {
  return f === "general" ? "Plan de ventas general" : f === "segmento" ? "Meta del segmento" : "Suma de metas por cliente";
}

/* ---------------- fluctuaciones por cliente ---------------- */

export interface AnalisisCliente {
  nombre: string;
  info: InfoCliente;
  periodos: string[];
  venta: AnalisisSerie;
  serv: AnalisisSerie;
  dVenta: ResultadoDiagnostico;
  dServ: ResultadoDiagnostico;
  mandantes: { nombre: string; esperado: number; real: number; delta: number }[];
  ultimaFecha?: string;
  diasSinServicio?: number;
}

/** Analiza todos los clientes con historia completa hasta el mes de análisis. */
export function analizarClientes(M: Modelo, F: Filtros, mesAnalisis: string, u: Umbrales): AnalisisCliente[] {
  const periodos = M.periodos.filter((p) => p <= mesAnalisis);
  if (!periodos.length) return [];
  const idx = periodos.length - 1;
  const porCli = new Map<string, Hecho[]>();
  for (const h of M.datos.hechos) {
    if (h.p > mesAnalisis || !esRealizado(h)) continue;
    if (F.ejecutiva && ejecutivaDe(M, h) !== F.ejecutiva) continue;
    if (!pasaCliente(M, F, h.c)) continue;
    (porCli.get(h.c) || porCli.set(h.c, []).get(h.c)!).push(h);
  }
  const hoy = new Date(M.datos.hoy + "T12:00:00");
  const out: AnalisisCliente[] = [];
  for (const [c, hs] of porCli) {
    const v = new Map<string, number>();
    const s = new Map<string, number>();
    const porMand = new Map<string, Map<string, number>>();
    for (const h of hs) {
      v.set(h.p, (v.get(h.p) || 0) + h.v);
      s.set(h.p, (s.get(h.p) || 0) + h.s);
      const k = h.m || "(sin mandante)";
      if (!porMand.has(k)) porMand.set(k, new Map());
      const mm = porMand.get(k)!;
      mm.set(h.p, (mm.get(h.p) || 0) + h.v);
    }
    const aV = analizarSerie(periodos, periodos.map((p) => v.get(p) || 0), M.estacional);
    const aS = analizarSerie(periodos, periodos.map((p) => s.get(p) || 0), M.estacional);
    const prev6 = periodos.slice(Math.max(0, idx - 6), idx);
    const mandantes = [...porMand.entries()]
      .map(([nombre, mm]) => {
        const esperado = mediana(prev6.map((p) => mm.get(p) || 0));
        const real = mm.get(mesAnalisis) || 0;
        return { nombre, esperado, real, delta: real - esperado };
      })
      .sort((a, b) => a.delta - b.delta);
    const uf = M.datos.ultimaFecha[c];
    out.push({
      nombre: c,
      info: M.clientes.get(c)!,
      periodos,
      venta: aV,
      serv: aS,
      dVenta: diagnosticar(aV, idx, u),
      dServ: diagnosticar(aS, idx, { ...u, brechaMinClp: 0 }),
      mandantes,
      ultimaFecha: uf,
      diasSinServicio: uf ? Math.floor((hoy.getTime() - new Date(uf + "T12:00:00").getTime()) / 86400000) : undefined,
    });
  }
  return out;
}

/* ---------------- alertas ---------------- */

export type TipoAlerta =
  | "fuga"
  | "caida"
  | "tendencia"
  | "vigilancia"
  | "brecha-meta"
  | "margen"
  | "nuevo"
  | "alza";

export const TIPO_ALERTA: Record<TipoAlerta, { label: string; tono: "risk" | "warn" | "ok" | "n" | "info" }> = {
  fuga: { label: "Fuga de cliente", tono: "risk" },
  caida: { label: "Caída anómala", tono: "risk" },
  tendencia: { label: "Tendencia a la baja", tono: "warn" },
  vigilancia: { label: "Bajo vigilancia", tono: "warn" },
  "brecha-meta": { label: "Brecha a meta", tono: "warn" },
  margen: { label: "Erosión de margen", tono: "warn" },
  nuevo: { label: "Cliente nuevo", tono: "info" },
  alza: { label: "Crecimiento anómalo", tono: "ok" },
};

export interface Alerta {
  id: string;
  tipo: TipoAlerta;
  prioridad: 1 | 2 | 3;
  cliente: string;
  segmento: string;
  ejecutiva: string;
  periodo: string;
  impacto: number;
  confianza: number | null;
  titulo: string;
  diag: string;
  evidencia: string[];
  accion: string;
}

export function generarAlertas(M: Modelo, analisis: AnalisisCliente[], mesAnalisis: string, u: Umbrales): Alerta[] {
  const out: Alerta[] = [];
  const anio = mesAnalisis.slice(0, 4);
  const ytd = M.periodos.filter((p) => p.startsWith(anio) && p <= mesAnalisis);
  const mk = (a: AnalisisCliente, tipo: TipoAlerta, prioridad: 1 | 2 | 3, impacto: number, x: Partial<Alerta>): Alerta => ({
    id: `${tipo}|${a.nombre}|${mesAnalisis}`,
    tipo,
    prioridad,
    cliente: a.nombre,
    segmento: a.info.segmento,
    ejecutiva: a.info.ejecutiva,
    periodo: mesAnalisis,
    impacto,
    confianza: null,
    titulo: "",
    diag: "",
    evidencia: [],
    accion: "",
    ...x,
  });

  for (const a of analisis) {
    const d = a.dVenta;
    const ds = a.dServ;
    const vt = a.venta.variacionTipica;
    const caidaMand = a.mandantes.filter((m) => m.delta < 0);
    const totNeg = caidaMand.reduce((x, m) => x + m.delta, 0);
    const evid: string[] = [];
    if (caidaMand.length && totNeg < 0) {
      const top = caidaMand.slice(0, 2).map((m) => `${m.nombre} (${clp(m.esperado)} → ${clp(m.real)}, ${pct((m.delta / totNeg) * 100, 0)} de la caída)`);
      evid.push(`Mandantes que explican la baja: ${top.join("; ")}.`);
    }
    if (ds.esperado != null) evid.push(`Servicios: ${Math.round(ds.real)} vs ${Math.round(ds.esperado)} habituales${ds.z != null ? ` (z ${ds.z.toFixed(1)})` : ""}.`);
    if (a.diasSinServicio != null) evid.push(`Último servicio registrado hace ${a.diasSinServicio} días (${a.ultimaFecha}).`);
    evid.push(`Variación mensual habitual del cliente: ±${pct(vt, 0)}.`);

    if (d.diag === "fuga") {
      out.push(mk(a, "fuga", 1, d.esperado ?? 0, {
        confianza: d.confianza,
        titulo: `Sin venta en ${mes(mesAnalisis)}`,
        diag: `Se esperaban ~${clp(d.esperado)} según su historia y no hubo facturación. El cliente casi nunca tiene meses en cero (${pct(a.venta.tasaCeros * 100, 0)} de su historia).`,
        evidencia: evid,
        accion: "Contacto de la ejecutiva esta semana: confirmar si migró a otro operador, si hay un reclamo o incidencia abierta, o si es una pausa planificada. Registrar el motivo y preparar oferta de recuperación.",
      }));
    } else if (d.diag === "caida-significativa") {
      out.push(mk(a, "caida", d.confianza >= 0.99 ? 1 : 2, d.brecha, {
        confianza: d.confianza,
        titulo: `Venta ${pct(d.caidaPct, 0)} bajo lo normal`,
        diag: `${clp(d.real)} vs ${clp(d.esperado)} esperados en ${mes(mesAnalisis)}. La caída supera su variación habitual (z ${d.z?.toFixed(1)}): no es una fluctuación normal de su carga.`,
        evidencia: evid,
        accion: caidaMand.length && totNeg < 0
          ? `Revisar con el cliente qué pasó con ${caidaMand[0].nombre}: si el volumen se fue a otro proveedor, presentar oferta de recuperación; si es una baja de su operación, ofrecer servicios complementarios.`
          : "Llamar al cliente para entender la baja de volumen y contrastar tarifas con la competencia.",
      }));
    } else if (d.diag === "tendencia-baja") {
      out.push(mk(a, "tendencia", 2, d.brecha * d.rachaBaja, {
        confianza: d.confianza,
        titulo: `${d.rachaBaja} meses seguidos bajo lo normal`,
        diag: `Cada mes por sí solo parece una fluctuación, pero ${d.rachaBaja} meses consecutivos bajo lo esperado indican una pérdida gradual de participación.`,
        evidencia: evid,
        accion: "Agendar reunión de revisión de cuenta: nivel de servicio, tarifas y planes de carga del próximo trimestre. Proponer acuerdo de volumen.",
      }));
    } else if (d.diag === "bajo-vigilancia" && d.brecha >= u.brechaMinClp) {
      out.push(mk(a, "vigilancia", 3, d.brecha, {
        confianza: d.confianza,
        titulo: `Venta ${pct(d.caidaPct, 0)} bajo lo esperado`,
        diag: `Está en el borde de su variación normal (z ${d.z?.toFixed(1)}). Aún no es alerta; si el próximo mes repite, se convierte en tendencia.`,
        evidencia: evid,
        accion: "Seguimiento liviano: confirmar la programación de cargas del próximo mes.",
      }));
    } else if (d.diag === "nuevo") {
      out.push(mk(a, "nuevo", 3, d.real, {
        titulo: `Primera venta en ${mes(mesAnalisis)}`,
        diag: `Facturó ${clp(d.real)} en su primer mes.`,
        evidencia: [],
        accion: "Asegurar la segunda compra dentro de 30 días: confirmar calidad del servicio y dejar agendado el próximo embarque.",
      }));
    } else if (d.diag === "alza") {
      out.push(mk(a, "alza", 3, -d.brecha, {
        titulo: `Venta ${pct(-(d.caidaPct ?? 0), 0)} sobre lo normal`,
        diag: `${clp(d.real)} vs ${clp(d.esperado)} esperados. Crecimiento fuera de su patrón.`,
        evidencia: [],
        accion: "Oportunidad: asegurar capacidad, entender el origen del crecimiento y formalizarlo con un acuerdo de volumen o tarifa.",
      }));
    }

    // brecha a meta acumulada del año
    const sc = a.info.scorecard;
    if (sc) {
      const meta = ytd.reduce((x, p) => x + (+sc.m[p] || 0), 0);
      const real = ytd.filter((p) => +sc.m[p] > 0).reduce((x, p) => x + (a.venta.puntos.find((q) => q.p === p)?.real || 0), 0);
      const cumpl = meta > 0 ? (real / meta) * 100 : null;
      if (cumpl != null && cumpl < u.umbralAlerta && meta - real >= u.brechaMinClp && d.diag !== "fuga") {
        const tk = a.venta.puntos.length ? real / Math.max(1, ytd.reduce((x, p) => x + (a.serv.puntos.find((q) => q.p === p)?.real || 0), 0)) : 0;
        out.push(mk(a, "brecha-meta", 2, meta - real, {
          titulo: `Cumplimiento ${pct(cumpl, 0)} del año`,
          diag: `Acumulado ${anio}: ${clp(real)} contra meta ${clp(meta)}. Faltan ${clp(meta - real)}.`,
          evidencia: [`Equivale a ~${Math.ceil(tk > 0 ? (meta - real) / tk : 0)} servicios al ticket promedio de ${clp(tk)}.`],
          accion: "Definir con la ejecutiva un plan de cierre de brecha: servicios adicionales, nuevos mandantes o servicios complementarios.",
        }));
      }
    }

    // erosión de margen: margen últimos 3 meses vs 9 anteriores
    const hs = a.periodos;
    const ult3 = new Set(hs.slice(-3));
    const ant9 = new Set(hs.slice(-12, -3));
    let v3 = 0, u3 = 0, v9 = 0, u9 = 0;
    for (const h of M.datos.hechos) {
      if (h.c !== a.nombre) continue;
      if (ult3.has(h.p)) { v3 += h.v; u3 += h.u; }
      else if (ant9.has(h.p)) { v9 += h.v; u9 += h.u; }
    }
    if (v3 > 0 && v9 > 0) {
      const m3 = (u3 / v3) * 100, m9 = (u9 / v9) * 100;
      const perdida = ((m9 - m3) / 100) * v3;
      if (m9 - m3 >= 5 && perdida >= u.brechaMinClp) {
        out.push(mk(a, "margen", 2, perdida, {
          titulo: `Margen cayó ${(m9 - m3).toFixed(1)} pts`,
          diag: `Margen de los últimos 3 meses ${pct(m3)} vs ${pct(m9)} de los 9 anteriores. A este volumen equivale a ${clp(perdida)} de utilidad.`,
          evidencia: [],
          accion: "Revisar costos de las rutas más repetidas y extracostos no cobrados; si el costo subió, renegociar tarifa.",
        }));
      }
    }
  }
  return out.sort((a, b) => a.prioridad - b.prioridad || b.impacto - a.impacto);
}

/* ---------------- proyección de cierre ---------------- */

export function proyeccionAnual(M: Modelo, serie: PuntoMes[], anio: string) {
  const cerrados = serie.filter((s) => s.p <= M.mesCerrado);
  const ult = cerrados.slice(-3);
  const est = (p: string) => M.estacional[parseInt(p.slice(5), 10) - 1] || 1;
  const nivel = ult.length ? ult.reduce((a, s) => a + s.venta / est(s.p), 0) / ult.length : 0;
  const meses = rangoPeriodos(`${anio}-01`, `${anio}-12`);
  return meses.map((p) => {
    const real = serie.find((s) => s.p === p);
    const cerrado = p <= M.mesCerrado;
    return { p, real: cerrado ? real?.venta ?? 0 : null, proyectado: cerrado ? null : nivel * est(p), parcial: p === M.mesActual ? real?.venta ?? 0 : null };
  });
}
