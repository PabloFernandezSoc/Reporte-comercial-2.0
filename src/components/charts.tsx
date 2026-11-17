"use client";
/**
 * Gráficos de la app. Reglas (skill dataviz):
 *  - Un solo eje Y por gráfico: medidas distintas van en gráficos distintos.
 *  - Serie única = color de marca (teal). Varias series = paleta categórica validada, orden fijo.
 *  - Etapas (ordenadas) = rampa ordinal de un solo tono. Estado (bien/mal) = colores de estado, siempre con texto.
 *  - Marcas finas, extremos redondeados de 4px, 2px de separación entre segmentos apilados, grilla en línea fina.
 */
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

/** Paleta categórica validada (validate_palette.js, modo claro): azul, naranja, aqua, amarillo, magenta. */
export const CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];
export const OTROS = "#a3abae";

export const COL = {
  venta: "#0E7C86", // serie única / marca
  ventaClaro: "#8CC8CD", // mes en curso (parcial)
  meta: "#33454C",
  anterior: "#B4BEC1", // período de comparación
  ok: "#2E7D4F",
  warn: "#B5820F",
  risk: "#B3402E",
  ink: "#0D1B24",
  grid: "#E8EDEC",
  muted: "#6A7B82",
  surface: "#FFFFFF",
  // segmentos: identidad estable (no cambia al filtrar)
  seg: { FFWW: CAT[0], CD: CAT[1], CAPEX: CAT[2], CHURN: CAT[3], "SIN CLASIFICAR": OTROS } as Record<string, string>,
  // etapas: rampa ordinal azul (proyección → en curso → finalizado)
  etapa: { proyeccion: "#86b6ef", curso: "#3987e5", finalizado: "#184f95", sinclasif: "#c9d0d2" } as Record<string, string>,
};

const ejeClp = { tickFormatter: (v: number) => clpCorto(v), width: 74, axisLine: false, tickLine: false } as const;
const ejeX = { tickLine: false, axisLine: { stroke: COL.grid }, tickMargin: 6 } as const;
const leyenda = { iconType: "circle" as const, iconSize: 8, wrapperStyle: { fontSize: 12, paddingTop: 8 } };
const R = [4, 4, 0, 0] as [number, number, number, number];

function Caja({ children, alto = 300, resumen }: { children: React.ReactElement; alto?: number; resumen?: string }) {
  return (
    <div style={{ width: "100%", height: alto }} role="img" aria-label={resumen}>
      <ResponsiveContainer>{children}</ResponsiveContainer>
    </div>
  );
}

interface TTItem { name?: string; value?: number | number[]; color?: string; dataKey?: string; payload?: Record<string, unknown> }
function TT({ active, payload, label, fmt, extra }: { active?: boolean; payload?: TTItem[]; label?: string; fmt?: (v: number, k?: string) => string; extra?: (p: Record<string, unknown>) => React.ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[180px] rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-semibold text-ink">{label && /^\d{4}-\d{2}$/.test(label) ? mes(label) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={String(p.dataKey)} className="flex items-center justify-between gap-4 py-px">
            <span className="flex items-center gap-1.5 text-ink-2">
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num text-ink">
              {Array.isArray(p.value) ? `${clpCorto(p.value[0])} – ${clpCorto(p.value[1])}` : fmt ? fmt(p.value as number, String(p.dataKey)) : clp(p.value as number)}
            </span>
          </div>
        ))}
      {extra && payload[0]?.payload && <div className="mt-1.5 border-t border-line-2 pt-1.5 text-ink-2">{extra(payload[0].payload)}</div>}
    </div>
  );
}

