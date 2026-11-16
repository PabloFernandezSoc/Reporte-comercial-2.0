/**
 * Generador de datos DEMO con la misma forma que la API de Bit ERP.
 * Todo es ficticio (nombres, montos). Sirve para desarrollar y mostrar la app
 * sin exponer datos reales en el repositorio público.
 * Incluye escenarios sembrados para validar el detector de fluctuaciones.
 */
import { rangoPeriodos, sumarMes } from "./format";
import type { Metas } from "./types";

function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EJECUTIVAS = ["Camila Rojas", "Valentina Soto", "Javiera Muñoz", "Francisca Díaz"];
const MANDANTES = [
  "Agrícola Los Robles", "Viña Santa Clara", "Frutícola del Valle", "Minera Cordillera", "Retail Austral",
  "Celulosa Pacífico", "Alimentos Sur", "Pesquera Bahía Azul", "Química Andina", "Importadora Central",
  "Salmones del Fiordo", "Maderas Nativas", "Electro Hogar", "Farmacéutica Norte", "Bebidas Patagonia",
  "Textil Araucanía", "Construmart Demo", "Acero del Pacífico", "Lácteos Llanquihue", "Vinos Colchagua",
];
const TIPOS = ["Retiro contenedor", "Entrega directa", "Porteo", "Carga suelta (LCL)", "Almacenaje"];
// estacionalidad de la empresa (ene..dic)
const ESTAC = [0.86, 0.84, 0.94, 1.0, 0.93, 0.88, 1.14, 1.1, 1.04, 1.26, 1.0, 1.22];

type Escenario = "normal" | "fuga" | "caida" | "tendencia" | "volatil" | "nuevo" | "esporadico" | "alza";

interface ClienteDemo {
  nombre: string;
  seg: "FFWW" | "CD" | "CAPEX" | "CHURN";
  nivel: number;
  sigma: number;
  crec: number;
  ticket: number;
  margen: number;
  ejecutiva: string;
  mandantes: string[];
  pesos: number[];
  esc: Escenario;
}

const NOMBRES: [string, ClienteDemo["seg"], Escenario][] = [
  ["Andes Forwarding SpA", "FFWW", "normal"],
  ["Pacific Cargo Logistics", "FFWW", "caida"],
  ["Austral Freight Chile", "FFWW", "normal"],
  ["Global Link Transitarios", "FFWW", "volatil"],
  ["Oceanic Brokers Ltda", "FFWW", "tendencia"],
  ["Cono Sur Shipping", "FFWW", "normal"],
  ["Mar Abierto Agencia", "FFWW", "alza"],
  ["Puerto Seco Forwarders", "FFWW", "normal"],
  ["Trans Ruta Internacional", "FFWW", "fuga"],
  ["Norte Grande Cargo", "FFWW", "normal"],
  ["Distribuidora Central SpA", "CD", "normal"],
  ["CD Lo Aguirre Demo", "CD", "normal"],
  ["Retail Hub Santiago", "CD", "caida"],
  ["Bodegas San Bernardo", "CD", "normal"],
  ["Logística Quilicura", "CD", "volatil"],
  ["Centro Distribución Maipú", "CD", "normal"],
  ["Almacenes del Pacífico", "CD", "normal"],
  ["Hub Pudahuel Demo", "CD", "tendencia"],
  ["Proyecto Minero Altiplano", "CAPEX", "esporadico"],
  ["Ampliación Planta Celulosa", "CAPEX", "esporadico"],
  ["Parque Eólico Demo", "CAPEX", "esporadico"],
  ["Agroexport Rancagua", "CHURN", "fuga"],
  ["Comercial Valparaíso", "CHURN", "normal"],
  ["Importadora Temuco", "CHURN", "nuevo"],
  ["Frigorífico Talca", "FFWW", "normal"],
  ["Nexus Supply Chain", "FFWW", "nuevo"],
  ["Química Industrial Demo", "CD", "normal"],
  ["Vitivinícola Export", "FFWW", "normal"],
];

function crearClientes(r: () => number): ClienteDemo[] {
  return NOMBRES.map(([nombre, seg, esc], i) => {
    const nivel = Math.exp(Math.log(seg === "CAPEX" ? 40e6 : 14e6) + (r() - 0.5) * 2.2);
    const nM = 1 + Math.floor(r() * 4);
    const mandantes: string[] = [];
    while (mandantes.length < nM) {
      const m = MANDANTES[Math.floor(r() * MANDANTES.length)];
      if (!mandantes.includes(m)) mandantes.push(m);
    }
    const pesos = mandantes.map((_, j) => (j === 0 ? 2.5 : 0.4 + r()));
    const sp = pesos.reduce((a, b) => a + b, 0);
    return {
      nombre, seg, esc,
      nivel: i === 0 ? 85e6 : nivel,
      sigma: esc === "volatil" ? 0.55 : 0.1 + r() * 0.22,
      crec: -0.05 + r() * 0.25,
      ticket: 280e3 + r() * 900e3,
      margen: 0.07 + r() * 0.24,
      ejecutiva: EJECUTIVAS[i % EJECUTIVAS.length],
      mandantes,
      pesos: pesos.map((p) => p / sp),
    };
  });
}

