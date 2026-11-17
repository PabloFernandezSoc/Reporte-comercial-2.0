import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Agent } from "undici";
import { generarDemo } from "../demo";
import { normalizar } from "../normalize";
import type { Metas, RespuestaDatos } from "../types";

const TTL_MS = 10 * 60 * 1000;
let cache: { t: number; data: RespuestaDatos } | null = null;

function hoyChile(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function leerMetasPrivadas(): Promise<Metas | null> {
  if (process.env.METAS_JSON) {
    try {
      return JSON.parse(process.env.METAS_JSON) as Metas;
    } catch {
      /* sigue */
    }
  }
  const ruta = process.env.METAS_PATH || path.join(process.cwd(), "data", "private", "metas.json");
  try {
    return JSON.parse(await readFile(ruta, "utf8")) as Metas;
  } catch {
    return null;
  }
}

async function consultarErp(): Promise<unknown> {
  const url = process.env.ERP_URL || "https://biterp.cl:451/api/misservicios/reporte/prod-general";
  const body = {
    apiKey: process.env.ERP_API_KEY,
    perDesde: process.env.ERP_DESDE || "2025-01-01",
    perHasta: process.env.ERP_HASTA || `${new Date().getFullYear()}-12-31`,
  };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const init: RequestInit & { dispatcher?: Agent } = {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store",
    };
    if (process.env.ERP_INSECURE_TLS === "1") init.dispatcher = new Agent({ connect: { rejectUnauthorized: false } });
    const res = await fetch(url, init as RequestInit);
    if (!res.ok) throw new Error(`El ERP respondió ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function obtenerDatos(forzar = false): Promise<RespuestaDatos> {
  if (!forzar && cache && Date.now() - cache.t < TTL_MS) return cache.data;
  const hoy = hoyChile();
  const usarDemo = process.env.DEMO === "1" || !process.env.ERP_API_KEY;
  const privadas = await leerMetasPrivadas();
  let data: RespuestaDatos;

  if (usarDemo) {
    const demo = generarDemo(hoy);
    const n = normalizar(demo.filas, {}, hoy);
    data = {
      fuente: "demo", actualizado: new Date().toISOString(), hoy, filas: n.filas, mapeo: n.mapeo,
      avisos: ["Mostrando datos DEMO ficticios. Configura ERP_API_KEY en .env.local para usar Bit ERP."],
      hechos: n.hechos, ultimaFecha: n.ultimaFecha, metas: demo.metas, metasFuente: "demo", anulados: n.anulados, muestra: n.muestra, dims: n.dims,
    };
  } else {
    let mapeoManual: Record<string, string> = {};
    try {
      if (process.env.ERP_FIELD_MAP) mapeoManual = JSON.parse(process.env.ERP_FIELD_MAP);
    } catch {
      /* ignora mapeo inválido */
    }
    const json = await consultarErp();
    const n = normalizar(json, mapeoManual, hoy);
    data = {
      fuente: "erp", actualizado: new Date().toISOString(), hoy, filas: n.filas, mapeo: n.mapeo, avisos: n.avisos,
      hechos: n.hechos, ultimaFecha: n.ultimaFecha, metas: privadas, metasFuente: privadas ? "privado" : "ninguna", anulados: n.anulados, muestra: n.muestra, dims: n.dims,
    };
    if (!privadas) data.avisos.push("No hay metas cargadas en el servidor. Impórtalas en la pestaña Metas o define METAS_PATH.");
  }
  cache = { t: Date.now(), data };
  return data;
}
