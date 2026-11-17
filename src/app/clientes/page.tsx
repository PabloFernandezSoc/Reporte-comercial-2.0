"use client";
import { PageHeader } from "@/components/PageHeader";
import Link from "next/link";
import { useMemo, useState } from "react";
import { COL, Sparkline } from "@/components/charts";
import { useDatos } from "@/components/DataProvider";
import { Empty, Eyebrow, Gauge, Pill, PillSeg, Tabla } from "@/components/ui";
import { agruparClientes, hechosFiltrados, periodosFiltrados } from "@/lib/analytics";
import { DIAG_INFO, type Diagnostico } from "@/lib/anomaly";
import { clpCorto, num, pct } from "@/lib/format";

const ORDEN_DIAG: Record<Diagnostico, number> = { fuga: 0, "caida-significativa": 1, "tendencia-baja": 2, "bajo-vigilancia": 3, nuevo: 4, normal: 5, alza: 6, "sin-historia": 7 };

export default function Clientes() {
  const d = useDatos();
  const { modelo: M, filtros: F } = d;
  const [orden, setOrden] = useState<"venta" | "salud" | "cumpl" | "margen">("venta");

  const filas = useMemo(() => {
    if (!M) return [];
    const periodos = periodosFiltrados(M, F);
    const lista = agruparClientes(M, F, hechosFiltrados(M, F), periodos);
    const an = new Map(d.analisis.map((a) => [a.nombre, a]));
    const out = lista.map((c) => ({ c, a: an.get(c.nombre) }));
    const k = (x: (typeof out)[number]) => ORDEN_DIAG[x.a?.dVenta.diag ?? "sin-historia"];
    if (orden === "salud") out.sort((x, y) => k(x) - k(y) || y.c.venta - x.c.venta);
    if (orden === "cumpl") out.sort((x, y) => (x.c.cumpl ?? 999) - (y.c.cumpl ?? 999));
    if (orden === "margen") out.sort((x, y) => x.c.margen - y.c.margen);
    return out;
  }, [M, F, d.analisis, orden]);

  if (!M) return <Empty>Sin datos.</Empty>;
  const conteo = (dg: Diagnostico[]) => filas.filter((f) => f.a && dg.includes(f.a.dVenta.diag)).length;

  return (
    <div>
      <PageHeader titulo="Clientes" sub={<>{filas.length} clientes · estado al cierre de {d.mesAnalisis}</>} />
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px]">
        <Pill tono="risk">{conteo(["fuga", "caida-significativa"])} en riesgo</Pill>
        <Pill tono="warn">{conteo(["tendencia-baja", "bajo-vigilancia"])} a vigilar</Pill>
        <Pill tono="n">{conteo(["normal"])} normales</Pill>
        <Pill tono="ok">{conteo(["alza"])} creciendo</Pill>
        <span className="ml-auto text-muted">Ordenar por</span>
        {(["venta", "salud", "cumpl", "margen"] as const).map((o) => (
          <button key={o} onClick={() => setOrden(o)} className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${orden === o ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            {o === "venta" ? "Venta" : o === "salud" ? "Salud" : o === "cumpl" ? "Cumplimiento" : "Margen"}
          </button>
        ))}
      </div>
      <Tabla alto={720}>
        <thead>
          <tr>
            <th>Cliente</th><th>Estado ({d.mesAnalisis})</th><th style={{ width: 130 }}>Últimos 12 meses</th><th className="r">Venta período</th><th className="r">vs esperado</th><th style={{ width: 140 }}>Cumplimiento</th><th className="r">Margen</th><th className="r">Serv.</th><th>Ejecutiva</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ c, a }) => {
            const dg = a?.dVenta;
            const info = DIAG_INFO[dg?.diag ?? "sin-historia"];
            const vsEsp = dg?.esperado ? ((dg.real - dg.esperado) / dg.esperado) * 100 : null;
            return (
              <tr key={c.nombre}>
                <td>
                  <Link href={`/clientes/${encodeURIComponent(c.nombre)}`} className="font-semibold hover:text-venta hover:underline">{c.nombre}</Link>
                  <div className="mt-0.5 flex gap-1"><PillSeg s={c.segmento} />{d.modelo?.clientes.get(c.nombre)?.calificacion && <Pill tono="n">{d.modelo.clientes.get(c.nombre)!.calificacion}</Pill>}</div>
                </td>
                <td><Pill tono={info.tono}>{info.label}</Pill></td>
                <td><Sparkline valores={a?.venta.puntos.slice(-12).map((p) => p.real) ?? []} color={info.tono === "risk" ? COL.risk : info.tono === "warn" ? COL.warn : COL.venta} alto={30} /></td>
                <td className="r">{clpCorto(c.venta)}</td>
                <td className={`r ${vsEsp != null && vsEsp < 0 ? "text-risk" : "text-ok"}`}>{vsEsp == null ? "—" : `${vsEsp >= 0 ? "+" : ""}${vsEsp.toFixed(0)}%`}</td>
                <td>{c.meta ? <div className="flex items-center gap-2"><Gauge cumpl={c.cumpl} /><span className="num text-[11.5px]">{pct(c.cumpl, 0)}</span></div> : <span className="text-[11.5px] text-muted">sin meta</span>}</td>
                <td className="r">{pct(c.margen, 0)}</td>
                <td className="r">{num(c.serv)}</td>
                <td className="text-[12px] text-muted">{c.ejecutiva || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>
    </div>
  );
}