function gauss(r: () => number) {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface DemoResultado {
  filas: Record<string, unknown>[];
  metas: Metas;
}

let CACHE: { hoy: string; res: DemoResultado } | null = null;

export function generarDemo(hoy: string): DemoResultado {
  if (CACHE && CACHE.hoy === hoy) return CACHE.res;
  const r = prng(20260101);
  const clientes = crearClientes(r);
  const mesActual = hoy.slice(0, 7);
  const cerrado = sumarMes(mesActual, -1); // último mes cerrado
  const periodos = rangoPeriodos("2025-01", mesActual);
  const diaHoy = parseInt(hoy.slice(8, 10), 10);
  const filas: Record<string, unknown>[] = [];
  let sid = 500000;
  let xid = 1;

  for (const c of clientes) {
    periodos.forEach((p, idx) => {
      const mIdx = parseInt(p.slice(5), 10) - 1;
      const kc = (p > cerrado ? -1 : 0) + (periodos.indexOf(cerrado) - idx); // 0 = último cerrado
      let f = ESTAC[mIdx] * Math.pow(1 + c.crec, idx / 12) * Math.exp(gauss(r) * c.sigma);
      let pesos = c.pesos;
      switch (c.esc) {
        case "fuga":
          if (kc <= 0) f = 0;
          break;
        case "caida":
          if (kc <= 0) {
            // el mandante principal deja de mover
            pesos = c.pesos.map((w, j) => (j === 0 ? 0.05 * w : w));
            f *= (1 - 0.9 * c.pesos[0]) * 0.85;
          }
          break;
        case "tendencia":
          if (kc <= 4) f *= Math.pow(0.84, 5 - Math.max(kc, 0));
          break;
        case "volatil":
          if (kc === 0) f = ESTAC[mIdx] * Math.pow(1 + c.crec, idx / 12) * 0.72; // baja normal para su volatilidad
          break;
        case "nuevo":
          if (kc > 2) f = 0;
          break;
        case "esporadico":
          if (r() < 0.55) f = 0;
          else f *= 1.6;
          break;
        case "alza":
          if (kc <= 1) f *= 1.8;
          break;
      }
      const ventaMes = c.nivel * f;
      const nServ = Math.max(0, Math.round(ventaMes / c.ticket));
      for (let n = 0; n < nServ; n++) {
        const mj = elegir(r, pesos);
        const dia = 1 + Math.floor(r() * 28);
        let estado = "VALIDADO";
        if (p === mesActual) estado = dia <= diaHoy ? (r() < 0.6 ? "EN CURSO" : "SERVICIO FINALIZADO") : "PROYECCION DE CARGA";
        else if (p === cerrado && r() < 0.3) estado = "VALIDACION COSTUMER SERVICE";
        if (r() < 0.02) estado = "ANULADO";
        const venta = Math.round(c.ticket * Math.exp(gauss(r) * 0.18));
        const costo = Math.round(venta * (1 - c.margen + gauss(r) * 0.04));
        const fecha = `${p}-${String(dia).padStart(2, "0")}`;
        const id = ++sid;
        const comun = {
          ServicioID: id,
          Cliente: c.nombre,
          Mandante: c.mandantes[mj],
          FechaServicio: fecha,
          Estado: estado,
          Ejecutiva: c.ejecutiva,
          TipoServicio: TIPOS[(id + mj) % TIPOS.length],
        };
        filas.push({ ...comun, ExtraCostoID: null, Venta: venta, Costo: costo });
        if (r() < 0.18) {
          const ve = Math.round(venta * (0.08 + r() * 0.2));
          filas.push({ ...comun, ExtraCostoID: xid++, Venta: ve, Costo: Math.round(ve * 0.7) });
        }
      }
    });
  }

  // metas demo 2026: promedio 2025 × estacionalidad × 1,12
  const ventas2025: Record<string, number> = {};
  for (const f of filas) {
    const p = String(f.FechaServicio).slice(0, 7);
    if (p.startsWith("2025") && f.Estado !== "ANULADO") ventas2025[String(f.Cliente)] = (ventas2025[String(f.Cliente)] || 0) + Number(f.Venta);
  }
  const metas: Metas = { general: {}, seg: { FFWW: {}, CD: {}, CAPEX: {}, CHURN: {} }, clientes: [] };
  for (const c of clientes) {
    const prom = (ventas2025[c.nombre] || c.nivel * 6) / 12;
    const m: Record<string, number> = {};
    for (let i = 0; i < 12; i++) {
      const p = `2026-${String(i + 1).padStart(2, "0")}`;
      const v = Math.round((prom * ESTAC[i] * 1.12) / 1e5) * 1e5;
      if (c.esc === "nuevo" && p < "2026-09") continue;
      m[p] = v;
      metas.general[p] = (metas.general[p] || 0) + v;
      metas.seg[c.seg][p] = (metas.seg[c.seg][p] || 0) + v;
    }
    metas.clientes.push({ c: c.nombre.toUpperCase(), s: c.seg, m });
  }
  const res = { filas, metas };
  CACHE = { hoy, res };
  return res;
}

function elegir(r: () => number, pesos: number[]) {
  const s = pesos.reduce((a, b) => a + b, 0);
  let x = r() * s;
  for (let i = 0; i < pesos.length; i++) {
    x -= pesos[i];
    if (x <= 0) return i;
  }
  return pesos.length - 1;
}
