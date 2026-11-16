"use client";
import clsx from "clsx";
import type { ReactNode } from "react";

export type Tono = "ok" | "warn" | "risk" | "n" | "info" | "venta";

const TONO_PILL: Record<Tono, string> = {
  ok: "text-ok bg-ok-soft border-[#BFE0CC]",
  warn: "text-warn bg-warn-soft border-[#EBDBAE]",
  risk: "text-risk bg-risk-soft border-[#EFC8BF]",
  n: "text-muted bg-[#F1F4F3] border-line",
  info: "text-info bg-info-soft border-[#C3DAEC]",
  venta: "text-venta bg-venta-soft border-[#BEDEE0]",
};
const TONO_BORDE: Record<Tono, string> = {
  ok: "border-l-ok",
  warn: "border-l-warn",
  risk: "border-l-risk",
  n: "border-l-meta",
  info: "border-l-info",
  venta: "border-l-venta",
};

export function Pill({ tono = "n", children, className }: { tono?: Tono; children: ReactNode; className?: string }) {
  return (
    <span className={clsx("inline-block rounded-sm border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-wider whitespace-nowrap", TONO_PILL[tono], className)}>
      {children}
    </span>
  );
}

const SEG_TONO: Record<string, Tono> = { FFWW: "info", CD: "ok", CAPEX: "venta", CHURN: "risk" };
export function PillSeg({ s }: { s: string }) {
  return <Pill tono={SEG_TONO[s] ?? "n"}>{s === "SIN CLASIFICAR" ? "s/c" : s}</Pill>;
}

export function Card({ titulo, sub, children, className, accion }: { titulo?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string; accion?: ReactNode }) {
  return (
    <section className={clsx("rounded border border-line bg-surface p-4", className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {titulo && <h3 className="font-display text-[17px] font-semibold leading-tight tracking-wide">{titulo}</h3>}
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ k, v, d, tono = "venta", children }: { k: string; v: ReactNode; d?: ReactNode; tono?: Tono; children?: ReactNode }) {
  return (
    <div className={clsx("rounded border border-l-[3px] border-line bg-surface px-4 py-3", TONO_BORDE[tono])}>
      <div className="text-[10px] font-semibold uppercase tracking-[.11em] text-muted">{k}</div>
      <div className="num mt-1 text-[24px] leading-tight font-semibold tracking-tight">{v}</div>
      {d && <div className="mt-1 text-[11.5px] text-muted">{d}</div>}
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("eyebrow mt-7 mb-2 first:mt-0", className)}>{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded border border-dashed border-line bg-surface p-8 text-center text-[13px] text-muted">{children}</div>;
}

export function Aviso({ tono = "info", children }: { tono?: "info" | "warn" | "err"; children: ReactNode }) {
  const c = tono === "err" ? "bg-risk-soft border-[#EFC8BF] text-[#7A2A1C]" : tono === "warn" ? "bg-warn-soft border-[#EBDBAE] text-[#6E4E06]" : "bg-venta-soft border-[#BEDEE0] text-[#0B4E54]";
  return <div className={clsx("mb-3 rounded border px-3.5 py-2.5 text-[13px]", c)}>{children}</div>;
}

export function nivel(cumpl: number | null, ok = 100, alerta = 85): Tono {
  if (cumpl == null) return "n";
  return cumpl >= ok ? "ok" : cumpl >= alerta ? "warn" : "risk";
}

/** Barra de avance contra meta: la marca negra es el 100%. */
export function Gauge({ cumpl, label = false }: { cumpl: number | null; label?: boolean }) {
  if (cumpl == null) return <span className="text-[11.5px] text-muted">sin meta</span>;
  const w = (Math.max(0, Math.min(150, cumpl)) / 150) * 100;
  const t = nivel(cumpl);
  const bg = t === "ok" ? "bg-ok" : t === "warn" ? "bg-warn" : "bg-risk";
  return (
    <div className="relative h-3.5 min-w-[110px] rounded-sm bg-line-2">
      <div className={clsx("h-full rounded-l-sm transition-[width] duration-500", bg)} style={{ width: `${w.toFixed(1)}%` }} />
      <div className="absolute -top-1 -bottom-1 w-0.5 bg-ink" style={{ left: "66.6%" }} title="Meta (100%)" />
      {label && <span className="absolute -top-4 text-[9px] uppercase tracking-wider" style={{ left: "calc(66.6% - 10px)" }}>meta</span>}
    </div>
  );
}

export function Variacion({ v, dec = 0 }: { v: number | null | undefined; dec?: number }) {
  if (v == null || !isFinite(v)) return <span className="text-muted">—</span>;
  return (
    <span className={clsx("font-semibold", v >= 0 ? "text-ok" : "text-risk")}>
      {v >= 0 ? "▲ +" : "▼ "}
      {v.toFixed(dec)}%
    </span>
  );
}

export function Btn({
  children, onClick, primario, peque, disabled, title, type = "button", className,
}: { children: ReactNode; onClick?: () => void; primario?: boolean; peque?: boolean; disabled?: boolean; title?: string; type?: "button" | "submit"; className?: string }) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "inline-flex cursor-pointer items-center gap-1.5 rounded border font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-venta disabled:cursor-not-allowed disabled:opacity-50",
        peque ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-[13px]",
        primario ? "border-venta bg-venta text-white hover:bg-[#0B676F]" : "border-line bg-surface text-ink hover:bg-[#F4F7F6]",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Tabla({ children, alto }: { children: ReactNode; alto?: number }) {
  return (
    <div className="overflow-auto rounded border border-line bg-surface" style={alto ? { maxHeight: alto } : undefined}>
      <table className="tbl">{children}</table>
    </div>
  );
}