/* ---------- venta vs meta mensual (un eje; el % va en el tooltip y en la tabla) ---------- */
export function VentaMetaChart({ data }: { data: { p: string; venta: number; meta: number; cumpl: number | null; enCurso?: boolean }[] }) {
  return (
    <Caja resumen="Venta mensual contra la meta">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip cursor={{ fill: "rgba(13,27,36,.04)" }} content={<TT extra={(p) => (p.cumpl != null ? <>Cumplimiento <b className="num text-ink">{pct(p.cumpl as number)}</b>{p.enCurso ? " · mes en curso" : ""}</> : "Sin meta")} />} />
        <Legend {...leyenda} />
        <Bar dataKey="venta" name="Venta" fill={COL.venta} radius={R}>
          {data.map((d) => <Cell key={d.p} fill={d.enCurso ? COL.ventaClaro : COL.venta} />)}
        </Bar>
        <Line dataKey={(d: { meta: number }) => (d.meta > 0 ? d.meta : null)} name="Meta" stroke={COL.meta} strokeWidth={2} type="step" dot={false} connectNulls={false} />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- acumulado del año vs meta y proyección ---------- */
export function AcumuladoChart({ data }: { data: { p: string; real: number | null; meta: number | null; proy: number | null }[] }) {
  return (
    <Caja resumen="Venta acumulada del año contra meta acumulada, con proyección de cierre">
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        <Legend {...leyenda} />
        <Line dataKey="meta" name="Meta acumulada" stroke={COL.meta} strokeWidth={2} dot={false} />
        <Line dataKey="real" name="Venta acumulada" stroke={COL.venta} strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2, stroke: COL.surface, fill: COL.venta }} />
        <Line dataKey="proy" name="Proyección" stroke={COL.venta} strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- venta por segmento (líneas: se comparan tendencias sin apilar) ---------- */
export function SegmentosChart({ data, segmentos }: { data: Record<string, number | string>[]; segmentos: string[] }) {
  return (
    <Caja resumen="Venta mensual por segmento">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip content={<TT />} />
        <Legend {...leyenda} />
        {segmentos.map((s) => (
          <Line key={s} dataKey={s} name={s === "SIN CLASIFICAR" ? "Sin clasificar" : s} stroke={COL.seg[s] ?? OTROS} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COL.seg[s] ?? OTROS }} activeDot={{ r: 5, stroke: COL.surface, strokeWidth: 2 }} />
        ))}
      </LineChart>
    </Caja>
  );
}

/* ---------- puente de variación (cascada) ---------- */
export interface PasoPuente { nombre: string; delta: number; tipo: "ini" | "fin" | "mov" }
export function PuenteChart({ pasos, alto = 340 }: { pasos: PasoPuente[]; alto?: number }) {
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
  const niveles = data.flatMap((d) => (d.tipo === "mov" ? [d.base, d.base + d.valor] : [d.valor]));
  const lo = Math.min(...niveles);
  const hi = Math.max(...niveles);
  const piso = Math.max(0, lo - (hi - lo) * 0.25);
  const dominio: [number, number] = [piso, hi + (hi - lo) * 0.05];
  const datos = data.map((d) => (d.tipo !== "mov" ? { ...d, base: piso, valor: d.valor - piso } : d));
  return (
    <Caja alto={alto} resumen="Clientes que explican la variación de venta entre dos meses">
      <ComposedChart data={datos} margin={{ top: 8, right: 8, left: 0, bottom: 44 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="nombre" interval={0} angle={-30} textAnchor="end" height={64} tick={{ fontSize: 10.5 }} {...ejeX} tickFormatter={(s: string) => (s.length > 20 ? s.slice(0, 19) + "…" : s)} />
        <YAxis {...ejeClp} domain={dominio} allowDataOverflow />
        <Tooltip
          cursor={{ fill: "rgba(13,27,36,.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
                <b className="text-ink">{d.nombre}</b>
                <div className="num mt-0.5">{d.tipo === "mov" ? `${d.delta >= 0 ? "Sube " : "Baja "}${clp(Math.abs(d.delta))}` : clp(d.delta)}</div>
              </div>
            );
          }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="valor" stackId="a" radius={[3, 3, 3, 3]}>
          {datos.map((d, i) => <Cell key={i} fill={d.tipo !== "mov" ? COL.meta : d.delta >= 0 ? CAT[0] : COL.risk} />)}
        </Bar>
      </ComposedChart>
    </Caja>
  );
}

/* ---------- curva de concentración (un eje: % acumulado) ---------- */
export function ParetoChart({ data }: { data: { nombre: string; venta: number; acum: number }[] }) {
  const d2 = data.map((d, i) => ({ ...d, n: i + 1 }));
  return (
    <Caja resumen="Porcentaje acumulado de la venta según número de clientes">
      <ComposedChart data={d2} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="n" {...ejeX} label={{ value: "Clientes ordenados por venta", position: "insideBottom", offset: -2, fontSize: 11, fill: COL.muted }} height={36} />
        <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={44} axisLine={false} tickLine={false} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof d2)[number];
            return (
              <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
                <b className="text-ink">#{d.n} {d.nombre}</b>
                <div className="num">Venta {clp(d.venta)}</div>
                <div className="num">Acumulado {pct(d.acum)}</div>
              </div>
            );
          }}
        />
        <ReferenceLine y={80} stroke={COL.muted} label={{ value: "80%", position: "insideTopLeft", fontSize: 11, fill: COL.muted }} />
        <Area dataKey="acum" name="% acumulado" stroke={COL.venta} strokeWidth={2} fill={COL.venta} fillOpacity={0.1} type="monotone" />
      </ComposedChart>
    </Caja>
  );
}

