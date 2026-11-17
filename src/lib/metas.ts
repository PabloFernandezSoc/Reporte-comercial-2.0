/** Cruce de nombres de cliente del ERP con el Growth Scorecard (metas). */
import type { MetaCliente, Metas } from "./types";

const RUIDO = /\b(SPA|S\.?A\.?|SA|LTDA|LIMITADA|E\.?I\.?R\.?L\.?|CIA|COMPANIA|Y|DE|DEL|LA|EL|LOS|LAS|CHILE|SPOT|NUEVO|NUEVA|INC|CORP|S\.?P\.?A\.?)\b/g;

export function normTxt(s: unknown): string {
  return String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clave(s: string): string {
  return normTxt(s).replace(RUIDO, " ").replace(/\s+/g, " ").trim();
}

export function similitud(a: string, b: string): number {
  const A = clave(a).split(" ").filter(Boolean);
  const B = new Set(clave(b).split(" ").filter(Boolean));
  if (!A.length || !B.size) return 0;
  const hit = A.filter((t) => B.has(t)).length;
  return (2 * hit) / (A.length + B.size);
}

export class Cruce {
  private idx = new Map<string, MetaCliente>();
  private cache = new Map<string, MetaCliente | null>();
  constructor(private metas: Metas | null, private alias: Record<string, string> = {}) {
    // si un cliente aparece en dos segmentos gana la primera fila
    metas?.clientes.forEach((o) => {
      const k = clave(o.c);
      if (!this.idx.has(k)) this.idx.set(k, o);
    });
  }
  buscar(nombreApi: string): MetaCliente | null {
    if (!this.metas || !nombreApi) return null;
    if (this.cache.has(nombreApi)) return this.cache.get(nombreApi)!;
    let res: MetaCliente | null = null;
    const forz = this.alias[nombreApi];
    if (forz) res = this.metas.clientes.find((o) => o.c === forz) ?? null;
    if (!res) res = this.idx.get(clave(nombreApi)) ?? null;
    if (!res) {
      let mejor: MetaCliente | null = null;
      let ms = 0;
      for (const o of this.metas.clientes) {
        const s = similitud(nombreApi, o.c);
        if (s > ms) {
          ms = s;
          mejor = o;
        }
      }
      res = ms >= 0.62 ? mejor : null;
    }
    this.cache.set(nombreApi, res);
    return res;
  }
}

/**
 * Clasificación provisoria FFWW / CD por nombre, para clientes que no aparecen en ninguna hoja de cartera.
 * Forwarders y operadores logísticos → FFWW; el resto (importadores, retail, industria) → CD.
 * Se marca como provisoria en la app para que el equipo la confirme.
 */
const RX_FFWW = /\b(LOGISTIC\w*|LOGISTICA|CARGO|FORWARD\w*|SHIPPING|FREIGHT|TRANSIT\w*|ADUAN\w*|LINE|LINES|WORLDWIDE|TRANSPORTES INTERNACIONALES|INTERNATIONAL|SUPPLY CHAIN|AIR|SEA|MARITIM\w*|NAVIER\w*|COURIER)\b/;
export function segmentoPorNombre(nombre: string): "FFWW" | "CD" {
  return RX_FFWW.test(normTxt(nombre)) ? "FFWW" : "CD";
}
