"use client";
import clsx from "clsx";
import Link from "next/link";
import { useState } from "react";
import { TIPO_ALERTA, type Alerta } from "@/lib/analytics";
import { clp, mes, pct } from "@/lib/format";
import { descargar } from "@/lib/storage";
import { BandaChart } from "./charts";
import { useDatos, type EstadoAlerta } from "./DataProvider";
import { EmailDialog } from "./EmailDialog";
import { Btn, Pill, PillSeg } from "./ui";
import { puntosBanda } from "./util";

export const ESTADOS: Record<EstadoAlerta, string> = {
  nueva: "Nueva",
  gestion: "En gestión",
  resuelta: "Resuelta",
  descartada: "Descartada",
};

const BORDE = { 1: "border-l-risk", 2: "border-l-warn", 3: "border-l-meta" } as const;

export function AlertaCard({ a, compacta = false }: { a: Alerta; compacta?: boolean }) {
  const d = useDatos();
  const [abierta, setAbierta] = useState(false);
  const [correo, setCorreo] = useState(false);
  const [nota, setNota] = useState("");
  const g = d.gestion[a.id];
  const estado = g?.estado ?? "nueva";
  const info = TIPO_ALERTA[a.tipo];
  const an = d.analisis.find((x) => x.nombre === a.cliente);

  const recordatorio = () => {
    const f = new Date();
    f.setDate(f.getDate() + (f.getDay() === 5 ? 3 : f.getDay() === 6 ? 2 : 1));
    const ymd = `${f.getFullYear()}${String(f.getMonth() + 1).padStart(2, "0")}${String(f.getDate()).padStart(2, "0")}`;
    const esc = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LYD//Estrategia comercial//ES", "BEGIN:VEVENT",
      `UID:${encodeURIComponent(a.id)}@lyd`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART:${ymd}T090000`, `DTEND:${ymd}T093000`,
      `SUMMARY:${esc(`Gestionar ${a.cliente}: ${info.label}`)}`,
      `DESCRIPTION:${esc(`${a.diag}\n\nAcción sugerida: ${a.accion}`)}`,
      "BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", "DESCRIPTION:Recordatorio", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    descargar(`recordatorio-${a.cliente.replace(/\W+/g, "-").toLowerCase()}.ics`, ics, "text/calendar");
    d.gestionar(a.id, { estado: estado === "nueva" ? "gestion" : estado }, "Recordatorio agendado en calendario");
  };

  return (
    <article className={clsx("rounded border border-l-[3px] border-line bg-surface px-4 py-3", BORDE[a.prioridad], ["resuelta", "descartada"].includes(estado) && "opacity-60")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/clientes/${encodeURIComponent(a.cliente)}`} className="text-[14.5px] font-semibold hover:text-venta hover:underline">{a.cliente}</Link>
          <PillSeg s={a.segmento} />
          {a.ejecutiva && <span className="text-[11.5px] text-muted">{a.ejecutiva}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Pill tono={info.tono}>{info.label}</Pill>
          <span className="num text-[13px] font-semibold">{clp(a.impacto)}</span>
        </div>
      </div>
      <div className="mt-1 text-[13px] font-medium">{a.titulo}</div>
      <p className="mt-0.5 text-[12.5px] text-muted">{a.diag}</p>
      {a.confianza != null && a.confianza > 0 && (
        <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-muted">
          <span>Probabilidad de que no sea fluctuación normal</span>
          <div className="h-1.5 w-28 rounded bg-line-2"><div className="h-full rounded bg-risk" style={{ width: `${a.confianza * 100}%` }} /></div>
          <b className="num text-ink">{a.confianza >= 0.99 ? "≥99%" : pct(a.confianza * 100, 0)}</b>
        </div>
      )}
      {!compacta && (
        <div className="mt-2 text-[13px]">
          <b className="block font-display text-[11px] tracking-[.08em] text-ink-2 uppercase">Acción sugerida</b>
          {a.accion}
        </div>
      )}

      {abierta && (
        <div className="mt-3 grid gap-3 border-t border-line-2 pt-3 lg:grid-cols-[3fr_2fr]">
          <div>
            {an && <BandaChart data={puntosBanda(an, d.metas ? an.info.scorecard : null, 14)} alto={220} compacto />}
            {a.evidencia.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-[12.5px] text-ink-2">
                {a.evidencia.map((e) => <li key={e}>{e}</li>)}
              </ul>
            )}
          </div>
          <div>
            <b className="block font-display text-[11px] tracking-[.08em] text-ink-2 uppercase">Bitácora</b>
            {g?.historial?.length ? (
              <ul className="mt-1 max-h-40 space-y-1 overflow-auto text-[12px]">
                {[...g.historial].reverse().map((h, i) => (
                  <li key={i}><span className="num text-muted">{new Date(h.t).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}</span> · {h.txt}</li>
                ))}
              </ul>
            ) : <p className="text-[12px] text-muted">Sin gestiones registradas.</p>}
            <div className="mt-2 flex gap-1.5">
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Registrar gestión (ej. llamé, cliente dice…)" className="flex-1 rounded border border-line px-2 py-1 text-[12.5px]" />
              <Btn peque onClick={() => { if (nota.trim()) { d.gestionar(a.id, { estado: estado === "nueva" ? "gestion" : estado }, nota.trim()); setNota(""); } }}>Guardar</Btn>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={estado}
          onChange={(e) => d.gestionar(a.id, { estado: e.target.value as EstadoAlerta }, `Estado → ${ESTADOS[e.target.value as EstadoAlerta]}`)}
          className="rounded border border-line bg-white px-2 py-1 text-xs"
          aria-label="Estado de la alerta"
        >
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Btn peque primario onClick={() => setCorreo(true)}>✉ Enviar correo</Btn>
        <Btn peque onClick={recordatorio} title="Descarga un evento .ics para Outlook / Google Calendar">📅 Recordatorio</Btn>
        <Btn peque onClick={() => setAbierta(!abierta)}>{abierta ? "Ocultar detalle" : "Ver detalle y bitácora"}</Btn>
        <span className="ml-auto text-[11px] text-muted">{mes(a.periodo)}</span>
      </div>
      {correo && <EmailDialog alerta={a} onClose={() => setCorreo(false)} />}
    </article>
  );
}
