"use client";
import { useMemo } from "react";
import { avanceMes, clp, clpCorto, mes, pct } from "@/lib/format";
import { useDatos } from "./DataProvider";
import { Card, Gauge, nivel, Pill, Tabla } from "./ui";

/** Seguimiento de la propuesta de metas Q4: meta vs real por mes y segmento. */
export function Q4Panel() {
  const d = useDatos();
  const M = d.modelo;
  const q4 = d.metas?.q4;

  const r = useMemo(() => {
    if (!M || !d.metas || !q4) return null;
    const P = q4.periodos;
    const real = new Map<string, number>(); // `${seg}|${p}`
    for (const h of M.datos.hechos) {
      if (!P.includes(h.p)) continue;
      const s = M.clientes.get(h.c)?.segmento ?? "SIN CLASIFICAR";
      real.set(`${s}|${h.p}`, (real.get(`${s}|${h.p}`) || 0) + h.v);
      real.set(`TOTAL|${h.p}`, (real.get(`TOTAL|${h.p}`) || 0) + h.v);
    }
    const av = avanceMes(M.datos.hoy);
    const filas = [
      { k: "TOTAL", n: "Total empresa", meta: d.metas.general },
      ...["FFWW", "CD"].map((s) => ({ k: s, n: s, meta: d.metas!.seg[s] ?? {} })),
    ].map((f) => ({
      ...f,
      meses: P.map((p) => {
        const mt = +f.meta[p] || 0;
        const rv = real.get(`${f.k}|${p}`) || 0;
        const estado = p < M.mesActual ? "cerrado" : p === M.mesActual ? "curso" : "futuro";
        // en el mes en curso se compara contra el ritmo esperado a la fecha
        const ritmo = estado === "curso" && mt > 0 ? (rv / (mt * av.fraccion)) * 100 : null;
        return { p, mt, rv, estado, cumpl: mt > 0 && estado !== "futuro" ? (rv / mt) * 100 : null, ritmo };
      }),
    }));
    const otros = P.map((p) => real.get(`CAPEX|${p}`) || 0).some(Boolean) || P.map((p) => real.get(`SIN CLASIFICAR|${p}`) || 0).some(Boolean);
    const sinClasif = P.map((p) => (real.get(`SIN CLASIFICAR|${p}`) || 0) + (real.get(`CAPEX|${p}`) || 0) + (real.get(`CHURN|${p}`) || 0));
    return { P, filas, av, otros, sinClasif };
  }, [M, d.metas, q4]);

  if (!r) return null;
  const { umbralOk: ok, umbralAlerta: al } = d.umbrales;
  const tot = r.filas[0];
  const totMeta = tot.meses.reduce((a, m) => a + m.mt, 0);
  const totReal = tot.meses.reduce((a, m) => a + m.rv, 0);

  return (
    <Card
      titulo={`Metas Q4 ${r.P[0].slice(0, 4)}`}
      sub={`Propuesta de metas (${q4!.archivo}). Total = FFWW + CD. El mes en curso se compara contra el avance esperado a la fecha (${r.av.transcurrido} de ${r.av.total} días hábiles).`}
      accion={<div className="text-right"><div className="text-[11px] tracking-wider text-muted uppercase">Avance Q4</div><div className="text-lg font-semibold">{clpCorto(totReal)} <span className="text-sm font-normal text-muted">de {clpCorto(totMeta)}</span></div></div>}
    >
      <Tabla>
        <thead>
          <tr>
            <th>Cartera</th>
            {r.P.map((p) => <th key={p} className="r" colSpan={1}>{mes(p)}</th>)}
            <th className="r">Q4</th>
          </tr>
        </thead>
        <tbody>
          {r.filas.map((f) => {
            const mt = f.meses.reduce((a, m) => a + m.mt, 0);
            const rv = f.meses.reduce((a, m) => a + m.rv, 0);
            // meta esperada a la fecha: meses cerrados completos + proporción del mes en curso
            const aFecha = f.meses.reduce((a, m) => a + (m.estado === "cerrado" ? m.mt : m.estado === "curso" ? m.mt * r.av.fraccion : 0), 0);
            const vsFecha = aFecha > 0 ? (rv / aFecha) * 100 : null;
            return (
              <tr key={f.k} className={f.k === "TOTAL" ? "bg-[#F7F9F8] font-semibold" : ""}>
                <td>{f.n}</td>
                {f.meses.map((m) => (
                  <td key={m.p} className="r align-top">
                    <div className="num text-ink">{m.estado === "futuro" ? "—" : clpCorto(m.rv)}</div>
                    <div className="num text-[11px] font-normal text-muted">meta {clpCorto(m.mt)}</div>
                    {m.estado === "cerrado" && m.cumpl != null && <div className="mt-1"><Pill tono={nivel(m.cumpl, ok, al)}>{pct(m.cumpl, 0)}</Pill></div>}
                    {m.estado === "curso" && m.ritmo != null && (
                      <div className="mt-1" title={`${pct(m.cumpl, 0)} de la meta del mes; ritmo esperado ${pct(r.av.fraccion * 100, 0)}`}>
                        <Pill tono={nivel(m.ritmo, ok, al)}>ritmo {pct(m.ritmo, 0)}</Pill>
                      </div>
                    )}
                  </td>
                ))}
                <td className="r align-top">
                  <div className="num text-ink">{clpCorto(rv)}</div>
                  <div className="num text-[11px] font-normal text-muted">meta {clpCorto(mt)}</div>
                  <div className="mt-1.5 ml-auto w-28" title="Venta acumulada vs meta esperada a la fecha"><Gauge cumpl={vsFecha} /></div>
                  <div className="num mt-0.5 text-[11px] font-normal text-muted">{pct(vsFecha, 0)} vs esperado a la fecha</div>
                </td>
              </tr>
            );
          })}
          {r.otros && (
            <tr>
              <td className="text-muted">Otros segmentos / sin clasificar</td>
              {r.sinClasif.map((v, i) => <td key={i} className="r text-muted">{r.filas[0].meses[i].estado === "futuro" ? "—" : clpCorto(v)}</td>)}
              <td className="r text-muted">{clpCorto(r.sinClasif.reduce((a, b) => a + b, 0))}</td>
            </tr>
          )}
        </tbody>
      </Tabla>
      <p className="mt-2 text-[11.5px] text-muted">
        Los clientes sin cruce con el plan quedan en "sin clasificar" y no suman a FFWW ni CD; asígnalos en <b>Metas → Cruce de nombres</b>. Diciembre aún no comienza. Meta diciembre total {clp(tot.meses[2]?.mt)}.
      </p>
    </Card>
  );
}
