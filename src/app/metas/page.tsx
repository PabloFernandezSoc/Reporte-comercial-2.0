"use client";
import { PageHeader } from "@/components/PageHeader";
import { Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useDatos } from "@/components/DataProvider";
import { Aviso, Btn, Card, Empty, Eyebrow, PillSeg, Tabla } from "@/components/ui";
import { clp, mes, rangoPeriodos } from "@/lib/format";
import { descargar } from "@/lib/storage";
import type { Metas } from "@/lib/types";

const SEGS = ["FFWW", "CD", "CAPEX", "CHURN"];

export default function MetasPage() {
  const d = useDatos();
  const [anio, setAnio] = useState(() => (d.modelo?.mesActual ?? "2026").slice(0, 4));
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const meses = rangoPeriodos(`${anio}-01`, `${anio}-12`);
  const metas = d.metas;

  const editar = (fn: (m: Metas) => void) => {
    if (!metas) return;
    const copia: Metas = JSON.parse(JSON.stringify(metas));
    fn(copia);
    d.setMetas(copia);
  };

  const clientesApiSinMeta = useMemo(() => {
    if (!d.modelo) return [];
    const venta = new Map<string, number>();
    d.modelo.datos.hechos.forEach((h) => h.p.startsWith(anio) && venta.set(h.c, (venta.get(h.c) || 0) + h.v));
    return [...d.modelo.clientes.values()].filter((c) => !c.scorecard).map((c) => ({ ...c, venta: venta.get(c.nombre) || 0 })).filter((c) => c.venta > 0).sort((a, b) => b.venta - a.venta);
  }, [d.modelo, anio]);

  const importar = async (f: File) => {
    try {
      const j = JSON.parse(await f.text()) as Metas;
      if (!j.clientes || !Array.isArray(j.clientes)) throw new Error("El archivo no tiene la lista 'clientes'.");
      j.general ||= {};
      j.seg ||= {};
      d.setMetas(j);
      setMsg(`Metas importadas: ${j.clientes.length} clientes.`);
    } catch (e) {
      setMsg(`No se pudo importar: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (!metas)
    return (
      <div>
        <Empty>No hay metas cargadas. Importa un archivo JSON con el formato del Growth Scorecard.</Empty>
        <div className="mt-3"><Btn primario onClick={() => file.current?.click()}>Importar metas (JSON)</Btn></div>
        <input ref={file} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
      </div>
    );

  const filas = metas.clientes.map((c, i) => ({ c, i })).filter(({ c }) => (!seg || c.s === seg) && (!q || c.c.toUpperCase().includes(q.toUpperCase())));
  const totCli = meses.map((p) => metas.clientes.reduce((a, c) => a + (+c.m[p] || 0), 0));
  const inp = "num w-24 rounded border border-line px-1.5 py-1 text-right text-[12px] focus:outline-2 focus:outline-venta";
  const val = (s: string) => {
    const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
    return isFinite(n) ? n : 0;
  };

  return (
    <div>
      <PageHeader titulo={`Metas ${anio}`} sub={<>Plan de ventas, Growth Scorecard{metas.q4 ? <> y propuesta Q4 (<b>{metas.q4.archivo}</b>)</> : null}.</>} />
      <Aviso>
        Origen: <b>{d.metasLocales ? "editadas en este navegador" : d.datos?.metasFuente === "privado" ? "archivo privado del servidor" : d.datos?.metasFuente === "demo" ? "metas DEMO" : "—"}</b>.
        Los cambios se guardan en este navegador. Exporta el JSON para respaldar o compartir.
      </Aviso>
      {msg && <Aviso tono="warn">{msg}</Aviso>}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="rounded border border-line px-2 py-1.5 text-[13px]" value={anio} onChange={(e) => setAnio(e.target.value)}>
          {["2025", "2026", "2027"].map((a) => <option key={a}>{a}</option>)}
        </select>
        <input className="rounded border border-line px-2 py-1.5 text-[13px]" placeholder="Buscar cliente…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded border border-line px-2 py-1.5 text-[13px]" value={seg} onChange={(e) => setSeg(e.target.value)}>
          <option value="">Todos los segmentos</option>{SEGS.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <Btn peque onClick={() => editar((m) => m.clientes.push({ c: "NUEVO CLIENTE", s: seg || "FFWW", m: {} }))}>+ Cliente</Btn>
          <Btn peque onClick={() => file.current?.click()}>Importar JSON</Btn>
          <Btn peque onClick={() => descargar(`metas-${anio}.json`, JSON.stringify(metas, null, 1), "application/json")}>Exportar JSON</Btn>
          {d.metasLocales && <Btn peque onClick={() => { if (confirm("¿Descartar las metas editadas en este navegador y volver a las del servidor?")) d.setMetas(null); }}>Restaurar servidor</Btn>}
        </div>
        <input ref={file} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && importar(e.target.files[0])} />
      </div>

      <Card titulo="Plan general y por segmento" sub="Si hay plan general, el resumen lo usa como meta de la empresa; con filtro de segmento usa la meta del segmento.">
        <Tabla>
          <thead><tr><th>Nivel</th>{meses.map((p) => <th key={p} className="r">{mes(p)}</th>)}<th className="r">Total</th></tr></thead>
          <tbody>
            {[{ k: "general", n: "General", o: metas.general }, ...SEGS.map((s) => ({ k: s, n: s, o: metas.seg[s] ?? {} }))].map((f) => (
              <tr key={f.k}>
                <td><b>{f.n}</b></td>
                {meses.map((p) => (
                  <td key={p} className="r">
                    <input className={inp} defaultValue={f.o[p] ? Math.round(f.o[p]).toLocaleString("es-CL") : ""} onBlur={(e) => editar((m) => { const t = f.k === "general" ? m.general : (m.seg[f.k] ||= {}); const v = val(e.target.value); if (v) t[p] = v; else delete t[p]; })} />
                  </td>
                ))}
                <td className="r">{clp(meses.reduce((a, p) => a + (+f.o[p] || 0), 0))}</td>
              </tr>
            ))}
            <tr><td className="text-muted">Suma clientes</td>{totCli.map((v, i) => <td key={i} className="r text-muted">{clp(v)}</td>)}<td className="r text-muted">{clp(totCli.reduce((a, b) => a + b, 0))}</td></tr>
          </tbody>
        </Tabla>
      </Card>

      <Eyebrow>Metas por cliente ({filas.length})</Eyebrow>
      <Tabla alto={620}>
        <thead><tr><th>Cliente (scorecard)</th><th>Segmento</th>{meses.map((p) => <th key={p} className="r">{mes(p)}</th>)}<th className="r">Total</th><th /></tr></thead>
        <tbody>
          {filas.map(({ c, i }) => (
            <tr key={`${i}-${c.c}`}>
              <td><input className="w-56 rounded border border-line px-1.5 py-1 text-[12px]" defaultValue={c.c} onBlur={(e) => e.target.value !== c.c && editar((m) => (m.clientes[i].c = e.target.value.trim()))} /></td>
              <td>
                <select className="rounded border border-line px-1 py-1 text-[12px]" value={c.s} onChange={(e) => editar((m) => (m.clientes[i].s = e.target.value))}>
                  {SEGS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </td>
              {meses.map((p) => (
                <td key={p} className="r">
                  <input className={inp} defaultValue={c.m[p] ? Math.round(c.m[p]).toLocaleString("es-CL") : ""} onBlur={(e) => { const v = val(e.target.value); if (v !== (+c.m[p] || 0)) editar((m) => { if (v) m.clientes[i].m[p] = v; else delete m.clientes[i].m[p]; }); }} />
                </td>
              ))}
              <td className="r">{clp(meses.reduce((a, p) => a + (+c.m[p] || 0), 0))}</td>
              <td><button className="cursor-pointer text-xs text-risk" title="Eliminar" aria-label={`Eliminar ${c.c}`} onClick={() => confirm(`¿Eliminar ${c.c}?`) && editar((m) => m.clientes.splice(i, 1))}><Trash2 size={14} aria-hidden /></button></td>
            </tr>
          ))}
        </tbody>
      </Tabla>

      <Eyebrow>Cruce de nombres: clientes del ERP sin meta ({clientesApiSinMeta.length})</Eyebrow>
      <p className="mb-2 text-[12.5px] text-muted">Si un cliente del ERP corresponde a una fila del scorecard con otro nombre, asígnalo aquí.</p>
      {clientesApiSinMeta.length ? (
        <Tabla alto={420}>
          <thead><tr><th>Cliente en el ERP</th><th className="r">Venta {anio}</th><th>Asignar a</th></tr></thead>
          <tbody>
            {clientesApiSinMeta.map((c) => (
              <tr key={c.nombre}>
                <td>{c.nombre} <PillSeg s={c.segmento} /></td>
                <td className="r">{clp(c.venta)}</td>
                <td>
                  <select className="max-w-[320px] rounded border border-line px-1 py-1 text-[12px]" value={d.alias[c.nombre] ?? ""} onChange={(e) => d.setAlias({ ...d.alias, [c.nombre]: e.target.value })}>
                    <option value="">— sin meta —</option>
                    {metas.clientes.map((m, i) => <option key={i} value={m.c}>{m.c} ({m.s})</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      ) : <Empty>Todos los clientes con venta calzan con el scorecard.</Empty>}
    </div>
  );
}