/* ---------- matriz venta vs margen ---------- */
export function MatrizChart({ data, medVenta, medMargen, onClick }: { data: { nombre: string; venta: number; margen: number; serv: number; color: string }[]; medVenta: number; medMargen: number; onClick?: (n: string) => void }) {
  return (
    <Caja alto={420} resumen="Clientes por venta y margen">
      <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
        <CartesianGrid stroke={COL.grid} />
        <XAxis type="number" dataKey="venta" name="Venta" scale="log" domain={["auto", "auto"]} tickFormatter={clpCorto} {...ejeX} />
        <YAxis type="number" dataKey="margen" name="Margen" tickFormatter={(v) => `${v}%`} width={44} axisLine={false} tickLine={false} />
        <ZAxis type="number" dataKey="serv" range={[50, 900]} />
        <ReferenceLine x={medVenta} stroke={COL.muted} />
        <ReferenceLine y={medMargen} stroke={COL.muted} />
        <Tooltip
          cursor={{ stroke: COL.grid }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as (typeof data)[number];
            return (
              <div className="rounded-md border border-line bg-white px-3 py-2 text-xs shadow-lg">
                <b className="text-ink">{d.nombre}</b>
                <div>Venta <span className="num">{clp(d.venta)}</span></div>
                <div>Margen <span className="num">{pct(d.margen)}</span> · {d.serv} servicios</div>
                <div className="mt-1 text-muted">Clic para abrir el cliente</div>
              </div>
            );
          }}
        />
        <Scatter data={data} onClick={(p: { payload?: { nombre?: string } }) => p?.payload?.nombre && onClick?.(p.payload.nombre)} cursor="pointer">
          {data.map((d) => <Cell key={d.nombre} fill={d.color} fillOpacity={0.75} stroke={COL.surface} strokeWidth={2} />)}
        </Scatter>
      </ScatterChart>
    </Caja>
  );
}

/* ---------- cliente: venta real vs banda de normalidad ---------- */
export interface PuntoBanda { p: string; real: number; esperado: number | null; banda: [number, number] | null; meta: number | null; z: number | null; enCurso?: boolean }
export function BandaChart({ data, alto = 320, compacto = false }: { data: PuntoBanda[]; alto?: number; compacto?: boolean }) {
  // estado del mes: rojo = fuera de lo normal hacia abajo, ámbar = en el borde (siempre explicado en la leyenda)
  // el eje se ajusta a venta, esperado y meta; la banda se recorta si un cliente es muy volátil
  const tope = Math.max(1, ...data.flatMap((d) => [d.real, d.esperado ?? 0, d.meta ?? 0])) * 1.2;
  const color = (d: PuntoBanda) => (d.enCurso ? COL.ventaClaro : d.z == null ? COL.venta : d.z <= -2 ? COL.risk : d.z <= -1.28 ? COL.warn : COL.venta);
  return (
    <div>
      <Caja alto={alto} resumen="Venta mensual del cliente contra su rango normal">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke={COL.grid} />
          <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
          <YAxis {...ejeClp} domain={[0, tope]} allowDataOverflow />
          <Tooltip
            cursor={{ fill: "rgba(13,27,36,.04)" }}
            content={<TT extra={(p) => (p.z != null ? (p.z as number) <= -2 ? "Fuera de su rango normal" : (p.z as number) <= -1.28 ? "En el borde inferior" : (p.z as number) >= 2 ? "Sobre su rango normal" : "Dentro de lo normal" : p.enCurso ? "Mes en curso (parcial)" : "Sin historia suficiente")} />}
          />
          {!compacto && <Legend {...leyenda} />}
          <Area dataKey="banda" name="Rango normal" stroke="none" fill={COL.venta} fillOpacity={0.12} isAnimationActive={false} />
          <Bar dataKey="real" name="Venta" fill={COL.venta} radius={R} maxBarSize={26}>
            {data.map((d) => <Cell key={d.p} fill={color(d)} />)}
          </Bar>
          <Line dataKey="esperado" name="Esperado" stroke={COL.ink} strokeDasharray="4 3" strokeWidth={1.5} dot={false} connectNulls />
          <Line dataKey="meta" name="Meta" stroke={COL.meta} strokeWidth={2} dot={false} type="step" connectNulls={false} />
        </ComposedChart>
      </Caja>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL.risk }} /> Mes fuera de lo normal</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL.warn }} /> En el borde</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COL.ventaClaro }} /> Mes en curso</span>
      </div>
    </div>
  );
}

