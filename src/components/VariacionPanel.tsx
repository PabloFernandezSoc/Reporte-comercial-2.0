"use client";
import clsx from "clsx";
import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { esRealizado, pasaCliente } from "@/lib/analytics";
import { clp, clpCorto, mes, mesLargo, sumarMes } from "@/lib/format";
import { CAT } from "./charts";
import { useDatos } from "./DataProvider";
import { Card, Pill, PillSeg } from "./ui";

type Base = "mes" | "anio" | "prom3" | "prom6";
const BASES: Record<Base, string> = {
  mes: "Mes anterior",
  anio: "Mismo mes año anterior",
  prom3: "Promedio 3 meses previos",
  prom6: "Promedio 6 meses previos",
};

const SUBE = CAT[0];
const BAJA = "#B3402E";

/** Qué clientes explican el cambio de venta entre un mes y su base de comparación. */
export function VariacionPanel() {
  const d = useDatos();
  const M = d.modelo;
  const [mesB, setMesB] = useState("");
  const [base, setBase] = useState<Base>("mes");
  const [q, setQ] = useState("");
  const [ver, setVer] = useState<"todos" | "suben" | "bajan">("todos");
  const [n, setN] = useState(15);

  const pB = mesB || d.mesAnalisis || M?.mesCerrado || "";
  const periodosBase = useMemo(() => {
    if (!pB) return [];
    if (base === "mes") return [sumarMes(pB, -1)];
    if (base === "anio") return [sumarMes(pB, -12)];
    const k = base === "prom3" ? 3 : 6;
    return Array.from({ length: k }, (_, i) => sumarMes(pB, -(i + 1))).reverse();
  }, [pB, base]);
  const etiquetaBase = base === "mes" || base === "anio" ? mesLargo(periodosBase[0] ?? "") : `promedio ${mes(periodosBase[0])}–${mes(periodosBase[periodosBase.length - 1])}`;

  const r = useMemo(() => {
    if (!M || !pB) return null;
    const F = d.filtros;
    const set = new Set(periodosBase);
    const map = new Map<string, { a: number; b: number }>();
    for (const h of M.datos.hechos) {
      if (!esRealizado(h)) continue;
      if (h.p !== pB && !set.has(h.p)) continue;
      if (!pasaCliente(M, { ...F, buscar: "" }, h.c)) continue;
      const o = map.get(h.c) ?? { a: 0, b: 0 };
      if (h.p === pB) o.b += h.v;
      else o.a += h.v / periodosBase.length;
      map.set(h.c, o);
    }
    const filas = [...map.entries()]
      .map(([c, o]) => ({ c, a: o.a, b: o.b, delta: o.b - o.a, pctv: o.a > 0 ? ((o.b - o.a) / o.a) * 100 : null, seg: M.clientes.get(c)?.segmento ?? "SIN CLASIFICAR" }))
      .filter((x) => Math.abs(x.delta) > 0.5);
    const totA = filas.reduce((s, x) => s + x.a, 0);
    const totB = filas.reduce((s, x) => s + x.b, 0);
    const suben = filas.filter((x) => x.delta > 0);
    const bajan = filas.filter((x) => x.delta < 0);
    return {
      filas, totA, totB,
      subeV: suben.reduce((s, x) => s + x.delta, 0), subeN: suben.length,
      bajaV: bajan.reduce((s, x) => s + x.delta, 0), bajaN: bajan.length,
      nuevos: filas.filter((x) => x.a <= 0 && x.b > 0).length,
      perdidos: filas.filter((x) => x.b <= 0 && x.a > 0).length,
    };
  }, [M, pB, periodosBase, d.filtros]);

  if (!M || !r) return null;
  const qn = q.trim().toUpperCase();
  const lista = r.filas
    .filter((x) => (ver === "suben" ? x.delta > 0 : ver === "bajan" ? x.delta < 0 : true))
    .filter((x) => !qn || x.c.toUpperCase().includes(qn))
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
  const visibles = qn ? lista : lista.slice(0, n);
  const maxAbs = Math.max(1, ...visibles.map((x) => Math.abs(x.delta)));
  const deltaTot = r.totB - r.totA;
  const meses = M.periodos.filter((p) => p <= M.mesActual).slice(-18).reverse();
  // puente compacto: base → subidas → bajadas → resultado (misma escala)
  const escala = Math.max(r.totA + r.subeV, r.totB, 1);

  return (
    <Card
      titulo="¿Qué clientes explican la variación?"
      sub={<>Venta realizada de <b className="text-ink">{mesLargo(pB)}</b> comparada con <b className="text-ink">{etiquetaBase}</b>. Respeta los filtros de segmento y ejecutiva.</>}
    >
      {/* controles */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Mes a analizar
          <select className="rounded-md border border-line bg-white px-2 py-1.5 text-[13px] font-normal tracking-normal text-ink normal-case" value={pB} onChange={(e) => setMesB(e.target.value)}>
            {meses.map((p) => <option key={p} value={p}>{mesLargo(p)}{p === M.mesActual ? " (en curso)" : ""}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-semibold tracking-widest text-muted uppercase">Comparar contra</span>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(BASES) as Base[]).map((b) => (
              <button key={b} onClick={() => setBase(b)} aria-pressed={base === b}
                className={clsx("cursor-pointer rounded-md border px-2.5 py-1.5 text-xs", base === b ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}>{BASES[b]}</button>
            ))}
          </div>
        </div>
        <label className="ml-auto flex flex-col gap-0.5 text-[10px] font-semibold tracking-widest text-muted uppercase">Buscar cliente
          <span className="relative">
            <Search size={14} className="absolute top-1/2 left-2 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre…" className="w-56 rounded-md border border-line bg-white py-1.5 pr-2 pl-7 text-[13px] font-normal tracking-normal text-ink normal-case" />
          </span>
        </label>
      </div>
      {pB === M.mesActual && <p className="-mt-2 mb-3 text-[12px] text-warn">Mes en curso: la venta aún está incompleta, la comparación favorece a la base.</p>}

      {/* resumen */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Resumen k={`Base · ${etiquetaBase}`} v={clpCorto(r.totA)} />
        <Resumen k={mesLargo(pB)} v={clpCorto(r.totB)} d={<span className={deltaTot >= 0 ? "text-ok" : "text-risk"}>{deltaTot >= 0 ? "+" : "−"}{clpCorto(Math.abs(deltaTot))} ({r.totA ? `${deltaTot >= 0 ? "+" : ""}${((deltaTot / r.totA) * 100).toFixed(1)}%` : "—"})</span>} />
        <Resumen k="Subieron" v={<span style={{ color: SUBE }}>+{clpCorto(r.subeV)}</span>} d={`${r.subeN} clientes · ${r.nuevos} nuevos`} />
        <Resumen k="Bajaron" v={<span style={{ color: BAJA }}>−{clpCorto(Math.abs(r.bajaV))}</span>} d={`${r.bajaN} clientes · ${r.perdidos} sin venta`} />
        <div>
          <div className="eyebrow">Puente</div>
          <div className="mt-2 space-y-1" aria-hidden>
            <BarraPuente left={0} width={r.totA / escala} color="#33454C" />
            <BarraPuente left={r.totA / escala} width={r.subeV / escala} color={SUBE} />
            <BarraPuente left={(r.totA + r.subeV + r.bajaV) / escala} width={Math.abs(r.bajaV) / escala} color={BAJA} />
            <BarraPuente left={0} width={r.totB / escala} color="#33454C" />
          </div>
        </div>
      </div>

      {/* ranking divergente */}
      <div className="mt-5 mb-2 flex flex-wrap items-center gap-2">
        {(["todos", "suben", "bajan"] as const).map((v) => (
          <button key={v} onClick={() => setVer(v)} aria-pressed={ver === v}
            className={clsx("cursor-pointer rounded-full border px-3 py-1 text-xs", ver === v ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}>
            {v === "todos" ? "Mayores movimientos" : v === "suben" ? "Solo subidas" : "Solo bajadas"}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-muted">{qn ? `${lista.length} resultados` : `Mostrando ${visibles.length} de ${lista.length}`}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="text-[10.5px] tracking-wider text-muted uppercase">
              <th className="py-2 text-left font-semibold">Cliente</th>
              <th className="py-2 text-right font-semibold">Base</th>
              <th className="py-2 text-right font-semibold">{mes(pB)}</th>
              <th className="w-[38%] py-2 text-center font-semibold">
                <span style={{ color: BAJA }}>◂ bajó</span> <span className="mx-2 text-line">|</span> <span style={{ color: SUBE }}>subió ▸</span>
              </th>
              <th className="py-2 text-right font-semibold">Variación</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((x) => {
              const ancho = (Math.abs(x.delta) / maxAbs) * 50;
              const sube = x.delta >= 0;
              return (
                <tr key={x.c} className="border-t border-line-2 hover:bg-[#F5F9F8]">
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/clientes/${encodeURIComponent(x.c)}`} className="max-w-[260px] truncate font-medium hover:text-venta hover:underline" title={x.c}>{x.c}</Link>
                      <PillSeg s={x.seg} />
                      {x.a <= 0 && <Pill tono="info">Nuevo</Pill>}
                      {x.b <= 0 && <Pill tono="risk">Sin venta</Pill>}
                    </div>
                  </td>
                  <td className="num py-1.5 text-right text-muted">{clpCorto(x.a)}</td>
                  <td className="num py-1.5 text-right">{clpCorto(x.b)}</td>
                  <td className="px-2 py-1.5">
                    <div className="relative h-5" title={`${clp(x.a)} → ${clp(x.b)}`}>
                      <div className="absolute inset-y-0 left-1/2 w-px bg-line" />
                      <div className="absolute inset-y-[3px] rounded-[3px]"
                        style={{ background: sube ? SUBE : BAJA, width: `${ancho}%`, left: sube ? "50%" : `${50 - ancho}%` }} />
                    </div>
                  </td>
                  <td className="num py-1.5 text-right whitespace-nowrap" style={{ color: sube ? SUBE : BAJA }}>
                    {sube ? "+" : "−"}{clpCorto(Math.abs(x.delta))}
                    <span className="ml-1.5 text-[11px] text-muted">{x.pctv != null ? `${sube ? "+" : ""}${x.pctv.toFixed(0)}%` : "nuevo"}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!qn && lista.length > n && (
        <button onClick={() => setN(n + 25)} className="mt-3 cursor-pointer text-[12.5px] text-venta hover:underline">Ver 25 más</button>
      )}
    </Card>
  );
}

function Resumen({ k, v, d }: { k: string; v: React.ReactNode; d?: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow truncate" title={k}>{k}</div>
      <div className="mt-1 text-[22px] leading-tight font-semibold">{v}</div>
      {d && <div className="mt-0.5 text-[12px] text-muted">{d}</div>}
    </div>
  );
}

function BarraPuente({ left, width, color }: { left: number; width: number; color: string }) {
  return (
    <div className="relative h-2.5 rounded-sm bg-line-2/60">
      <div className="absolute inset-y-0 rounded-sm" style={{ left: `${left * 100}%`, width: `${Math.max(0.5, width * 100)}%`, background: color }} />
    </div>
  );
}
