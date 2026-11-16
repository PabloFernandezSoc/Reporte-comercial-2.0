"use client";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { clp, clpCorto, mes, pct } from "@/lib/format";

export const COL = {
  venta: "#0E7C86",
  ventaClaro: "#7CC0C6",
  meta: "#4E6B78",
  metaClaro: "rgba(78,107,120,.28)",
  ok: "#2E7D4F",
  warn: "#B5820F",
  risk: "#B3402E",
  ink: "#0D1B24",
  grid: "#E6ECEA",
  muted: "#6A7B82",
  seg: { FFWW: "#175E9E", CD: "#2E7D4F", CAPEX: "#0E7C86", CHURN: "#B3402E", "SIN CLASIFICAR": "#9AA8AC" } as Record<string, string>,
};

const ejeClp = { tickFormatter: (v: number) => clpCorto(v), width: 62, axisLine: false, tickLine: false } as const;
const ejeX = { tickLine: false, axisLine: { stroke: COL.grid } } as const;
const leyenda = { iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 6 } };

function Caja({ children, alto = 300 }: { children: React.ReactElement; alto?: number }) {
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

interface TTItem { name?: string; value?: number | number[]; color?: string; dataKey?: string; payload?: Record<string, unknown> }
function TT({ active, payload, label, fmt }: { active?: boolean; payload?: TTItem[]; label?: string; fmt?: (v: number, k?: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{label && /^\d{4}-\d{2}$/.test(label) ? mes(label) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num">
              {Array.isArray(p.value) ? `${clpCorto(p.value[0])} – ${clpCorto(p.value[1])}` : fmt ? fmt(p.value as number, String(p.dataKey)) : clp(p.value as number)}
            </span>
          </div>
        ))}
    </div>
  );
}

/* ---------- venta vs meta mensual ---------- */
export function VentaMetaChart({ data }: { data: { p: string; venta: number; meta: number; cumpl: number | null; enCurso?: boolean }[] }) {
  return (
    <Caja>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis yAxisId="v" {...ejeClp} />
        <YAxis yAxisId="c" orientation="right" tickFormatter={(v) => `${v}%`} width={40} axisLine={false} tickLine={false} />
        <Tooltip content={<TT fmt={(v, k) => (k === "cumpl" ? pct(v) : clp(v))} />} />
        <Legend {...leyenda} />
        <Bar yAxisId="v" dataKey="meta" name="Meta" fill={COL.metaClaro} radius={[2, 2, 0, 0]} />
        <Bar yAxisId="v" dataKey="venta" name="Venta" fill={COL.venta} radius={[2, 2, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.p} fill={d.enCurso ? COL.ventaClaro : COL.venta} />
          ))}
        </Bar>
        <ReferenceLine yAxisId="c" y={100} stroke={COL.warn} strokeDasharray="3 3" />
        <Line yAxisId="c" dataKey="cumpl" name="% cumplimiento" stroke={COL.warn} strokeWidth={2} dot={{ r: 3 }} connectNulls />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- acumulado del año vs meta y proyección ---------- */
