/**
 * Detector de fluctuaciones por cliente.
 *
 * Idea: para cada mes se calcula lo que "normalmente" vendería el cliente
 * (nivel reciente × estacionalidad) y una banda de variación propia del cliente,
 * medida con estadística robusta (mediana y MAD) sobre su historia.
 * Una caída solo es alerta si sale de esa banda: un cliente volátil necesita una
 * caída mucho mayor que uno estable para encender la alarma.
 *
 *   esperado_t = mediana(últimos 6 meses) × índice estacional
 *   residuo_t  = ln((real_t + c) / (esperado_t + c))
 *   σ          = 1,4826 × MAD(residuos históricos)      (mín 0,12)
 *   z_t        = residuo_t / σ
 *   banda 90%  = esperado × e^(±1,645 σ)
 */

export interface PuntoEsperado {
  p: string;
  real: number;
  esperado: number | null;
  bajo: number | null;
  alto: number | null;
  z: number | null;
}

export interface AnalisisSerie {
  puntos: PuntoEsperado[];
  sigma: number; // volatilidad típica (log)
  variacionTipica: number; // % de variación normal (≈ e^σ - 1)
  tasaCeros: number; // fracción de meses sin venta en la historia
  mesesActivos: number;
  desest: number[]; // serie desestacionalizada
  estac: number[]; // índice estacional aplicado a cada mes
  c: number; // constante de amortiguación
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const mediana = median;

const mad = (a: number[]) => {
  const m = median(a);
  return median(a.map((x) => Math.abs(x - m)));
};

/**
 * Índice estacional por mes calendario (1..12) a partir de una serie larga
 * (normalmente la venta total de la empresa). Devuelve 1 cuando no hay datos.
 */
export function indiceEstacional(periodos: string[], valores: number[]): number[] {
  const idx = new Array(12).fill(1);
  if (valores.length < 13) return idx;
  const ratios: number[][] = Array.from({ length: 12 }, () => []);
  for (let t = 0; t < valores.length; t++) {
    const ventana = valores.slice(Math.max(0, t - 6), Math.min(valores.length, t + 7));
    if (ventana.length < 9) continue;
    const base = median(ventana);
    if (base <= 0) continue;
    const m = parseInt(periodos[t].slice(5), 10) - 1;
    ratios[m].push(valores[t] / base);
  }
  for (let m = 0; m < 12; m++) if (ratios[m].length) idx[m] = Math.min(1.6, Math.max(0.6, median(ratios[m])));
  const prom = idx.reduce((a, b) => a + b, 0) / 12;
  return idx.map((x) => x / prom);
}

export function analizarSerie(periodos: string[], valores: number[], estacional?: number[]): AnalisisSerie {
  const n = valores.length;
  const activos = valores.filter((v) => v > 0);
  const media = activos.length ? activos.reduce((a, b) => a + b, 0) / activos.length : 0;
  const c = Math.max(1, media * 0.05); // amortigua meses muy chicos
  const est = (p: string) => (estacional ? estacional[parseInt(p.slice(5), 10) - 1] : 1);

  const puntos: PuntoEsperado[] = [];
  const residuos: number[] = [];
  let primero = valores.findIndex((v) => v > 0);
  if (primero < 0) primero = n;

  for (let t = 0; t < n; t++) {
    const p = periodos[t];
    const prev = valores.slice(Math.max(primero, t - 6), t);
    let esperado: number | null = null;
    if (prev.length >= 3) {
      // desestacionaliza los meses previos, toma la mediana y reestacionaliza
      const desest = prev.map((v, i) => v / est(periodos[t - prev.length + i]));
      let nivel = median(desest);
      // si el cliente tiene historia del mismo mes del año anterior, mezcla su propia estacionalidad
      let s = est(p);
      if (t - 12 >= primero) {
        const ventana = valores.slice(Math.max(primero, t - 15), t - 8).map((v, i) => v / est(periodos[Math.max(primero, t - 15) + i]));
        const base = median(ventana);
        if (base > 0 && ventana.length >= 4) {
          const propio = Math.min(1.8, Math.max(0.5, valores[t - 12] / est(periodos[t - 12]) / base));
          s = s * (1 + 0.35 * (propio - 1));
        }
      }
      if (nivel < 0) nivel = 0;
      esperado = nivel * s;
    }
    let z: number | null = null;
    let bajo: number | null = null;
    let alto: number | null = null;
    if (esperado != null) {
      const r = Math.log((valores[t] + c) / (esperado + c));
      const sigma = residuos.length >= 4 ? Math.min(1.5, Math.max(0.12, 1.4826 * mad(residuos))) : 0.35;
      z = r / sigma;
      bajo = Math.max(0, (esperado + c) * Math.exp(-1.645 * sigma) - c);
      alto = (esperado + c) * Math.exp(1.645 * sigma) - c;
      residuos.push(r);
    }
    puntos.push({ p, real: valores[t], esperado, bajo, alto, z });
  }
  const sigma = residuos.length >= 4 ? Math.min(1.5, Math.max(0.12, 1.4826 * mad(residuos))) : 0.35;
  const hist = valores.slice(primero);
  return {
    puntos,
    desest: valores.map((v, i) => v / est(periodos[i])),
    estac: periodos.map(est),
    c,
    sigma,
    variacionTipica: (Math.exp(sigma) - 1) * 100,
    tasaCeros: hist.length ? hist.filter((v) => v <= 0).length / hist.length : 0,
    mesesActivos: activos.length,
  };
}

export type Diagnostico =
  | "fuga"
  | "caida-significativa"
  | "tendencia-baja"
  | "bajo-vigilancia"
  | "normal"
  | "alza"
  | "nuevo"
  | "sin-historia";

export interface Umbrales {
  zAlerta: number; // z bajo el cual una caída es significativa (ej. -2)
  zVigilancia: number; // z para "bajo vigilancia" (ej. -1,28)
  caidaMinPct: number; // caída mínima vs esperado para alertar (ej. 20)
  brechaMinClp: number; // monto mínimo para alertar
  mesesMinHistoria: number; // meses con venta mínimos para analizar
  umbralOk: number; // % cumplimiento verde
  umbralAlerta: number; // % cumplimiento ámbar
}

export const UMBRALES_DEF: Umbrales = {
  zAlerta: -2,
  zVigilancia: -1.28,
  caidaMinPct: 20,
  brechaMinClp: 1_000_000,
  mesesMinHistoria: 4,
  umbralOk: 100,
  umbralAlerta: 85,
};

export interface ResultadoDiagnostico {
  diag: Diagnostico;
  z: number | null;
  esperado: number | null;
  real: number;
  brecha: number; // esperado - real (positivo = bajo lo normal)
  caidaPct: number | null; // % bajo lo esperado
  rachaBaja: number; // meses consecutivos bajo lo esperado (z < -1)
  confianza: number; // 0..1, probabilidad aproximada de que NO sea fluctuación normal
}

/** Probabilidad normal acumulada (aprox. Abramowitz-Stegun). */
export function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function diagnosticar(a: AnalisisSerie, idx: number, u: Umbrales): ResultadoDiagnostico {
  const pt = a.puntos[idx];
  const base: ResultadoDiagnostico = {
    diag: "sin-historia",
    z: pt?.z ?? null,
    esperado: pt?.esperado ?? null,
    real: pt?.real ?? 0,
    brecha: 0,
    caidaPct: null,
    rachaBaja: 0,
    confianza: 0,
  };
  if (!pt) return base;
  // racha de meses bajo lo normal
  let racha = 0;
  for (let i = idx; i >= 0; i--) {
    const z = a.puntos[i].z;
    if (z != null && z < -1) racha++;
    else break;
  }
  base.rachaBaja = racha;
  const activosHasta = a.puntos.slice(0, idx + 1).filter((x) => x.real > 0).length;
  const activosPrev = a.puntos.slice(0, idx).filter((x) => x.real > 0).length;
  if (activosPrev === 0 && pt.real > 0) return { ...base, diag: "nuevo" };
  if (activosHasta < u.mesesMinHistoria || pt.esperado == null || pt.z == null) return base;

  const brecha = pt.esperado - pt.real;
  const caidaPct = pt.esperado > 0 ? (brecha / pt.esperado) * 100 : null;
  // probabilidad (unilateral) de que una caída así NO sea parte de la variación habitual
  const confianza = pt.z < 0 ? 1 - phi(pt.z) : 0;
  const r: ResultadoDiagnostico = { ...base, brecha, caidaPct, confianza };

  const relevante = brecha >= u.brechaMinClp && (caidaPct ?? 0) >= u.caidaMinPct;
  // fuga: sin venta, siendo un cliente que rara vez tiene meses en cero
  if (pt.real <= 0 && pt.esperado > 0 && a.tasaCeros < 0.25 && relevante) return { ...r, diag: "fuga" };
  // cliente esporádico (proyectos, CAPEX): un mes sin carga es parte de su patrón
  if (pt.real <= 0 && a.tasaCeros >= 0.25) return { ...r, diag: "normal" };
  if (pt.z <= u.zAlerta && relevante) return { ...r, diag: "caida-significativa" };
  if (racha >= 3 && relevante) return { ...r, diag: "tendencia-baja" };
  // tendencia gradual: nivel de los últimos 3 meses vs los 9 anteriores (desestacionalizado)
  if (idx >= 8) {
    const rec = a.desest.slice(idx - 2, idx + 1);
    const prev = a.desest.slice(Math.max(0, idx - 11), idx - 2);
    if (prev.length >= 5) {
      const nr = rec.reduce((x, y) => x + y, 0) / 3;
      const np = median(prev);
      const zT = Math.log((nr + a.c) / (np + a.c)) / (a.sigma / Math.sqrt(3));
      const caidaT = np > 0 ? (1 - nr / np) * 100 : 0;
      const montoT = (np - nr) * a.estac[idx];
      if (zT <= u.zAlerta && caidaT >= u.caidaMinPct && montoT >= u.brechaMinClp)
        return { ...r, diag: "tendencia-baja", brecha: montoT, caidaPct: caidaT, z: zT, confianza: 1 - phi(zT), rachaBaja: Math.max(racha, 3) };
    }
  }
  if (pt.z <= u.zVigilancia && brecha > 0) return { ...r, diag: "bajo-vigilancia" };
  if (pt.z >= 2 && -brecha >= u.brechaMinClp && -(caidaPct ?? 0) >= u.caidaMinPct && a.tasaCeros < 0.25) return { ...r, diag: "alza" };
  return { ...r, diag: "normal" };
}

export const DIAG_INFO: Record<Diagnostico, { label: string; tono: "risk" | "warn" | "ok" | "n" | "info" }> = {
  fuga: { label: "Fuga", tono: "risk" },
  "caida-significativa": { label: "Caída anómala", tono: "risk" },
  "tendencia-baja": { label: "Tendencia a la baja", tono: "warn" },
  "bajo-vigilancia": { label: "Bajo vigilancia", tono: "warn" },
  normal: { label: "Fluctuación normal", tono: "n" },
  alza: { label: "Alza anómala", tono: "ok" },
  nuevo: { label: "Cliente nuevo", tono: "info" },
  "sin-historia": { label: "Historia insuficiente", tono: "n" },
};
