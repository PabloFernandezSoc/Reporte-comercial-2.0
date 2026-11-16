"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertaCard } from "@/components/AlertaCard";
import { ApiladoChart, AcumuladoChart, COL, PuenteChart, SegmentosChart, Sparkline, VentaMetaChart, type PasoPuente } from "@/components/charts";
import { useDatos } from "@/components/DataProvider";
import { Heatmap } from "@/components/Heatmap";
import { Card, Empty, Eyebrow, Gauge, Kpi, nivel, Tabla, Variacion } from "@/components/ui";
import { agruparClientes, etiquetaFuenteMeta, hechosFiltrados, metaPeriodo, periodosFiltrados, proyeccionAnual, serieMensual } from "@/lib/analytics";
import { avanceMes, clp, clpCorto, mes, num, pct, sumarMes } from "@/lib/format";
import { ETAPAS } from "@/lib/types";

export default function Resumen() {
  const d = useDatos();
  const { modelo: M, filtros: F } = d;
  const [modoPuente, setModoPuente] = useState<"mes" | "anio">("mes");

  const r = useMemo(() => {
    if (!M) return null;
    const periodos = periodosFiltrados(M, F);
    const hechos = hechosFiltrados(M, F);
    const lista = agruparClientes(M, F, hechos, periodos);
    const serie = serieMensual(hechos, periodos).map((s) => {
      const mt = metaPeriodo(M, F, s.p, lista);
      return { ...s, meta: mt.v, fuente: mt.fuente, cumpl: mt.v > 0 ? (s.venta / mt.v) * 100 : null, enCurso: s.p === M.mesActual };
    });
    const tot = serie.reduce((a, s) => ({ venta: a.venta + s.venta, util: a.util + s.util, serv: a.serv + s.serv, meta: a.meta + s.meta }), { venta: 0, util: 0, serv: 0, meta: 0 });
    // año del mes analizado: acumulado vs meta y proyección
    const anio = d.mesAnalisis.slice(0, 4) || M.mesCerrado.slice(0, 4);
    const hechosAnio = hechosFiltrados(M, { ...F, desde: `${anio}-01`, hasta: `${anio}-12` });
    const periodosAnio = M.periodos.filter((p) => p.startsWith(anio));
    const listaAnio = agruparClientes(M, { ...F, desde: `${anio}-01`, hasta: `${anio}-12` }, hechosAnio, periodosAnio);
    const serieAnio = serieMensual(hechosAnio, periodosAnio);
    const proy = proyeccionAnual(M, serieAnio, anio);
    let aR = 0, aM = 0, aP = 0;
    const acum = proy.map((x) => {
      const mt = metaPeriodo(M, { ...F, desde: `${anio}-01`, hasta: `${anio}-12` }, x.p, listaAnio).v;
      aM += mt;
      if (x.real != null) { aR += x.real; aP = aR; }
      else aP += x.proyectado ?? 0;
      return { p: x.p, real: x.real != null ? aR : null, meta: aM || null, proy: x.real == null || x.p === M.mesCerrado ? aP : null };
    });
    const cierre = acum[acum.length - 1];
    // puente de variación
    const pB = d.mesAnalisis;
    const pA = modoPuente === "mes" ? sumarMes(pB, -1) : sumarMes(pB, -12);
    const porCli = new Map<string, [number, number]>();
    for (const h of hechosFiltrados(M, { ...F, desde: pA, hasta: pB })) {
      if (h.p !== pA && h.p !== pB) continue;
      const v = porCli.get(h.c) ?? [0, 0];
      v[h.p === pA ? 0 : 1] += h.v;
      porCli.set(h.c, v);
    }
    const movs = [...porCli.entries()].map(([c, [a, b]]) => ({ c, delta: b - a }));
    const totA = [...porCli.values()].reduce((x, v) => x + v[0], 0);
    const totB = [...porCli.values()].reduce((x, v) => x + v[1], 0);
    const orden = [...movs].sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    const top = orden.slice(0, 10);
    const resto = orden.slice(10).reduce((x, m) => x + m.delta, 0);
    const pasos: PasoPuente[] = [
      { nombre: mes(pA), delta: totA, tipo: "ini" },
      ...top.sort((x, y) => y.delta - x.delta).map((m) => ({ nombre: m.c, delta: m.delta, tipo: "mov" as const })),
      ...(Math.abs(resto) > 0 ? [{ nombre: `Otros ${orden.length - 10 > 0 ? orden.length - 10 : ""}`.trim(), delta: resto, tipo: "mov" as const }] : []),
      { nombre: mes(pB), delta: totB, tipo: "fin" },
    ];
    // segmentos y etapas
    const segData = periodos.map((p) => {
      const o: Record<string, number | string> = { p };
      M.segmentos.forEach((s) => (o[s] = 0));
      return o;
    });
    const idx = new Map(periodos.map((p, i) => [p, i]));
    for (const h of hechos) {
      const i = idx.get(h.p);
      if (i == null) continue;
      const s = M.clientes.get(h.c)?.segmento ?? "SIN CLASIFICAR";
      segData[i][s] = (segData[i][s] as number) + h.v;
    }
    const etData = serie.map((s) => ({ p: s.p, ...s.etapas }));
    return { periodos, lista, serie, tot, acum, cierre, anio, pasos, totA, totB, pA, pB, segData, etData };
  }, [M, F, d.mesAnalisis, modoPuente]);

  if (!M || !r) return <Empty>Sin datos. Pulsa <b>Actualizar</b>.</Empty>;
  if (!r.serie.length) return <Empty>No hay datos para el rango seleccionado.</Empty>;

  const { serie, tot } = r;
  const cerrados = serie.filter((s) => !s.enCurso);
  const ult = cerrados[cerrados.length - 1];
  const pen = cerrados[cerrados.length - 2];
  const varMes = ult && pen && pen.venta > 0 ? ((ult.venta - pen.venta) / pen.venta) * 100 : null;
  const cumpl = tot.meta > 0 ? (tot.venta / tot.meta) * 100 : null;
  const margen = tot.venta > 0 ? (tot.util / tot.venta) * 100 : 0;
  const cierreCumpl = r.cierre?.meta ? ((r.cierre.proy ?? r.cierre.real ?? 0) / r.cierre.meta) * 100 : null;
  const abiertas = d.alertas.filter((a) => !["resuelta", "descartada"].includes(d.gestion[a.id]?.estado ?? "nueva"));
  const enRiesgo = abiertas.filter((a) => a.prioridad === 1);
  const actual = serie.find((s) => s.enCurso);
  const av = avanceMes(M.datos.hoy);

  return (
    <div>
      <Eyebrow>
        Indicadores · {mes(r.periodos[0])} a {mes(r.periodos[r.periodos.length - 1])}
      </Eyebrow>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-6">
        <Kpi k="Venta" v={clpCorto(tot.venta)} d={varMes != null ? <>Último mes cerrado <Variacion v={varMes} /></> : `${r.periodos.length} meses`}>
          <Sparkline valores={cerrados.map((s) => s.venta)} />
        </Kpi>
        <Kpi k="Utilidad" tono={margen >= 15 ? "ok" : margen >= 8 ? "warn" : "risk"} v={clpCorto(tot.util)} d={`Margen ${pct(margen)}`}>
          <Sparkline valores={cerrados.map((s) => (s.venta ? (s.util / s.venta) * 100 : 0))} color={COL.ok} />
        </Kpi>
        <Kpi k="Cumplimiento meta" tono={nivel(cumpl, d.umbrales.umbralOk, d.umbrales.umbralAlerta)} v={pct(cumpl)} d={tot.meta ? `${etiquetaFuenteMeta(serie[0].fuente)} ${clpCorto(tot.meta)}` : "Sin meta cargada"}>
          <div className="mt-2"><Gauge cumpl={cumpl} /></div>
        </Kpi>
        <Kpi k="Servicios" v={num(tot.serv)} d={`Ticket promedio ${clp(tot.serv ? tot.venta / tot.serv : 0)}`}>
          <Sparkline valores={cerrados.map((s) => s.serv)} color={COL.meta} />
        </Kpi>
        <Kpi k={`Proyección cierre ${r.anio}`} tono={nivel(cierreCumpl, d.umbrales.umbralOk, d.umbrales.umbralAlerta)} v={clpCorto(r.cierre?.proy ?? r.cierre?.real)} d={r.cierre?.meta ? `${pct(cierreCumpl, 0)} de la meta anual ${clpCorto(r.cierre.meta)}` : "Sin meta anual"} />
        <Link href="/alertas" className="block">
          <Kpi k="Venta en riesgo" tono="risk" v={clpCorto(enRiesgo.reduce((a, x) => a + x.impacto, 0))} d={<>{enRiesgo.length} urgentes · {abiertas.length} alertas abiertas →</>} />
        </Link>
      </div>

      {actual && (
        <div className="mt-3 rounded border border-line bg-surface px-4 py-2.5 text-[13px]">
          <b>{mes(actual.p)} en curso</b> ({av.transcurrido} de {av.total} días hábiles): {clp(actual.venta)} registrados
          {actual.meta > 0 && <> · {pct((actual.venta / actual.meta) * 100, 0)} de la meta del mes</>} · ritmo esperado a la fecha {pct(av.fraccion * 100, 0)}.
          <span className="text-muted"> Incluye servicios en proyección y en curso.</span>
        </div>
      )}

      <Eyebrow>Evolución contra meta</Eyebrow>
      <div className="grid gap-3.5 lg:grid-cols-[3fr_2fr]">
        <Card titulo="Venta contra meta por mes" sub={`Barras: venta (clara = mes en curso) y ${etiquetaFuenteMeta(serie[0].fuente).toLowerCase()}. Línea: % de cumplimiento.`}>
          <VentaMetaChart data={serie} />
        </Card>
        <Card titulo={`Acumulado ${r.anio} y proyección de cierre`} sub="La proyección usa el ritmo de los últimos 3 meses cerrados ajustado por estacionalidad.">
          <AcumuladoChart data={r.acum} />
        </Card>
      </div>

      <Eyebrow>¿Qué explica la variación?</Eyebrow>
      <Card
        titulo={`Puente de venta: ${mes(r.pA)} → ${mes(r.pB)}`}
        sub={`De ${clp(r.totA)} a ${clp(r.totB)} (${r.totA ? ((r.totB - r.totA) / r.totA * 100).toFixed(0) : "—"}%). Los 10 clientes que más movieron la aguja.`}
        accion={
          <div className="flex gap-1 text-xs">
            {(["mes", "anio"] as const).map((m) => (
              <button key={m} onClick={() => setModoPuente(m)} className={`cursor-pointer rounded border px-2.5 py-1 ${modoPuente === m ? "border-ink bg-ink text-white" : "border-line"}`}>
                {m === "mes" ? "vs mes anterior" : "vs mismo mes año anterior"}
              </button>
            ))}
          </div>
        }
      >
        <PuenteChart pasos={r.pasos} />
      </Card>

      <Eyebrow>Mapa de salud de clientes</Eyebrow>
      <Card titulo="Venta mensual de los principales clientes vs su comportamiento normal" sub="Cada celda compara la venta del mes con lo esperado para ese cliente según su propia historia y estacionalidad. Un rojo intenso no es una fluctuación normal.">
        <Heatmap analisis={d.analisis} />
      </Card>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <Card titulo="Venta por segmento" sub="Composición mensual de la venta.">
          <SegmentosChart data={r.segData} segmentos={M.segmentos} />
        </Card>
        <Card titulo="Servicios por mes y etapa" sub="Solo fletes, sin anulados ni extracostos.">
          <ApiladoChart
            eje="num"
            alto={300}
            data={r.etData}
            series={[
              { key: "finalizado", nombre: ETAPAS.finalizado, color: COL.ok },
              { key: "curso", nombre: ETAPAS.curso, color: COL.warn },
              { key: "proyeccion", nombre: ETAPAS.proyeccion, color: COL.meta },
              { key: "sinclasif", nombre: ETAPAS.sinclasif, color: "#B9C4C2" },
            ]}
          />
        </Card>
      </div>

      <Eyebrow className="flex items-center justify-between">
        <span>Alertas prioritarias · {mes(d.mesAnalisis)}</span>
        <Link href="/alertas" className="text-xs tracking-normal text-venta normal-case underline">Ver todas ({abiertas.length})</Link>
      </Eyebrow>
      {abiertas.length ? (
        <div className="grid gap-2.5">
          {abiertas.slice(0, 4).map((a) => <AlertaCard key={a.id} a={a} compacta />)}
        </div>
      ) : (
        <Empty>Sin alertas abiertas con los filtros actuales.</Empty>
      )}

      <Eyebrow>Detalle mensual</Eyebrow>
      <Tabla>
        <thead>
          <tr>
            <th>Período</th><th className="r">Venta</th><th className="r">Meta</th><th className="r">Cumpl.</th><th style={{ width: 170 }}>Avance</th><th className="r">Utilidad</th><th className="r">Margen</th><th className="r">Servicios</th><th className="r">Ticket</th><th className="r">Var. mes</th>
          </tr>
        </thead>
        <tbody>
          {serie.map((s, i) => {
            const prev = serie[i - 1];
            return (
              <tr key={s.p}>
                <td><b>{mes(s.p)}</b>{s.enCurso && <span className="ml-1 text-[11px] text-muted">(en curso)</span>}</td>
                <td className="r">{clp(s.venta)}</td>
                <td className="r">{s.meta ? clp(s.meta) : "—"}</td>
                <td className="r">{pct(s.cumpl)}</td>
                <td><Gauge cumpl={s.cumpl} /></td>
                <td className="r">{clp(s.util)}</td>
                <td className="r">{pct(s.venta ? (s.util / s.venta) * 100 : null)}</td>
                <td className="r">{num(s.serv)}</td>
                <td className="r">{s.serv ? clp(s.venta / s.serv) : "—"}</td>
                <td className="r"><Variacion v={prev && prev.venta > 0 ? ((s.venta - prev.venta) / prev.venta) * 100 : null} /></td>
              </tr>
            );
          })}
        </tbody>
      </Tabla>
    </div>
  );
}
