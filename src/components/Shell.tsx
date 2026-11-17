"use client";
import { RefreshCw } from "lucide-react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { mes } from "@/lib/format";
import { ETAPAS, type Etapa } from "@/lib/types";
import { useDatos } from "./DataProvider";
import { Aviso } from "./ui";

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/alertas", label: "Alertas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/cartera", label: "Cartera" },
  { href: "/metas", label: "Metas" },
  { href: "/config", label: "Configuración" },
];

const sel = "rounded border border-line bg-white px-2 py-1.5 text-[13px] text-ink focus:outline-2 focus:outline-venta";

export function Shell({ children }: { children: ReactNode }) {
  const d = useDatos();
  const path = usePathname();
  const { modelo, filtros: F } = d;
  const urgentes = d.alertas.filter((a) => a.prioridad === 1 && !["resuelta", "descartada"].includes(d.gestion[a.id]?.estado ?? "nueva")).length;
  const periodos = modelo?.periodos ?? [];

  return (
    <>
      <header className="sticky top-0 z-40 border-b-[3px] border-venta bg-ink text-[#E7EDEB]">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-5 py-3">
          <Link href="/" className="flex items-baseline gap-2.5">
            <b className="font-display text-[26px] leading-none font-bold tracking-[.04em] uppercase">LYD Cargo</b>
            <span className="text-[11px] tracking-[.14em] text-[#8FA6AC] uppercase">Estrategia comercial</span>
          </Link>
          <div className="ml-auto flex items-center gap-2 text-xs text-[#A9BEC3]">
            <span
              className={clsx(
                "h-2.5 w-2.5 rounded-full",
                d.cargando ? "animate-pulse bg-[#E9B44C]" : d.error ? "bg-[#E4674F]" : "bg-[#3FBF7F] shadow-[0_0_0_3px_rgba(63,191,127,.18)]",
              )}
            />
            {d.cargando ? "Consultando ERP…" : d.datos ? (
              <span>
                {d.datos.fuente === "demo" ? "Datos DEMO" : d.error ? "Copia local" : "Bit ERP en línea"} ·{" "}
                {new Date(d.datos.actualizado).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })} · {d.datos.filas.toLocaleString("es-CL")} filas
              </span>
            ) : "Sin datos"}
          </div>
          <button
            onClick={d.refrescar}
            disabled={d.cargando}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-venta bg-venta px-3.5 py-2 text-[13px] font-medium text-white hover:bg-[#0B676F] disabled:opacity-50"
          >
            <RefreshCw size={15} aria-hidden className={d.cargando ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </header>

      <nav className="no-print sticky top-[59px] z-30 bg-ink-2">
        <div className="mx-auto flex max-w-[1400px] gap-0.5 overflow-x-auto px-5">
          {NAV.map((n) => {
            const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "border-b-[3px] px-4 py-3 font-display text-[15px] font-semibold tracking-[.06em] whitespace-nowrap uppercase",
                  on ? "border-venta bg-white/5 text-white" : "border-transparent text-[#9DB4BA] hover:text-white",
                )}
              >
                {n.label}
                {n.href === "/alertas" && urgentes > 0 && (
                  <span className="num ml-1.5 rounded-full bg-risk px-1.5 py-px text-[10px] text-white">{urgentes}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {modelo && !["/metas", "/config"].some((p) => path.startsWith(p)) && (
        <section className="no-print border-b border-line bg-surface">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-3.5 px-5 py-2.5">
            <Campo label="Desde">
              <select className={sel} value={F.desde} onChange={(e) => d.setFiltros({ desde: e.target.value })}>
                {periodos.map((p) => <option key={p} value={p}>{mes(p)}</option>)}
              </select>
            </Campo>
            <Campo label="Hasta">
              <select className={sel} value={F.hasta} onChange={(e) => d.setFiltros({ hasta: e.target.value })}>
                {periodos.map((p) => <option key={p} value={p}>{mes(p)}{p === modelo.mesActual ? " (en curso)" : ""}</option>)}
              </select>
            </Campo>
            <Campo label="Segmento">
              <div className="flex gap-1">
                {["", ...modelo.segmentos].map((s) => (
                  <Chip key={s} on={F.segmento === s} onClick={() => d.setFiltros({ segmento: s })}>{s || "Todos"}</Chip>
                ))}
              </div>
            </Campo>
            <Campo label="Etapa">
              <select className={sel} value={F.etapa} onChange={(e) => d.setFiltros({ etapa: e.target.value as Etapa | "" })}>
                <option value="">Todas</option>
                {(Object.keys(ETAPAS) as Etapa[]).map((k) => <option key={k} value={k}>{ETAPAS[k]}</option>)}
              </select>
            </Campo>
            <Campo label="Ejecutiva">
              <select className={sel} value={F.ejecutiva} onChange={(e) => d.setFiltros({ ejecutiva: e.target.value })}>
                <option value="">Todas</option>
                {modelo.ejecutivas.map((x) => <option key={x}>{x}</option>)}
              </select>
            </Campo>
            <Campo label="Buscar cliente">
              <input className={clsx(sel, "w-48")} type="search" placeholder="Nombre…" value={F.buscar} onChange={(e) => d.setFiltros({ buscar: e.target.value })} />
            </Campo>
            <Campo label="Mes analizado (alertas)">
              <select className={sel} value={d.mesAnalisis} onChange={(e) => d.setMesAnalisis(e.target.value)}>
                {periodos.filter((p) => p <= modelo.mesCerrado).slice(-18).reverse().map((p) => <option key={p} value={p}>{mes(p)}</option>)}
              </select>
            </Campo>
            <button className="mb-1 cursor-pointer text-xs text-venta underline" onClick={d.limpiarFiltros}>Limpiar</button>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-[1400px] px-5 pt-5 pb-16">
        {d.error && (
          <Aviso tono="err">
            <b>No se pudo consultar el ERP.</b> {d.error} {d.datos ? "Se muestra la última copia local." : ""}
          </Aviso>
        )}
        {d.datos?.avisos.map((a) => <Aviso key={a} tono="warn">{a}</Aviso>)}
        {d.cargando && !d.datos ? <Cargando /> : children}
      </main>
    </>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold tracking-widest text-muted uppercase">{label}</span>
      {children}
    </label>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={clsx("cursor-pointer rounded border px-2.5 py-1.5 text-xs", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:bg-paper")}
    >
      {children}
    </button>
  );
}

function Cargando() {
  return (
    <div className="grid gap-3.5 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded border border-line bg-surface" />
      ))}
    </div>
  );
}
