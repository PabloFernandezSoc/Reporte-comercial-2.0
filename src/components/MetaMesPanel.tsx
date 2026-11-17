"use client";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { esRealizado } from "@/lib/analytics";
import { avanceMes, clp, clpCorto, mes, mesLargo, num, pct, rangoSemana, rangoPeriodos } from "@/lib/format";
import { useDatos } from "./DataProvider";
import { Card, Pill, nivel } from "./ui";

const CARTERAS = [
  { k: "TOTAL", n: "Total empresa" },
  { k: "FFWW", n: "Clientes FFWW" },
  { k: "CD", n: "Clientes directos (CD)" },
  { k: "OTROS", n: "Otros / sin clasificar" },
] as const;

type Celda = { v: number; s: number };
const vacia = (): Celda => ({ v: 0, s: 0 });

function diaMes(f: string) {
  const [, m, d] = f.split("-");
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

/**
 * Seguimiento de la meta del mes al estilo del tablero de KRs:
 * realizado vs meta, ritmo esperado a la fecha, programado aparte y detalle semanal por cartera.
 */
export function MetaMesPanel() {
  const d = useDatos();
  const M = d.modelo;
  const metas = d.metas;
  const anio = (M?.mesActual ?? "2026").slice(0, 4);
  const meses = useMemo(() => rangoPeriodos(`${anio}-01`, `${anio}-12`).filter((p) => metas?.general[p] || metas?.seg.FFWW?.[p] || metas?.seg.CD?.[p]), [anio, metas]);
  const [sel, setSel] = useState<string>("");
  const p = sel || (M && meses.includes(M.mesActual) ? M.mesActual : meses[meses.length - 1]) || "";

  const r = useMemo(() => {
    if (!M || !metas || !p) return null;
    const cartera = (c: string) => {
      const s = M.clientes.get(c)?.segmento;
      return s === "FFWW" || s === "CD" ? s : "OTROS";
    };
    const semanas = new Set<string>();
    const real: Record<string, Record<string, Celda>> = {}; // cartera → semana → celda
    const prog: Record<string, Celda> = {};
    for (const k of CARTERAS) { real[k.k] = {}; prog[k.k] = vacia(); }
    for (const h of M.datos.hechos) {
      if (h.p !== p) continue;
      const cs = ["TOTAL", cartera(h.c)];
      if (!esRealizado(h)) {
        cs.forEach((c) => { prog[c].v += h.v; prog[c].s += h.s; });
        continue;
      }
      const w = h.w || "s/f";
      semanas.add(w);
      cs.forEach((c) => { const x = (real[c][w] ||= vacia()); x.v += h.v; x.s += h.s; });
    }
    const metaDe = (c: string) => (c === "TOTAL" ? +metas.general[p] || 0 : c === "OTROS" ? 0 : +(metas.seg[c]?.[p] ?? 0));
    const filas = CARTERAS.map((k) => {
      const tot = Object.values(real[k.k]).reduce((a, x) => ({ v: a.v + x.v, s: a.s + x.s }), vacia());
      const meta = metaDe(k.k);
      return { ...k, real: real[k.k], tot, prog: prog[k.k], meta, cumpl: meta > 0 ? (tot.v / meta) * 100 : null };
    });
    const estado = p < M.mesActual ? "cerrado" : p === M.mesActual ? "curso" : "futuro";
    const av = estado === "curso" ? avanceMes(M.datos.hoy) : { transcurrido: 0, total: avanceMes(`${p}-28`).total, fraccion: estado === "cerrado" ? 1 : 0 };
    const sumaSeg = metaDe("FFWW") + metaDe("CD");
    // Q4 (o trimestre del mes): cumplimiento por mes
    const q = Math.floor((parseInt(p.slice(5), 10) - 1) / 3);
    const trimestre = [1, 2, 3].map((i) => `${anio}-${String(q * 3 + i).padStart(2, "0")}`);
    const tri = trimestre.map((pp) => {
      let v = 0;
      for (const h of M.datos.hechos) if (h.p === pp && esRealizado(h)) v += h.v;
      const mt = +metas.general[pp] || 0;
      return { p: pp, v, mt, futuro: pp > M.mesActual };
    });
    return { semanas: [...semanas].sort(), filas, estado, av, sumaSeg, tri, q: q + 1 };
  }, [M, metas, p, anio]);

  if (!r || !M) return null;
  const tot = r.filas[0];
  const { umbralOk: ok, umbralAlerta: al } = d.umbrales;
  const esperado = tot.meta * r.av.fraccion;
  const desvio = tot.tot.v - esperado;
  const falta = Math.max(0, tot.meta - tot.tot.v);
  const diasRest = r.av.total - r.av.transcurrido;
  const conProg = tot.meta > 0 ? ((tot.tot.v + tot.prog.v) / tot.meta) * 100 : null;
  const escala = Math.max(tot.meta, tot.tot.v + tot.prog.v) * 1.04 || 1;
  const w = (v: number) => `${Math.min(100, (v / escala) * 100)}%`;
  // en el mes en curso el color se juzga contra el ritmo esperado a la fecha, no contra el 100%
  const tono = (c: number | null) => nivel(c == null ? null : r.estado === "curso" && r.av.fraccion > 0 ? c / r.av.fraccion : c, ok, al);

  return (
    <Card
      titulo={`Seguimiento de metas · ${mesLargo(p)}`}
      sub="Venta realizada (servicios con fecha hasta hoy, sin anulados) contra la meta del mes. Lo programado a futuro se muestra aparte."
      accion={
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Mes">
          {meses.slice(-6).map((m) => (
            <button key={m} role="tab" aria-selected={m === p} onClick={() => setSel(m)}
              className={clsx("cursor-pointer rounded-md border px-2.5 py-1 text-xs", m === p ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}>
              {mes(m)}
            </button>
          ))}
        </div>
      }
    >
      {/* titulares */}
      <div className="grid gap-4 border-b border-line-2 pb-4 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
        <div>
          <div className="eyebrow">Cumplimiento</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={clsx("text-[40px] leading-none font-semibold tracking-tight", { "text-ok": tono(tot.cumpl) === "ok", "text-warn": tono(tot.cumpl) === "warn", "text-risk": tono(tot.cumpl) === "risk" })}>
              {pct(tot.cumpl, 0)}
            </span>
            <span className="text-sm text-muted">de la meta</span>
          </div>
          <div className="mt-1 text-[13px] text-ink-2">{clp(tot.tot.v)} de {clp(tot.meta)}</div>
        </div>
        <Dato k={r.estado === "curso" ? "Ritmo esperado a hoy" : r.estado === "cerrado" ? "Mes cerrado" : "Mes futuro"}
          v={r.estado === "curso" ? pct(r.av.fraccion * 100, 0) : r.estado === "cerrado" ? "100%" : "—"}
          d={r.estado === "curso" ? <>{r.av.transcurrido} de {r.av.total} días hábiles · <span className={desvio >= 0 ? "text-ok" : "text-risk"}>{desvio >= 0 ? "adelantado" : "atrasado"} {clpCorto(Math.abs(desvio))}</span></> : r.estado === "cerrado" ? (tot.cumpl != null && tot.cumpl >= 100 ? "Meta cumplida" : `Quedó en ${pct(tot.cumpl, 0)}`) : "Aún no comienza"} />
        <Dato k="Programado (agendado)" v={clpCorto(tot.prog.v)} d={<>{num(tot.prog.s)} servicios · con programado {pct(conProg, 0)}</>} />
        <Dato k="Falta para la meta" v={clpCorto(falta)} d={r.estado === "curso" && diasRest > 0 ? <>{clpCorto(falta / diasRest)} por día hábil · {diasRest} días restantes</> : r.estado === "cerrado" ? (falta > 0 ? "No se alcanzó" : "Superada") : "—"} />
      </div>

      {/* barra de avance */}
      <div className="py-4">
        <div className="relative h-7 overflow-hidden rounded-md bg-line-2" role="img" aria-label={`Realizado ${pct(tot.cumpl, 0)} de la meta`}>
          <div className="absolute inset-y-0 left-0 bg-venta" style={{ width: w(tot.tot.v) }} />
          <div className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,#8CC8CD_0_6px,#B9DFE2_6px_10px)]" style={{ left: w(tot.tot.v), width: w(tot.prog.v) }} />
        </div>
        <div className="relative h-9">
          {r.estado === "curso" && (
            <Marca left={w(esperado)} label={`Esperado hoy ${clpCorto(esperado)}`} />
          )}
          <Marca left={w(tot.meta)} label={`Meta ${clpCorto(tot.meta)}`} fuerte />
        </div>
        <div className="flex flex-wrap gap-4 text-[11.5px] text-muted">
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-venta" /> Realizado {clpCorto(tot.tot.v)}</span>
          <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[repeating-linear-gradient(135deg,#8CC8CD_0_3px,#B9DFE2_3px_5px)]" /> Programado {clpCorto(tot.prog.v)}</span>
        </div>
      </div>

      {/* detalle semanal estilo KR */}
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Cartera</th>
              {r.semanas.map((s) => {
                const [a, b] = s.includes("-W") ? rangoSemana(s) : ["", ""];
                return <th key={s} className="r">Sem {s.split("-W")[1] ?? "s/f"}<div className="text-[10px] font-normal tracking-normal text-muted normal-case">{a && `${diaMes(a)}–${diaMes(b)}`}</div></th>;
              })}
              <th className="r">Realizado</th>
              <th className="r">Meta</th>
              <th style={{ width: 150 }}>Cumplimiento</th>
              <th className="r">Programado</th>
            </tr>
          </thead>
          <tbody>
            {r.filas.map((f) => (
              <tr key={f.k} className={f.k === "TOTAL" ? "bg-[#F7F9F8] font-semibold" : ""}>
                <td>{f.n}</td>
                {r.semanas.map((s) => <td key={s} className="r">{f.real[s] ? clpCorto(f.real[s].v) : "—"}</td>)}
                <td className="r">{clpCorto(f.tot.v)}</td>
                <td className="r text-muted">{f.meta ? clpCorto(f.meta) : "—"}</td>
                <td>
                  {f.cumpl != null ? (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-line-2"><div className={clsx("h-full rounded-full", tono(f.cumpl) === "ok" ? "bg-ok" : tono(f.cumpl) === "warn" ? "bg-warn" : "bg-risk")} style={{ width: `${Math.min(100, f.cumpl)}%` }} /></div>
                      <span className="num w-10 text-right text-[12px]">{pct(f.cumpl, 0)}</span>
                    </div>
                  ) : <span className="text-[12px] font-normal text-muted">sin meta</span>}
                </td>
                <td className="r text-muted">{f.prog.v ? clpCorto(f.prog.v) : "—"}</td>
              </tr>
            ))}
            <tr className="text-muted">
              <td>Servicios (total)</td>
              {r.semanas.map((s) => <td key={s} className="r">{num(tot.real[s]?.s)}</td>)}
              <td className="r">{num(tot.tot.s)}</td>
              <td /><td /><td className="r">{num(tot.prog.s)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {Math.abs(r.sumaSeg - tot.meta) > 1 && r.sumaSeg > 0 && (
        <p className="mt-2 text-[12px] text-warn">La meta total ({clp(tot.meta)}) no es igual a FFWW + CD ({clp(r.sumaSeg)}). Revísala en Metas.</p>
      )}
      <p className="mt-2 text-[11.5px] text-muted">
        "Otros / sin clasificar" agrupa CAPEX, CHURN y clientes sin cruce con el plan; cuentan en el total pero no en FFWW ni CD.
        Semanas ISO según la fecha de presentación del servicio.
      </p>

      {/* trimestre */}
      <div className="mt-4 grid gap-2.5 sm:grid-cols-4">
        {r.tri.map((t) => {
          const c = t.mt ? (t.v / t.mt) * 100 : null;
          return (
            <button key={t.p} onClick={() => setSel(t.p)} className={clsx("cursor-pointer rounded-md border px-3 py-2.5 text-left hover:bg-paper", t.p === p ? "border-ink" : "border-line")}>
              <div className="flex items-center justify-between"><span className="eyebrow">{mesLargo(t.p)}</span>{!t.futuro && c != null && <Pill tono={t.p === M.mesActual ? nivel(c / Math.max(0.01, avanceMes(M.datos.hoy).fraccion), ok, al) : nivel(c, ok, al)}>{pct(c, 0)}{t.p === M.mesActual ? " · en curso" : ""}</Pill>}</div>
              <div className="mt-1 text-[15px] font-semibold">{t.futuro ? "—" : clpCorto(t.v)} <span className="text-[12px] font-normal text-muted">/ {clpCorto(t.mt)}</span></div>
            </button>
          );
        })}
        {(() => {
          const v = r.tri.reduce((a, t) => a + t.v, 0);
          const mt = r.tri.reduce((a, t) => a + t.mt, 0);
          return (
            <div className="rounded-md border border-line bg-[#F7F9F8] px-3 py-2.5">
              <div className="eyebrow">Q{r.q} acumulado</div>
              <div className="mt-1 text-[15px] font-semibold">{clpCorto(v)} <span className="text-[12px] font-normal text-muted">/ {clpCorto(mt)}</span></div>
              <div className="text-[11.5px] text-muted">{pct(mt ? (v / mt) * 100 : null, 0)} de la meta del trimestre</div>
            </div>
          );
        })()}
      </div>
    </Card>
  );
}

function Dato({ k, v, d }: { k: string; v: React.ReactNode; d?: React.ReactNode }) {
  return (
    <div>
      <div className="eyebrow">{k}</div>
      <div className="mt-1 text-[22px] leading-tight font-semibold">{v}</div>
      {d && <div className="mt-1 text-[12px] text-muted">{d}</div>}
    </div>
  );
}

function Marca({ left, label, fuerte }: { left: string; label: string; fuerte?: boolean }) {
  return (
    <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left }}>
      <div className={clsx("-mt-9 h-9 w-0.5", fuerte ? "bg-ink" : "bg-warn")} />
      <span className={clsx("mt-1 whitespace-nowrap text-[11px]", fuerte ? "font-semibold text-ink" : "text-warn")}>{label}</span>
    </div>
  );
}
