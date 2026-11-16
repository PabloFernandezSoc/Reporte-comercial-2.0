"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { COL, MatrizChart, ParetoChart } from "@/components/charts";
import { useDatos } from "@/components/DataProvider";
import { Aviso, Card, Empty, Eyebrow, Pill, PillSeg, Tabla, type Tono } from "@/components/ui";
import { agruparClientes, hechosFiltrados, periodosFiltrados } from "@/lib/analytics";
import { mediana } from "@/lib/anomaly";
import { clp, num, pct } from "@/lib/format";

const CLASES: Record<string, { tono: Tono; d: string; color: string }> = {
  DIAMANTE: { tono: "ok", d: "Alto volumen y alto margen. Blindar y expandir.", color: COL.ok },
  VOLUMEN: { tono: "warn", d: "Alto volumen, margen bajo. Renegociar tarifa o costo.", color: COL.warn },
  NICHO: { tono: "info", d: "Buen margen, poco volumen. Aumentar frecuencia.", color: "#175E9E" },
  MARGINAL: { tono: "risk", d: "Bajo volumen y bajo margen. Revisar continuidad.", color: COL.risk },
};

export default function Cartera() {
  const d = useDatos();
  const router = useRouter();
  const { modelo: M, filtros: F } = d;
  const r = useMemo(() => {
    if (!M) return null;
    const periodos = periodosFiltrados(M, F);
    const activos = agruparClientes(M, F, hechosFiltrados(M, F), periodos).filter((c) => c.venta > 0);
    const mV = mediana(activos.map((c) => c.venta));
    const mM = mediana(activos.map((c) => c.margen));
    const total = activos.reduce((a, c) => a + c.venta, 0);
    const cl = activos.map((c) => ({ ...c, clase: c.venta >= mV ? (c.margen >= mM ? "DIAMANTE" : "VOLUMEN") : c.margen >= mM ? "NICHO" : "MARGINAL" }));
    let acum = 0;
    const pareto = cl.map((c) => ({ nombre: c.nombre, venta: c.venta, acum: total ? ((acum += c.venta) / total) * 100 : 0 }));
    const corte = pareto.findIndex((p) => p.acum >= 80) + 1;
    const top5 = total ? (cl.slice(0, 5).reduce((a, c) => a + c.venta, 0) / total) * 100 : 0;
    const hhi = total ? cl.reduce((a, c) => a + Math.pow((c.venta / total) * 100, 2), 0) : 0;
    return { cl, mV, mM, total, pareto, corte, top5, hhi };
  }, [M, F]);

  if (!M || !r) return <Empty>Sin datos.</Empty>;
  if (!r.cl.length) return <Empty>No hay clientes con venta en el rango.</Empty>;

  return (
    <div>
      <Eyebrow>Matriz estratégica de cartera</Eyebrow>
      <Aviso>Cada cliente se ubica por su <b>venta</b> (horizontal, escala logarítmica) y su <b>margen %</b> (vertical) contra la mediana de la cartera. El tamaño es la cantidad de servicios. Haz clic en un punto para abrir el cliente.</Aviso>
      <Card titulo="Venta contra margen" sub={`Mediana de venta ${clp(r.mV)} · mediana de margen ${pct(r.mM)}`}>
        <MatrizChart data={r.cl.map((c) => ({ nombre: c.nombre, venta: c.venta, margen: +c.margen.toFixed(1), serv: c.serv, color: CLASES[c.clase].color }))} medVenta={r.mV} medMargen={r.mM} onClick={(n) => router.push(`/clientes/${encodeURIComponent(n)}`)} />
        <div className="mt-2 flex flex-wrap gap-4 text-[11.5px] text-muted">
          {Object.entries(CLASES).map(([k, v]) => <span key={k} className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />{k}</span>)}
        </div>
      </Card>

      <div className="mt-3.5 grid gap-3.5 md:grid-cols-4">
        {Object.entries(CLASES).map(([k, v]) => {
          const arr = r.cl.filter((c) => c.clase === k);
          const venta = arr.reduce((a, c) => a + c.venta, 0);
          return (
            <Card key={k}>
              <Pill tono={v.tono}>{k}</Pill>
              <div className="num mt-2 text-xl font-semibold">{clp(venta)}</div>
              <div className="text-xs text-muted">{arr.length} clientes · {pct(r.total ? (venta / r.total) * 100 : 0)} de la venta</div>
              <div className="mt-1 text-xs text-ink-2">{v.d}</div>
            </Card>
          );
        })}
      </div>

      <Eyebrow>Concentración</Eyebrow>
      <div className="grid gap-3.5 lg:grid-cols-[2fr_1fr]">
        <Card titulo={`${r.corte} clientes concentran el 80% de la venta`} sub={`De ${r.cl.length} clientes activos en el período.`}>
          <ParetoChart data={r.pareto} />
        </Card>
        <Card titulo="Riesgo de dependencia">
          <div className="space-y-3 text-[13px]">
            <div><div className="eyebrow">Top 5 clientes</div><div className="num text-2xl font-semibold">{pct(r.top5, 0)}</div><div className="text-xs text-muted">de la venta del período</div></div>
            <div><div className="eyebrow">Índice HHI</div><div className="num text-2xl font-semibold">{num(r.hhi)}</div><div className="text-xs text-muted">{r.hhi > 2500 ? "Muy concentrada (>2.500)" : r.hhi > 1500 ? "Concentración moderada (1.500–2.500)" : "Cartera diversificada (<1.500)"}</div></div>
            <div><div className="eyebrow">Mayor cliente</div><div className="font-semibold">{r.cl[0].nombre}</div><div className="text-xs text-muted">{pct((r.cl[0].venta / r.total) * 100)} de la venta</div></div>
          </div>
        </Card>
      </div>

      <Eyebrow>Clasificación por cliente</Eyebrow>
      <Tabla alto={560}>
        <thead><tr><th>Cliente</th><th>Segmento</th><th>Clase</th><th className="r">Venta</th><th className="r">Utilidad</th><th className="r">Margen</th><th className="r">Servicios</th><th className="r">Ticket</th><th className="r">Part.</th></tr></thead>
        <tbody>
          {r.cl.map((c) => (
            <tr key={c.nombre}>
              <td><Link className="font-semibold hover:text-venta hover:underline" href={`/clientes/${encodeURIComponent(c.nombre)}`}>{c.nombre}</Link></td>
              <td><PillSeg s={c.segmento} /></td>
              <td><Pill tono={CLASES[c.clase].tono}>{c.clase}</Pill></td>
              <td className="r">{clp(c.venta)}</td>
              <td className="r">{clp(c.util)}</td>
              <td className="r">{pct(c.margen)}</td>
              <td className="r">{num(c.serv)}</td>
              <td className="r">{clp(c.ticket)}</td>
              <td className="r">{pct((c.venta / r.total) * 100)}</td>
            </tr>
          ))}
        </tbody>
      </Tabla>
    </div>
  );
}
