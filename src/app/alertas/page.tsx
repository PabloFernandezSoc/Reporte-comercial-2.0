"use client";
import { PageHeader } from "@/components/PageHeader";
import { Download } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertaCard, ESTADOS } from "@/components/AlertaCard";
import { useDatos, type EstadoAlerta } from "@/components/DataProvider";
import { Btn, Card, Empty, Eyebrow, Kpi, Pill, Tabla } from "@/components/ui";
import { TIPO_ALERTA, type TipoAlerta } from "@/lib/analytics";
import { clp, clpCorto, mes, pct } from "@/lib/format";
import { descargar } from "@/lib/storage";

const sel = "rounded border border-line bg-white px-2 py-1.5 text-[13px]";

export default function Alertas() {
  const d = useDatos();
  const [prio, setPrio] = useState<string>("");
  const [tipo, setTipo] = useState<string>("");
  const [estado, setEstado] = useState<string>("abiertas");

  const est = (id: string): EstadoAlerta => d.gestion[id]?.estado ?? "nueva";
  const lista = useMemo(
    () =>
      d.alertas.filter((a) => {
        if (prio && String(a.prioridad) !== prio) return false;
        if (tipo && a.tipo !== tipo) return false;
        const e = est(a.id);
        if (estado === "abiertas" && (e === "resuelta" || e === "descartada")) return false;
        if (estado && estado !== "abiertas" && e !== estado) return false;
        return true;
      }),
    [d.alertas, prio, tipo, estado, d.gestion], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // caídas vs mes anterior que el sistema considera fluctuación normal (no generan alerta)
  const normales = useMemo(
    () =>
      d.analisis
        .map((a) => {
          const pts = a.venta.puntos;
          const u = pts[pts.length - 1];
          const p = pts[pts.length - 2];
          return { a, u, varMes: p && p.real > 0 ? ((u.real - p.real) / p.real) * 100 : null };
        })
        .filter((x) => x.varMes != null && x.varMes <= -20 && (x.a.dVenta.diag === "normal" || x.a.dVenta.diag === "bajo-vigilancia") && x.u.real > 0)
        .sort((x, y) => (x.varMes ?? 0) - (y.varMes ?? 0)),
    [d.analisis],
  );

  const abiertas = d.alertas.filter((a) => !["resuelta", "descartada"].includes(est(a.id)));
  const gestionadas = d.alertas.filter((a) => est(a.id) !== "nueva").length;
  const porTipo = Object.keys(TIPO_ALERTA).map((t) => ({ t: t as TipoAlerta, n: abiertas.filter((a) => a.tipo === t).length, v: abiertas.filter((a) => a.tipo === t).reduce((x, a) => x + a.impacto, 0) })).filter((x) => x.n);

  const exportar = () => {
    const filas = [["Prioridad", "Tipo", "Cliente", "Segmento", "Ejecutiva", "Mes", "Impacto", "Confianza", "Diagnóstico", "Acción", "Estado"]];
    lista.forEach((a) => filas.push([String(a.prioridad), TIPO_ALERTA[a.tipo].label, a.cliente, a.segmento, a.ejecutiva, a.periodo, String(Math.round(a.impacto)), a.confianza != null ? (a.confianza * 100).toFixed(0) + "%" : "", a.diag, a.accion, ESTADOS[est(a.id)]]));
    descargar(`alertas-${d.mesAnalisis}.csv`, "﻿" + filas.map((f) => f.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
  };

  return (
    <div>
      <PageHeader titulo="Centro de alertas" sub={<>Clientes que salieron de su comportamiento normal en {mes(d.mesAnalisis)}, priorizados por impacto.</>} />
      <div className="grid gap-3.5 md:grid-cols-4">
        <Kpi k="Venta en riesgo" tono="risk" v={clpCorto(abiertas.filter((a) => a.prioridad === 1).reduce((x, a) => x + a.impacto, 0))} d={`${abiertas.filter((a) => a.prioridad === 1).length} alertas urgentes abiertas`} />
        <Kpi k="Alertas abiertas" tono="warn" v={abiertas.length} d={`${d.alertas.length} detectadas en el mes`} />
        <Kpi k="Gestionadas" tono="ok" v={pct(d.alertas.length ? (gestionadas / d.alertas.length) * 100 : 0, 0)} d={`${gestionadas} con al menos una gestión`} />
        <Kpi k="Fluctuaciones descartadas" tono="n" v={normales.length} d="Caídas >20% vs mes anterior que son normales para el cliente" />
      </div>

      <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1fr_2fr]">
        <Card titulo="Cómo se detectan" sub="Las alertas comparan cada cliente consigo mismo.">
          <ul className="list-disc space-y-1.5 pl-5 text-[12.5px] text-ink-2">
            <li><b>Esperado</b>: mediana de sus últimos 6 meses ajustada por estacionalidad (de la empresa y del propio cliente).</li>
            <li><b>Rango normal</b>: su variación habitual medida en su historia. Un cliente volátil necesita una caída mayor para alertar.</li>
            <li><b>Caída anómala</b>: sale del rango (z ≤ {d.umbrales.zAlerta}), cae ≥ {d.umbrales.caidaMinPct}% y la brecha supera {clpCorto(d.umbrales.brechaMinClp)}.</li>
            <li><b>Tendencia</b>: varios meses bajo lo normal o nivel de 3 meses claramente bajo los 9 anteriores.</li>
            <li><b>Fuga</b>: sin venta en un cliente que casi nunca tiene meses en cero.</li>
          </ul>
          <Link href="/config" className="mt-2 inline-block text-xs text-venta underline">Ajustar umbrales</Link>
        </Card>
        <Card titulo="Alertas abiertas por tipo">
          <div className="grid gap-2 sm:grid-cols-2">
            {porTipo.length ? porTipo.map((x) => (
              <button key={x.t} onClick={() => setTipo(tipo === x.t ? "" : x.t)} className={`flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-left ${tipo === x.t ? "border-ink" : "border-line"}`}>
                <span><Pill tono={TIPO_ALERTA[x.t].tono}>{TIPO_ALERTA[x.t].label}</Pill> <span className="num ml-1 text-sm font-semibold">{x.n}</span></span>
                <span className="num text-[12.5px] text-muted">{clpCorto(x.v)}</span>
              </button>
            )) : <span className="text-sm text-muted">Sin alertas abiertas.</span>}
          </div>
        </Card>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-[10px] font-semibold tracking-widest text-muted uppercase">Prioridad
          <select className={sel} value={prio} onChange={(e) => setPrio(e.target.value)}>
            <option value="">Todas</option><option value="1">Urgente</option><option value="2">Importante</option><option value="3">Seguimiento / oportunidad</option>
          </select>
        </label>
        <label className="flex flex-col text-[10px] font-semibold tracking-widest text-muted uppercase">Tipo
          <select className={sel} value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TIPO_ALERTA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-[10px] font-semibold tracking-widest text-muted uppercase">Estado
          <select className={sel} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="abiertas">Abiertas</option><option value="">Todas</option>
            {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Btn peque onClick={exportar} className="ml-auto"><Download size={14} aria-hidden /> Exportar CSV</Btn>
      </div>

      {[1, 2, 3].map((p) => {
        const arr = lista.filter((a) => a.prioridad === p);
        if (!arr.length) return null;
        return (
          <div key={p}>
            <Eyebrow>{p === 1 ? "Urgente · retener" : p === 2 ? "Importante · tendencia, metas y margen" : "Seguimiento y oportunidades"} ({arr.length})</Eyebrow>
            <div className="grid gap-2.5">{arr.map((a) => <AlertaCard key={a.id} a={a} />)}</div>
          </div>
        );
      })}
      {!lista.length && <Empty>No hay alertas con estos filtros.</Empty>}

      {normales.length > 0 && (
        <>
          <Eyebrow>Caídas descartadas como fluctuación normal</Eyebrow>
          <p className="mb-2 text-[12.5px] text-muted">Estos clientes bajaron más de 20% contra el mes anterior, pero la baja está dentro de su variación habitual. No requieren salir a vender por ahora.</p>
          <Tabla>
            <thead><tr><th>Cliente</th><th className="r">Venta mes</th><th className="r">Esperado</th><th className="r">Var. vs mes ant.</th><th className="r">Variación habitual</th><th>Lectura</th></tr></thead>
            <tbody>
              {normales.map(({ a, u, varMes }) => (
                <tr key={a.nombre}>
                  <td><Link className="font-semibold hover:text-venta hover:underline" href={`/clientes/${encodeURIComponent(a.nombre)}`}>{a.nombre}</Link></td>
                  <td className="r">{clp(u.real)}</td>
                  <td className="r">{clp(u.esperado)}</td>
                  <td className="r text-risk">{varMes?.toFixed(0)}%</td>
                  <td className="r">±{pct(a.venta.variacionTipica, 0)}</td>
                  <td className="text-[12px] text-muted">{a.dVenta.diag === "bajo-vigilancia" ? "En el borde: vigilar el próximo mes" : "Dentro de su rango normal"}</td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </>
      )}
    </div>
  );
}
