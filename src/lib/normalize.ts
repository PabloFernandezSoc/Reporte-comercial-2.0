/**
 * Normalizador de la respuesta de Bit ERP (prod-general).
 * Portado del reporte HTML: detecta los campos por alias, separa flete de extracosto,
 * cuenta servicios únicos por ServicioID, clasifica el estado en etapas y descarta anulados.
 * El resultado se agrega a "hechos" compactos para que el navegador reciba poco volumen.
 */
import ESTADOS_BIT from "./estados-bit.json";
import { semanaIso } from "./format";
import type { Etapa, Hecho } from "./types";

type Fila = Record<string, unknown>;

export const ALIAS_CAMPOS: Record<string, string[]> = {
  idServicio: ["idservicio", "servicioid", "servicio_id", "id_servicio", "nroservicio", "numservicio", "idserv", "id"],
  idExtracosto: ["extracostoid", "idextracosto", "extracosto_id", "id_extracosto", "idextracostos", "extracostosid", "idextra", "extraid"],
  tipoRegistro: ["tiporegistro", "tipofila", "tipolinea", "tipodetalle", "tipocargo", "tipomovimiento", "tipocobro", "tipoitem", "clasefila"],
  presentacion: ["presentacion", "presen", "horapresentacion", "fechapresentacion", "hrpresentacion", "fechahorapresentacion"],
  inPlanta: ["inplanta", "horainplanta", "fechainplanta", "hrinplanta", "fechahorainplanta", "llegadaplanta", "enplanta"],
  cliente: ["cliente", "nombrecliente", "razonsocial", "clientenombre", "nomcliente", "empresa", "customer", "client", "nombre_cliente", "desccliente"],
  mandante: ["mandante", "nombremandante", "consignatario", "embarcador", "shipper", "contraparte", "mandantenombre", "cliente_final", "clientefinal"],
  periodo: ["periodo", "mes", "fecha", "fechaservicio", "fechaemision", "fechafacturacion", "fecha_servicio", "fecha_emision", "emision", "fechadocumento", "fecharetiro"],
  venta: ["venta", "ventas", "montoventa", "totalventa", "valorventa", "facturacion", "facturado", "precioventa", "ingreso", "monto", "total", "neto", "tarifa", "valor"],
  costo: ["costo", "costos", "montocosto", "totalcosto", "valorcosto", "costoventa", "gasto"],
  utilidad: ["utilidad", "profit", "margen", "margenclp", "resultado", "ganancia", "utilidadneta"],
  servicios: ["servicios", "cantidadservicios", "movimientos", "cantidad", "qty", "nroservicios", "numservicios", "viajes", "unidades", "volumen", "contenedores"],
  estado: ["estado", "status", "estadoservicio", "estadodocumento", "situacion", "estadoos"],
  ejecutiva: ["ejecutiva", "ejecutivo", "vendedor", "comercial", "ejecutivacomercial", "agente", "responsable", "usuario"],
  servicio: ["tiposervicio", "servicio", "tiposervicionombre", "glosa", "descripcion", "modalidad", "tipo"],
};

const ORDEN_CAMPOS = ["idExtracosto", "idServicio", "tipoRegistro", "presentacion", "inPlanta", "cliente", "periodo", "venta", "servicios", "costo", "utilidad", "mandante", "estado", "ejecutiva", "servicio"];

/** Busca el arreglo de objetos más grande dentro de la respuesta. */
export function aplanar(json: unknown): Fila[] {
  if (!json) return [];
  if (Array.isArray(json) && json.length && typeof json[0] === "object") return json as Fila[];
  let mejor: Fila[] = [];
  const rec = (o: unknown, prof: number) => {
    if (!o || typeof o !== "object" || prof > 6) return;
    if (Array.isArray(o)) {
      if (o.length && typeof o[0] === "object" && !Array.isArray(o[0])) {
        if (o.length > mejor.length) mejor = o as Fila[];
        o.slice(0, 3).forEach((x) => rec(x, prof + 1));
      }
      return;
    }
    Object.values(o as object).forEach((v) => rec(v, prof + 1));
  };
  rec(json, 0);
  return mejor;
}

const limpiaLlave = (k: string) =>
  k.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

