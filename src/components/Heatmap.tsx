"use client";
import clsx from "clsx";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { AnalisisCliente } from "@/lib/analytics";
import { clp, mes } from "@/lib/format";

/** Color divergente según z: rojo = bajo lo normal, verde = sobre lo normal, blanco = dentro del rango. */
export function colorZ(z: number | null, real: number): string {
  if (z == null) return real > 0 ? "#F1F4F3" : "#FAFBFB";
  const t = Math.max(-3, Math.min(3, z));
  if (Math.abs(t) < 0.8) return "#F0F2F1";
  const a = Math.min(1, (Math.abs(t) - 0.8) / 2.2);
  return t < 0 ? `rgba(179,64,46,${0.15 + 0.75 * a})` : `rgba(42,120,214,${0.15 + 0.7 * a})`;
}

type Orden = "venta" | "deterioro" | "nombre";
const ORDENES: Record<Orden, string> = { venta: "Mayor venta", deterioro: "Mayor deterioro reciente", nombre: "Nombre" };
const ctl = "rounded-md border border-line bg-white px-2 py-1.5 text-[13px]";

export function Heatmap({ analisis }: { analisis: AnalisisCliente[] }) {
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<Orden>("venta");
  const [max, setMax] = useState(25);
  const [meses, setMeses] = useState(12);
  const qn = q.trim().toUpperCase();
  // deterioro: suma de z negativos de los últimos 3 meses
  const det = (a: AnalisisCliente) => a.venta.puntos.slice(-3).reduce((x, p) => x + Math.min(0, p.z ?? 0), 0);
  const todas = [...analisis]
    .map((a) => ({ a, total: a.venta.puntos.slice(-meses).reduce((x, p) => x + p.real, 0) }))
    .filter((f) => f.total > 0)
    .filter((f) => !qn || f.a.nombre.toUpperCase().includes(qn));
  todas.sort((x, y) => (orden === "venta" ? y.total - x.total : orden === "deterioro" ? det(x.a) - det(y.a) : x.a.nombre.localeCompare(y.a.nombre)));
  const filas = qn ? todas : todas.slice(0, max);
  const ps = analisis[0]?.periodos.slice(-meses) ?? [];
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Buscar cliente
          <span className="relative">
            <Search size={14} className="absolute top-1/2 left-2 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre…" className={clsx(ctl, "w-60 pl-7 font-normal tracking-normal normal-case")} />
          </span>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Ordenar por
          <select className={clsx(ctl, "font-normal tracking-normal normal-case")} value={orden} onChange={(e) => setOrden(e.target.value as Orden)}>
            {(Object.keys(ORDENES) as Orden[]).map((o) => <option key={o} value={o}>{ORDENES[o]}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Clientes
          <select className={clsx(ctl, "font-normal tracking-normal normal-case")} value={max} onChange={(e) => setMax(+e.target.value)}>
            {[15, 25, 50, 100, 1000].map((n) => <option key={n} value={n}>{n === 1000 ? "Todos" : n}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Meses
          <select className={clsx(ctl, "font-normal tracking-normal normal-case")} value={meses} onChange={(e) => setMeses(+e.target.value)}>
            {[6, 12, 18, 24].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span className="ml-auto text-[12px] text-muted">{qn ? `${filas.length} resultados` : `${filas.length} de ${todas.length} clientes`}</span>
      </div>
      {!filas.length ? <p className="py-6 text-center text-[13px] text-muted">Ningún cliente coincide con la búsqueda.</p> : (
    <div className="max-h-[640px] overflow-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky top-0 left-0 z-20 bg-surface text-left text-[10px] font-semibold tracking-wider text-muted uppercase">Cliente</th>
            {ps.map((p) => (
              <th key={p} className="sticky top-0 z-10 bg-surface px-1 text-center text-[10.5px] font-medium text-muted">{mes(p)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ a }) => {
            const pts = a.venta.puntos.slice(-meses);
            // en clientes esporádicos (proyectos) un mes sin carga es parte de su patrón
            const esporadico = a.venta.tasaCeros >= 0.25;
            return (
              <tr key={a.nombre}>
                <td className="sticky left-0 max-w-[220px] truncate bg-surface pr-2 text-[12.5px]">
                  <Link href={`/clientes/${encodeURIComponent(a.nombre)}`} className="hover:text-venta hover:underline">{a.nombre}</Link>
                </td>
                {pts.map((p) => (
                  <td
                    key={p.p}
                    title={`${a.nombre} · ${mes(p.p)}\nReal ${clp(p.real)}\nEsperado ${clp(p.esperado)}${p.z != null ? `\nz ${p.z.toFixed(1)}` : ""}`}
                    className="num h-7 min-w-[46px] rounded-sm text-center text-[10.5px]"
                    style={{ background: colorZ(esporadico && p.real <= 0 ? null : p.z, p.real), color: !(esporadico && p.real <= 0) && p.z != null && Math.abs(p.z) > 2 ? "#fff" : "#33454C" }}
                  >
                    {p.real > 0 ? (p.real >= 1e6 ? (p.real / 1e6).toFixed(0) : "<1") : "·"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11.5px] text-muted">
        <span>Cifras en millones de CLP. El color compara cada mes con lo normal <b>para ese cliente</b>:</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(179,64,46,.85)" }} /> muy bajo lo normal</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(179,64,46,.3)" }} /> algo bajo</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: "#F4F7F6" }} /> normal</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(42,120,214,.7)" }} /> sobre lo normal</span>
      </div>
    </div>
  );
}