/* ---------- año contra año ---------- */
export function YoYChart({ data, anios }: { data: Record<string, number | string | null>[]; anios: string[] }) {
  return (
    <Caja alto={260} resumen="Venta por mes, comparación entre años">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%" barGap={2}>
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="mes" {...ejeX} />
        <YAxis {...ejeClp} />
        <Tooltip cursor={{ fill: "rgba(13,27,36,.04)" }} content={<TT />} />
        <Legend {...leyenda} />
        {anios.map((a, i) => <Bar key={a} dataKey={a} name={a} fill={i === anios.length - 1 ? COL.venta : COL.anterior} radius={R} />)}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- barras apiladas genéricas ---------- */
export function ApiladoChart({ data, series, alto = 260, eje = "clp", resumen }: { data: Record<string, number | string>[]; series: { key: string; nombre: string; color: string }[]; alto?: number; eje?: "clp" | "num"; resumen?: string }) {
  return (
    <Caja alto={alto} resumen={resumen}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        {eje === "clp" ? <YAxis {...ejeClp} /> : <YAxis width={40} axisLine={false} tickLine={false} allowDecimals={false} />}
        <Tooltip cursor={{ fill: "rgba(13,27,36,.04)" }} content={<TT fmt={eje === "clp" ? undefined : (v) => v.toLocaleString("es-CL")} />} />
        <Legend {...leyenda} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="a" fill={s.color} stroke={COL.surface} strokeWidth={1} radius={i === series.length - 1 ? R : 0} />
        ))}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- serie simple (barras o línea) para pares de mini gráficos ---------- */
export function SerieChart({ data, k, nombre, tipo = "bar", formato = "clp", alto = 200 }: { data: Record<string, number | string | null>[]; k: string; nombre: string; tipo?: "bar" | "line"; formato?: "clp" | "num"; alto?: number }) {
  const fmt = formato === "clp" ? undefined : (v: number) => v.toLocaleString("es-CL");
  return (
    <Caja alto={alto} resumen={nombre}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={COL.grid} />
        <XAxis dataKey="p" tickFormatter={mes} {...ejeX} />
        {formato === "clp" ? <YAxis {...ejeClp} /> : <YAxis width={40} axisLine={false} tickLine={false} allowDecimals={false} />}
        <Tooltip cursor={{ fill: "rgba(13,27,36,.04)" }} content={<TT fmt={fmt} />} />
        {tipo === "bar" ? (
          <Bar dataKey={k} name={nombre} fill={COL.venta} radius={R} />
        ) : (
          <Line dataKey={k} name={nombre} stroke={COL.venta} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: COL.venta }} connectNulls />
        )}
      </ComposedChart>
    </Caja>
  );
}

/* ---------- sparkline ---------- */
export function Sparkline({ valores, color = COL.venta, alto = 34 }: { valores: number[]; color?: string; alto?: number }) {
  const data = valores.map((v, i) => ({ i, v }));
  return (
    <div style={{ width: "100%", height: alto }} aria-hidden>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
          <Line dataKey="v" stroke={color} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          {data.length > 0 && <Line dataKey={(d: { i: number; v: number }) => (d.i === data.length - 1 ? d.v : null)} stroke="none" dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
