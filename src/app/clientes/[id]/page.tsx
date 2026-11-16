"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AlertaCard } from "@/components/AlertaCard";
import { ApiladoChart, BandaChart, COL, ServTicketChart, YoYChart } from "@/components/charts";
import { useDatos } from "@/components/DataProvider";
import { Card, Empty, Eyebrow, Gauge, Kpi, nivel, Pill, PillSeg, Tabla } from "@/components/ui";
import { puntosBanda } from "@/components/util";
import { DIAG_INFO } from "@/lib/anomaly";
import { clp, clpCorto, MESES, mes, num, pct } from "@/lib/format";
import { ETAPAS, type Etapa } from "@/lib/types";

const PALETA = ["#0E7C86", "#175E9E", "#2E7D4F", "#B5820F", "#7A4BA8", "#9AA8AC"];

export default function Cliente() {
  const { id } = useParams<{ id: string }>();
  const nombre = decodeURIComponent(id);
  const d = useDatos();
  const M = d.modelo;
  const an = d.analisis.find((a) => a.nombre === nombre);

  const r = useMemo(() => {
    if (!M) return null;
    const hs = M.datos.hechos.filter((h) => h.c === nombre);
    if (!hs.length) return null;
    const periodos = M.periodos;
    // mandantes por mes (top 5 + otros)
    const totM = new Map<string, number>();
    hs.forEach((h) => totM.set(h.m || "(sin mandante)", (totM.get(h.m || "(sin mandante)") || 0) + h.v));
    const top = [...totM.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map((x) => x[0]);
    const ult = periodos.filter((p) => p <= M.mesActual).slice(-18);
    const mand = ult.map((p) => {
      const o: Record<string, number | string> = { p };
      [...top, "Otros"].forEach((k) => (o[k] = 0));
      return o;
    });
    const ix = new Map(ult.map((p, i) => [p, i]));
    const serv = ult.map((p) => ({ p, serv: 0, venta: 0 }));
    const et = ult.map((p) => ({ p, proyeccion: 0, curso: 0, finalizado: 0, sinclasif: 0 } as Record<string, number | string>));
    let venta = 0, util = 0, nserv = 0;
    for (const h of hs) {
      const i = ix.get(h.p);
      if (i != null) {
        const k = top.includes(h.m || "(sin mandante)") ? h.m || "(sin mandante)" : "Otros";
        mand[i][k] = (mand[i][k] as number) + h.v;
        serv[i].serv += h.s;
        serv[i].venta += h.v;
        et[i][h.e] = (et[i][h.e] as number) + h.s;
      }
      if (h.p >= ult[Math.max(0, ult.length - 13)] && h.p <= M.mesCerrado) { venta += h.v; util += h.u; nserv += h.s; }
    }
    // año contra año
    const anios = [...new Set(hs.map((h) => h.p.slice(0, 4)))].sort().slice(-2);
    const yoy = MESES.map((m, i) => {
      const o: Record<string, number | string | null> = { mes: m };
      anios.forEach((a) => {
        const p = `${a}-${String(i + 1).padStart(2, "0")}`;
        o[a] = p > M.mesActual ? null : hs.filter((h) => h.p === p).reduce((x, h) => x + h.v, 0);
      });
      return o;
    });
    const actual = hs.filter((h) => h.p === M.mesActual).reduce((x, h) => x + h.v, 0);
    return { top, mand, serv: serv.map((s) => ({ p: s.p, serv: s.serv, ticket: s.serv ? s.venta / s.serv : null })), et, anios, yoy, venta, util, nserv, actual };
  }, [M, nombre]);

  if (!M) return <Empty>Sin datos.</Empty>;
  if (!r || !an) return <Empty>No hay datos de <b>{nombre}</b> con los filtros actuales. <Link className="text-venta underline" href="/clientes">Volver a clientes</Link></Empty>;

  const info = an.info;
  const dg = an.dVenta;
  const di = DIAG_INFO[dg.diag];
  const sc = info.scorecard;
  const anio = d.mesAnalisis.slice(0, 4);
  const ytd = M.periodos.filter((p) => p.startsWith(anio) && p <= d.mesAnalisis);
  const metaYtd = sc ? ytd.reduce((x, p) => x + (+sc.m[p] || 0), 0) : 0;
  const realYtd = ytd.reduce((x, p) => x + (an.venta.puntos.find((q) => q.p === p)?.real || 0), 0);
  const cumplYtd = metaYtd > 0 ? (realYtd / metaYtd) * 100 : null;
  const alertas = d.alertas.filter((a) => a.cliente === nombre);
  const contacto = d.contactos.clientes[nombre] ?? {};
  const setContacto = (c: { correo?: string; contacto?: string }) => d.setContactos({ ...d.contactos, clientes: { ...d.contactos.clientes, [nombre]: { ...contacto, ...c } } });

  return (
    <div>
      <div className="mb-1 text-xs"><Link href="/clientes" className="text-venta underline">← Clientes</Link></div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[30px] leading-tight font-bold tracking-wide">{nombre}</h1>
        <PillSeg s={info.segmento} />
        <Pill tono={di.tono}>{di.label}</Pill>
      </div>
      <p className="text-[12.5px] text-muted">
        {info.ejecutiva ? `Ejecutiva ${info.ejecutiva}` : "Sin ejecutiva"} · {sc ? `Scorecard: ${sc.c}` : "sin meta en el scorecard"}
        {an.ultimaFecha && ` · último servicio ${an.ultimaFecha} (hace ${an.diasSinServicio} días)`}
      </p>

      <div className="mt-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-5">
        <Kpi k={`Venta ${mes(d.mesAnalisis)}`} tono={di.tono === "risk" ? "risk" : di.tono === "warn" ? "warn" : "venta"} v={clpCorto(dg.real)} d={dg.esperado ? <>Esperado {clpCorto(dg.esperado)} ({dg.real >= dg.esperado ? "+" : ""}{(((dg.real - dg.esperado) / dg.esperado) * 100).toFixed(0)}%)</> : "Sin historia suficiente"} />
        <Kpi k="Variación habitual" tono="n" v={`±${pct(an.venta.variacionTipica, 0)}`} d={`Rango normal mes a mes · ${an.venta.mesesActivos} meses con venta`} />
        <Kpi k={`Cumplimiento ${anio}`} tono={nivel(cumplYtd, d.umbrales.umbralOk, d.umbrales.umbralAlerta)} v={pct(cumplYtd, 0)} d={metaYtd ? `${clpCorto(realYtd)} de ${clpCorto(metaYtd)}` : "Sin meta"}>
          <div className="mt-2"><Gauge cumpl={cumplYtd} /></div>
        </Kpi>
        <Kpi k="Últimos 12 meses" v={clpCorto(r.venta)} d={`Margen ${pct(r.venta ? (r.util / r.venta) * 100 : null)} · ${num(r.nserv)} servicios`} />
        <Kpi k={`${mes(M.mesActual)} en curso`} tono="n" v={clpCorto(r.actual)} d={sc?.m[M.mesActual] ? `Meta del mes ${clpCorto(+sc.m[M.mesActual])}` : "Registrado a la fecha"} />
      </div>

      <div className={`mt-3.5 rounded border border-l-[3px] border-line bg-surface px-4 py-3 text-[13px] ${di.tono === "risk" ? "border-l-risk" : di.tono === "warn" ? "border-l-warn" : "border-l-venta"}`}>
        <b>Lectura del sistema: </b>
        {dg.diag === "normal" && `La venta de ${mes(d.mesAnalisis)} está dentro de su comportamiento habitual (z ${dg.z?.toFixed(1)}). Las variaciones de hasta ±${pct(an.venta.variacionTipica, 0)} son normales para este cliente.`}
        {dg.diag === "bajo-vigilancia" && `La venta quedó en el borde inferior de su rango normal (z ${dg.z?.toFixed(1)}). Todavía puede ser fluctuación; si se repite el próximo mes pasa a tendencia.`}
        {dg.diag === "caida-significativa" && `Caída fuera de su rango normal (z ${dg.z?.toFixed(1)}, ${pct(dg.confianza * 100, 0)} de probabilidad de que no sea fluctuación). Requiere gestión comercial.`}
        {dg.diag === "tendencia-baja" && `Pérdida gradual: su nivel reciente está claramente bajo el de los meses anteriores (${dg.rachaBaja} meses). Requiere revisión de cuenta.`}
        {dg.diag === "fuga" && "Sin venta en un cliente que casi nunca tiene meses en cero. Posible fuga: contactar de inmediato."}
        {dg.diag === "alza" && "Venta sobre su rango normal: oportunidad para asegurar el volumen."}
        {dg.diag === "nuevo" && "Cliente nuevo: asegurar la segunda compra."}
        {dg.diag === "sin-historia" && "Historia insuficiente para estimar su comportamiento normal (se necesitan al menos 4 meses con venta)."}
      </div>

      <Eyebrow>Venta real contra su comportamiento normal</Eyebrow>
      <Card titulo="Historia mensual con banda de normalidad" sub="Banda sombreada: rango en que se mueve normalmente (90%). Línea punteada: esperado según su nivel reciente y estacionalidad. Rojo: fuera de lo normal. Línea roja: meta.">
        <BandaChart data={puntosBanda(an, sc, 24, M.mesActual > d.mesAnalisis ? { p: M.mesActual, real: r.actual } : undefined)} alto={340} />
      </Card>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-2">
        <Card titulo={`Año contra año${r.anios.length > 1 ? ` · ${r.anios.join(" vs ")}` : ""}`} sub="Mismo mes en años distintos: separa estacionalidad de pérdida real.">
          <YoYChart data={r.yoy} anios={r.anios} />
        </Card>
        <Card titulo="Servicios y ticket promedio" sub="¿La baja es por menos servicios o por menor tarifa?">
          <ServTicketChart data={r.serv} />
        </Card>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[3fr_2fr]">
        <Card titulo="Venta por mandante" sub="Top 5 mandantes por venta, últimos 18 meses.">
          <ApiladoChart data={r.mand} series={[...r.top, "Otros"].map((k, i) => ({ key: k, nombre: k, color: PALETA[i] }))} alto={280} />
        </Card>
        <Card titulo={`Mandantes en ${mes(d.mesAnalisis)} vs su normal`} sub="Normal = mediana de los 6 meses previos.">
          <Tabla alto={280}>
            <thead><tr><th>Mandante</th><th className="r">Normal</th><th className="r">Real</th><th className="r">Δ</th></tr></thead>
            <tbody>
              {an.mandantes.slice(0, 15).map((m) => (
                <tr key={m.nombre}>
                  <td className="max-w-[180px] truncate">{m.nombre}</td>
                  <td className="r">{clpCorto(m.esperado)}</td>
                  <td className="r">{clpCorto(m.real)}</td>
                  <td className={`r ${m.delta < 0 ? "text-risk" : "text-ok"}`}>{m.delta >= 0 ? "+" : ""}{clpCorto(m.delta)}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </Card>
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[3fr_2fr]">
        <Card titulo="Servicios por etapa">
          <ApiladoChart eje="num" data={r.et} alto={240} series={(["finalizado", "curso", "proyeccion", "sinclasif"] as Etapa[]).map((k) => ({ key: k, nombre: ETAPAS[k], color: { finalizado: COL.ok, curso: COL.warn, proyeccion: COL.meta, sinclasif: "#B9C4C2" }[k] }))} />
        </Card>
        <Card titulo="Contacto del cliente" sub="Se usa para prellenar los correos de seguimiento. Se guarda en este navegador.">
          <label className="block text-[11px] font-semibold tracking-wider text-muted uppercase">Nombre de contacto
            <input className="mt-0.5 w-full rounded border border-line px-2.5 py-1.5 text-[13px] font-normal tracking-normal normal-case text-ink" value={contacto.contacto ?? ""} onChange={(e) => setContacto({ contacto: e.target.value })} />
          </label>
          <label className="mt-3 block text-[11px] font-semibold tracking-wider text-muted uppercase">Correo
            <input type="email" className="mt-0.5 w-full rounded border border-line px-2.5 py-1.5 text-[13px] font-normal tracking-normal normal-case text-ink" value={contacto.correo ?? ""} onChange={(e) => setContacto({ correo: e.target.value })} />
          </label>
          <p className="mt-3 text-[12px] text-muted">Meta {anio}: {sc ? clp(Object.entries(sc.m).filter(([p]) => p.startsWith(anio)).reduce((x, [, v]) => x + +v, 0)) : "sin meta"}</p>
        </Card>
      </div>

      <Eyebrow>Alertas de este cliente</Eyebrow>
      {alertas.length ? <div className="grid gap-2.5">{alertas.map((a) => <AlertaCard key={a.id} a={a} />)}</div> : <Empty>Sin alertas en {mes(d.mesAnalisis)}.</Empty>}
    </div>
  );
}