export function AcumuladoChart({ data }: { data: { p: string; real: number | null; meta: number | null; proy: number | null }[] }) {
  return (
    <Caja>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        <Legend {...leyenda} />
        <Area dataKey="meta" name="Meta acumulada" stroke={COL.meta} fill={COL.metaClaro} strokeDasharray="5 4" />
        <Line dataKey="real" name="Venta acumulada" stroke={COL.venta} strokeWidth={3} dot={{ r: 3 }} />
        <Line dataKey="proy" name="Proyección de cierre" stroke={COL.venta} strokeWidth={2} strokeDasharray="4 4" dot={false} />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- venta por segmento en el tiempo ---------- */
export function SegmentosChart({ data, segmentos }: { data: Record<string, number | string>[]; segmentos: string[] }) {
  return (
    <Caja>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        <Legend {...leyenda} />
        {segmentos.map((s) => (
          <Area key={s} dataKey={s} name={s} stackId="1" stroke={COL.seg[s]} fill={COL.seg[s]} fillOpacity={0.75} />
        ))}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- puente de variación (cascada) ---------- */
export interface PasoPuente { nombre: string; delta: number; tipo: "ini" | "fin" | "mov" }
export function PuenteChart({ pasos, alto = 320 }: { pasos: PasoPuente[]; alto?: number }) {
  let acum = 0;
  const data = pasos.map((s) => {
    if (s.tipo === "ini" || s.tipo === "fin") {
      acum = s.delta;
      return { nombre: s.nombre, base: 0, valor: s.delta, delta: s.delta, tipo: s.tipo };
    }
    const desde = acum;
    acum += s.delta;
    return { nombre: s.nombre, base: Math.min(desde, acum), valor: Math.abs(s.delta), delta: s.delta, tipo: s.tipo };
  });
  // eje que parte cerca del menor nivel para que los movimientos se vean
  const niveles = data.flatMap((d) => [d.base, d.base + d.valor]);
  const lo = Math.min(...niveles);
  const hi = Math.max(...niveles);
  const piso = Math.max(0, lo - (hi - lo) * 0.25);
  const dominio: [number, number] = [piso, hi + (hi - lo) * 0.05];
  const datos = data.map((d) => (d.tipo !== "mov" ? { ...d, base: piso, valor: d.valor - piso } : d));
  return (
    <Caja alto={alto}>
      <ComposedChart data={datos} margin={{ top: 8, right: 4, left: 0, bottom: 40 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="nombre" interval={0} angle={-28} textAnchor="end" height={60} tick={{ fontSize: 10.5 }} {...ejeX} tickFormatter={(s: string) => (s.length > 18 ? s.slice(0, 17) + "…" : s)} />
        <YAxis {...ejeClp} domain={dominio} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded border border-line bg-white px-3 py-2 text-xs shadow-lg">
                <b>{d.nombre}</b>
                <div className="num">{d.tipo === "mov" ? `${d.delta >= 0 ? "+" : ""}${clp(d.delta)}` : clp(d.delta)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="valor" stackId="a" radius={[2, 2, 2, 2]}>
          {datos.map((d, i) => (
            <Cell key={i} fill={d.tipo !== "mov" ? COL.meta : d.delta >= 0 ? COL.ok : COL.risk} />
          ))}
        </Bar>
      </ComposedChart>
    </Caja>
  );
}

/* ---------- pareto ---------- */
export function ParetoChart({ data }: { data: { nombre: string; venta: number; acum: number }[] }) {
  return (
    <Caja>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="nombre" tick={false} {...ejeX} />
        <YAxis yAxisId="v" {...ejeClp} />
        <YAxis yAxisId="a" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={40} axisLine={false} tickLine={false} />
        <Tooltip content={<TT fmt={(v, k) => (k === "acum" ? pct(v) : clp(v))} />} />
        <ReferenceLine yAxisId="a" y={80} stroke={COL.risk} strokeDasharray="4 4" />
        <Bar yAxisId="v" dataKey="venta" name="Venta" fill={COL.venta} radius={[2, 2, 0, 0]} />
        <Line yAxisId="a" dataKey="acum" name="% acumulado" stroke={COL.warn} strokeWidth={2} dot={false} />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- matriz venta vs margen ---------- */
export function MatrizChart({ data, medVenta, medMargen, onClick }: { data: { nombre: string; venta: number; margen: number; serv: number; color: string }[]; medVenta: number; medMargen: number; onClick?: (n: string) => void }) {
  return (
    <Caja alto={400}>
      <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
        <CartesianGrid stroke={COL.grid} />
        <XAxis type="number" dataKey="venta" name="Venta" scale="log" domain={["auto", "auto"]} tickFormatter={clpCorto} {...ejeX} />
        <YAxis type="number" dataKey="margen" name="Margen" tickFormatter={(v) => `${v}%`} width={44} axisLine={false} tickLine={false} />
        <ZAxis type="number" dataKey="serv" range={[40, 900]} />
        <ReferenceLine x={medVenta} stroke={COL.ink} strokeDasharray="4 4" />
        <ReferenceLine y={medMargen} stroke={COL.ink} strokeDasharray="4 4" />
        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded border border-line bg-white px-3 py-2 text-xs shadow-lg">
                <b>{d.nombre}</b>
                <div>Venta <span className="num">{clp(d.venta)}</span></div>
                <div>Margen <span className="num">{pct(d.margen)}</span> · {d.serv} servicios</div>
              </div>
            );
          }}
        />
        <Scatter data={data} onClick={(p: { payload?: { nombre?: string } }) => p?.payload?.nombre && onClick?.(p.payload.nombre)} cursor="pointer">
          {data.map((d) => (
            <Cell key={d.nombre} fill={d.color} fillOpacity={0.7} stroke={d.color} />
          ))}
        </Scatter>
      </ScatterChart>
    </Caja>
  );
}

/* ---------- cliente: venta real vs banda de normalidad ---------- */
export interface PuntoBanda { p: string; real: number; esperado: number | null; banda: [number, number] | null; meta: number | null; z: number | null; enCurso?: boolean }
export function BandaChart({ data, alto = 320, compacto = false }: { data: PuntoBanda[]; alto?: number; compacto?: boolean }) {
  const color = (d: PuntoBanda) => (d.enCurso ? COL.ventaClaro : d.z == null ? COL.venta : d.z <= -2 ? COL.risk : d.z <= -1.28 ? COL.warn : d.z >= 2 ? COL.ok : COL.venta);
  return (
    <Caja alto={alto}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        {!compacto && <Legend {...leyenda} />}
        <Area dataKey="banda" name="Rango normal (90%)" stroke="none" fill={COL.venta} fillOpacity={0.12} />
        <Bar dataKey="real" name="Venta real" fill={COL.venta} radius={[2, 2, 0, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.p} fill={color(d)} />
          ))}
        </Bar>
        <Line dataKey="esperado" name="Esperado" stroke={COL.ink} strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls />
        <Line dataKey="meta" name="Meta" stroke={COL.risk} strokeWidth={2} dot={false} type="stepAfter" connectNulls={false} />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- año contra año ---------- */
export function YoYChart({ data, anios }: { data: Record<string, number | string | null>[]; anios: string[] }) {
  const cols = [COL.metaClaro, COL.venta];
  return (
    <Caja alto={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="mes" {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        <Legend {...leyenda} />
        {anios.map((a, i) => (
          <Bar key={a} dataKey={a} name={a} fill={cols[i % 2] === COL.metaClaro ? "#A9BDC4" : COL.venta} radius={[2, 2, 0, 0]} />
        ))}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- barras apiladas genéricas ---------- */
export function ApiladoChart({ data, series, alto = 260, eje = "clp" }: { data: Record<string, number | string>[]; series: { key: string; nombre: string; color: string }[]; alto?: number; eje?: "clp" | "num" }) {
  return (
    <Caja alto={alto}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        {eje === "clp" ? <YAxis {...ejeClp} /> : <YAxis width={40} axisLine={false} tickLine={false} />}
        <Tooltip content={<TT fmt={eje === "clp" ? undefined : (v) => v.toLocaleString("es-CL")} />} />
        <Legend {...leyenda} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="a" fill={s.color} radius={i === series.length - 1 ? [2, 2, 0, 0] : 0} />
        ))}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- servicios y ticket ---------- */
export function ServTicketChart({ data }: { data: { p: string; serv: number; ticket: number | null }[] }) {
  return (
    <Caja alto={240}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis yAxisId="s" width={36} axisLine={false} tickLine={false} />
        <YAxis yAxisId="t" orientation="right" {...ejeClp} />
        <Tooltip content={<TT fmt={(v, k) => (k === "serv" ? `${v} serv.` : clp(v))} />} />
        <Legend {...leyenda} />
        <Bar yAxisId="s" dataKey="serv" name="Servicios" fill="#A9BDC4" radius={[2, 2, 0, 0]} />
        <Line yAxisId="t" dataKey="ticket" name="Ticket promedio" stroke={COL.warn} strokeWidth={2} dot={{ r: 2 }} connectNulls />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({ valores, color = COL.venta, alto = 34 }: { valores: number[]; color?: string; alto?: number }) {
  const data = valores.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: "100%", height: alto }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 3, right: 2, left: 2, bottom: 3 }}>
          <Line dataKey="v" stroke={color} strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
