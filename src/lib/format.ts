export const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const ok = (n: number | null | undefined): n is number => n != null && isFinite(n);

export function clp(n: number | null | undefined): string {
  if (!ok(n)) return "—";
  return "$" + Math.round(n).toLocaleString("es-CL");
}

export function clpCorto(n: number | null | undefined): string {
  if (!ok(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}MM`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
  return `${s}$${Math.round(a)}`;
}

export function num(n: number | null | undefined): string {
  return ok(n) ? Math.round(n).toLocaleString("es-CL") : "—";
}

export function pct(n: number | null | undefined, dec = 1): string {
  return ok(n) ? `${n.toFixed(dec)}%` : "—";
}

export function signo(n: number | null | undefined, dec = 0): string {
  if (!ok(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(dec)}%`;
}

export function mes(p: string | undefined | null): string {
  if (!p || !/^\d{4}-\d{2}$/.test(p)) return p ?? "—";
  const [y, m] = p.split("-");
  return `${MESES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function mesLargo(p: string): string {
  if (!/^\d{4}-\d{2}$/.test(p)) return p;
  const [y, m] = p.split("-");
  return `${MESES_LARGO[parseInt(m, 10) - 1]} ${y}`;
}

/** Suma n meses a un período YYYY-MM. */
export function sumarMes(p: string, n: number): string {
  const [y, m] = p.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lista de períodos entre a y b inclusive. */
export function rangoPeriodos(a: string, b: string): string[] {
  const out: string[] = [];
  let p = a;
  while (p <= b && out.length < 240) {
    out.push(p);
    p = sumarMes(p, 1);
  }
  return out;
}

/** Días hábiles aproximados (lun-vie) transcurridos del mes y totales. */
export function avanceMes(hoy: string): { transcurrido: number; total: number; fraccion: number } {
  const [y, m, d] = hoy.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0;
  let trans = 0;
  for (let i = 1; i <= ultimo; i++) {
    const dow = new Date(Date.UTC(y, m - 1, i)).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    total++;
    if (i <= d) trans++;
  }
  return { transcurrido: trans, total, fraccion: total ? trans / total : 1 };
}

/** Semana ISO 8601 de una fecha YYYY-MM-DD, como "2026-W46". */
export function semanaIso(fecha: string): string {
  const [y, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const dia = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dia); // jueves de la semana
  const inicio = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const n = Math.ceil(((t.getTime() - inicio.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(n).padStart(2, "0")}`;
}

/** Lunes y domingo (YYYY-MM-DD) de una semana ISO. */
export function rangoSemana(w: string): [string, string] {
  const [y, n] = w.split("-W").map(Number);
  const ene4 = new Date(Date.UTC(y, 0, 4));
  const lunes = new Date(ene4);
  lunes.setUTCDate(ene4.getUTCDate() - ((ene4.getUTCDay() || 7) - 1) + (n - 1) * 7);
  const dom = new Date(lunes);
  dom.setUTCDate(lunes.getUTCDate() + 6);
  const f = (x: Date) => x.toISOString().slice(0, 10);
  return [f(lunes), f(dom)];
}