export function llaves(filas: Fila[]): string[] {
  const set = new Set<string>();
  filas.slice(0, 300).forEach((f) => Object.keys(f || {}).forEach((k) => set.add(k)));
  return [...set];
}

export function autoMapear(filas: Fila[]): Record<string, string> {
  const ks = llaves(filas);
  const m: Record<string, string> = {};
  const usadas = new Set<string>();
  for (const campo of ORDEN_CAMPOS) {
    const lista = ALIAS_CAMPOS[campo];
    let hit: string | null = null;
    let mejor = -1;
    for (const k of ks) {
      if (usadas.has(k)) continue;
      const lk = limpiaLlave(k);
      let p = -1;
      lista.forEach((a, i) => {
        let s = 0;
        if (lk === a) s = 1000 - i;
        else if (a.length >= 4 && lk.includes(a)) s = 100 + a.length - i;
        if (s > p) p = s;
      });
      if (p > mejor) {
        mejor = p;
        hit = k;
      }
    }
    if (hit && mejor > 0) {
      m[campo] = hit;
      usadas.add(hit);
    }
  }
  return m;
}

export function aNumero(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v).replace(/[^0-9,.\-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/** Devuelve [YYYY-MM, YYYY-MM-DD | null]. */
export function aFecha(v: unknown): [string | null, string | null] {
  if (v == null || v === "") return [null, null];
  if (typeof v === "number" && v > 19000101 && v < 30001231) {
    const t = String(v);
    return [`${t.slice(0, 4)}-${t.slice(4, 6)}`, `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`];
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (m) {
    const p = `${m[1]}-${m[2].padStart(2, "0")}`;
    return [p, m[3] ? `${p}-${m[3].padStart(2, "0")}` : null];
  }
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) {
    const p = `${m[3]}-${m[2].padStart(2, "0")}`;
    return [p, `${p}-${m[1].padStart(2, "0")}`];
  }
  m = s.match(/^(\d{4})(\d{2})/);
  if (m) return [`${m[1]}-${m[2]}`, null];
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return [p, `${p}-${String(d.getDate()).padStart(2, "0")}`];
  }
  return [null, null];
}

export function norm(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---------- estados BIT → etapa ---------- */
const GLOSA_POR_COD: Record<string, string> = {};
const GLOSAS_BIT = new Set<string>();
(ESTADOS_BIT as [number, string, string][]).forEach(([cod, , glosa]) => {
  GLOSA_POR_COD[String(cod)] = norm(glosa);
  GLOSAS_BIT.add(norm(glosa));
});

export function glosaEstado(v: unknown): string {
  const k = norm(v);
  if (!k) return "";
  if (/^\d+$/.test(k) && GLOSA_POR_COD[k]) return GLOSA_POR_COD[k];
  return k;
}

export function etapaDe(v: unknown): Etapa | "anulado" {
  const g = glosaEstado(v);
  if (!g) return "sinclasif";
  // según la tabla de estados de Bit (columna "Se considera en curso"):
  // proyección y coordinación aún no son servicio en curso; finalizado, validación y validado ya terminaron
  if (g === "PROYECCION DE CARGA" || g === "EN COORDINACION") return "proyeccion";
  if (g === "SERVICIO FINALIZADO" || g === "VALIDACION COSTUMER SERVICE" || g === "VALIDADO") return "finalizado";
  if (g === "ANULADO") return "anulado";
  return GLOSAS_BIT.has(g) ? "curso" : "sinclasif";
}

/** Descarta fechas de relleno o fuera de rango razonable. */
function fechaValida(x: [string | null, string | null]): [string | null, string | null] {
  const y = x[0] ? parseInt(x[0].slice(0, 4), 10) : 0;
  return y >= 2010 && y <= 2100 ? x : [null, null];
}

const RX_EXTRA = /EXTRA|ADICIONAL|GASTO|RECARGO|SOBRECARGO|DEMURRAGE|ALMACENAJE ADIC/;

const normId = (v: unknown) => {
  if (v == null) return "";
  const s = String(v).trim().replace(/\.0+$/, "");
  return s === "0" ? "" : s;
};
const txt = (f: Fila, k?: string) => (k ? String(f[k] ?? "").trim() : "");

export interface ResultadoNormalizado {
  hechos: Hecho[];
  ultimaFecha: Record<string, string>;
  mapeo: Record<string, string>;
  filas: number;
  avisos: string[];
  anulados: { servicios: number; venta: number };
  muestra: Record<string, unknown>[];
  dims?: Record<string, Record<string, number>>;
  sinFechaEstado?: Record<string, { servicios: number; venta: number; etapa: string }>;
  sinFechaLista: ServicioSinFecha[];
}

export interface ServicioSinFecha {
  id: string;
  cliente: string;
  estado: string;
  tipo: string;
  venta: number;
  extracosto: boolean;
  otraFecha: string; // retiro / ingreso a planta / ETA, como referencia
}

export function normalizar(json: unknown, mapeoManual: Record<string, string> = {}, hoy = "9999-12-31"): ResultadoNormalizado {
  const filas = aplanar(json);
  const avisos: string[] = [];
  const anulados = { servicios: 0, venta: 0 };
  const sinFecha = { servicios: 0, venta: 0 };
  const sinFechaLista: ServicioSinFecha[] = [];
  const sinFechaEstado: Record<string, { servicios: number; venta: number; etapa: string }> = {};
  if (!filas.length) {
    return { hechos: [], ultimaFecha: {}, mapeo: {}, filas: 0, avisos: ["La API no devolvió filas."], anulados, muestra: [], sinFechaLista: [] };
  }
  const M = { ...autoMapear(filas), ...mapeoManual };
  if (!M.cliente) avisos.push("No se detectó el campo de cliente. Define ERP_FIELD_MAP.");
  if (!M.venta) avisos.push("No se detectó el campo de venta. Define ERP_FIELD_MAP.");
  if (!M.periodo) avisos.push("No se detectó el campo de fecha/período. Define ERP_FIELD_MAP.");

  const idsOk = !!M.idServicio;
  const modoExtra = !!M.idExtracosto;
  const modoTipo = !modoExtra && !!M.tipoRegistro;

  interface T {
    i: number; id: string; extra: string; cliente: string; mandante: string; periodo: string | null; fecha: string | null;
    venta: number; costo: number; util: number | null; cant: number; estado: string; ejecutiva: string; tipo: string;
    tipoReg: string; key: string; esFlete: boolean; esBase: boolean;
  }
  const T: T[] = filas.map((f, i) => {
    // el ERP usa fechas de relleno (ej. 2000-01-01) cuando no hay fecha: se intenta con la presentación
    let [periodo, fecha] = M.periodo ? fechaValida(aFecha(f[M.periodo])) : [null, null];
    // la fecha del servicio es la de presentación; el período (mes) es el que informa el ERP
    const presen = M.presentacion ? fechaValida(aFecha(f[M.presentacion])) : [null, null];
    if (!periodo) periodo = presen[0];
    if (presen[1]) fecha = presen[1];
    return {
      i,
      id: idsOk ? normId(f[M.idServicio]) : "",
      extra: modoExtra ? normId(f[M.idExtracosto]) : "",
      cliente: txt(f, M.cliente),
      mandante: txt(f, M.mandante),
      periodo,
      fecha,
      venta: M.venta ? aNumero(f[M.venta]) : 0,
      costo: M.costo ? aNumero(f[M.costo]) : 0,
      util: M.utilidad ? aNumero(f[M.utilidad]) : null,
      cant: M.servicios ? aNumero(f[M.servicios]) : 1,
      estado: txt(f, M.estado),
      ejecutiva: txt(f, M.ejecutiva),
      tipo: txt(f, M.servicio),
      tipoReg: modoTipo ? norm(txt(f, M.tipoRegistro)) : "",
      key: "",
      esFlete: true,
      esBase: false,
    };
  });

  // 1. flete base por servicio: solo el flete cuenta como servicio
  const base = new Map<string, T>();
  for (const t of T) {
    t.key = idsOk ? t.id || `sin-id-${t.i}` : `fila-${t.i}`;
    if (modoExtra) t.esFlete = !t.extra;
    else if (modoTipo) t.esFlete = !RX_EXTRA.test(t.tipoReg);
    else if (idsOk) t.esFlete = !!t.cliente && !base.has(t.key);
    else t.esFlete = true;
    if (idsOk && !t.id) continue;
    if (t.esFlete && !base.has(t.key)) {
      base.set(t.key, t);
      t.esBase = true;
    }
  }
  // ServicioID que en el rango solo trae extracostos: igual es un servicio
  if (idsOk) for (const t of T) if (t.id && !base.has(t.key)) { base.set(t.key, t); t.esBase = true; }

  // 2. el extracosto hereda datos del flete y la etapa del servicio
  const agg = new Map<string, Hecho>();
  const ultimaFecha: Record<string, string> = {};
  for (const t of T) {
    const b = base.get(t.key);
    if (b && b !== t) {
      t.cliente ||= b.cliente;
      t.mandante ||= b.mandante;
      t.periodo ||= b.periodo;
      t.fecha ||= b.fecha;
      t.ejecutiva ||= b.ejecutiva;
      t.tipo ||= b.tipo;
    }
    let etapa = etapaDe((b && b.estado) || t.estado);
    // un servicio agendado para después de hoy aún no es venta realizada: es programado
    if (etapa !== "anulado" && etapa !== "finalizado" && t.fecha && t.fecha > hoy) etapa = "proyeccion";
    const servicios = t.esBase ? (idsOk ? 1 : t.cant) : 0;
    if (etapa === "anulado") {
      anulados.servicios += servicios;
      anulados.venta += t.venta;
      continue;
    }
    if (!t.periodo) {
      // sin fecha: es esperable en proyección (aún sin agendar); en otros estados es un dato faltante
      const g = glosaEstado((b && b.estado) || t.estado) || "(sin estado)";
      const o = (sinFechaEstado[g] ||= { servicios: 0, venta: 0, etapa });
      o.servicios += servicios;
      o.venta += t.venta;
      if (etapa !== "proyeccion" && t.venta) {
        const f = filas[t.i];
        const otraFecha = ["fechaRetiro", "inPlanta", "eta"].map((c) => fechaValida(aFecha(f[c]))[1]).find(Boolean) ?? "";
        sinFechaLista.push({ id: t.id, cliente: t.cliente || "(sin cliente)", estado: g, tipo: t.tipo, venta: t.venta, extracosto: !t.esFlete, otraFecha });
        sinFecha.servicios += servicios;
        sinFecha.venta += t.venta;
      }
      continue;
    }
    const cliente = t.cliente || "(sin cliente)";
    const util = t.util != null ? t.util : M.costo ? t.venta - t.costo : 0;
    const w = t.fecha ? semanaIso(t.fecha) : "";
    const k = [cliente, t.mandante, t.periodo, etapa, t.ejecutiva, t.tipo, w].join("\u0001");
    let h = agg.get(k);
    if (!h) {
      h = { c: cliente, m: t.mandante, p: t.periodo, e: etapa, x: t.ejecutiva, t: t.tipo, v: 0, k: 0, u: 0, s: 0, w };
      agg.set(k, h);
    }
    h.v += t.venta;
    h.k += t.costo;
    h.u += util;
    h.s += servicios;
    if (t.fecha && t.esBase && t.fecha <= hoy && (!ultimaFecha[cliente] || t.fecha > ultimaFecha[cliente])) ultimaFecha[cliente] = t.fecha;
  }
  const hechos = [...agg.values()].map((h) => ({ ...h, v: Math.round(h.v), k: Math.round(h.k), u: Math.round(h.u) }));
  if (sinFecha.servicios || sinFecha.venta)
    avisos.push(`${sinFecha.servicios.toLocaleString("es-CL")} servicios en curso ($${Math.round(sinFecha.venta).toLocaleString("es-CL")}) vienen de Bit sin fecha de presentación ni período y quedaron fuera del análisis. Revisa la lista en Configuración → Datos para corregirlos en el ERP.`);
  // diagnóstico: venta por valores de columnas categóricas candidatas a segmento
  const dims: Record<string, Record<string, number>> = {};
  for (const col of ["unegocio", "servicioTipo", "familia", "modalidad"]) {
    if (!(col in (filas[0] || {}))) continue;
    const o: Record<string, number> = (dims[col] = {});
    filas.forEach((f) => { const k = String(f[col] ?? ""); o[k] = (o[k] || 0) + aNumero(f[M.venta]); });
  }
  return { hechos, ultimaFecha, mapeo: M, filas: filas.length, avisos, anulados, muestra: filas.slice(0, 5), dims, sinFechaEstado, sinFechaLista };
}
