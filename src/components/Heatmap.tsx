"use client";
import Link from "next/link";
import type { AnalisisCliente } from "@/lib/analytics";
import { clp, mes } from "@/lib/format";

/** Color divergente según z: rojo = bajo lo normal, verde = sobre lo normal, blanco = dentro del rango. */
export function colorZ(z: number | null, real: number): string {
  if (z == null) return real > 0 ? "#F1F4F3" : "#FAFBFB";
  const t = Math.max(-3, Math.min(3, z));
  if (Math.abs(t) < 0.8) return "#F0F2F1";
  const a = Math.min(1, (Math.abs(t) - 0.8) / 2.2);
  return t < 0 ? `rgba(179,64,46,${0.15 + 0.75 * a})` : `rgba(42,120,214,${0.15 + 0.7 * a})`;
}

export function Heatmap({ analisis, meses = 12, max = 30 }: { analisis: AnalisisCliente[]; meses?: number; max?: number }) {
  const filas = [...analisis]
    .map((a) => ({ a, total: a.venta.puntos.slice(-meses).reduce((x, p) => x + p.real, 0) }))
    .filter((f) => f.total > 0)
    .sort((x, y) => y.total - x.total)
    .slice(0, max);
  if (!filas.length) return null;
  const ps = filas[0].a.periodos.slice(-meses);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-surface text-left text-[10px] font-semibold tracking-wider text-muted uppercase">Cliente</th>
            {ps.map((p) => (
              <th key={p} className="px-1 text-center text-[10.5px] font-medium text-muted">{mes(p)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(({ a }) => {
            const pts = a.venta.puntos.slice(-meses);
            // en clientes esporádicos (proyectos) un mes sin carga es parte de su patrón
            const esporadico = a.venta.tasaCeros >= 0.25;
            return (
              <tr key={a.nombre}>
                <td className="sticky left-0 max-w-[220px] truncate bg-surface pr-2 text-[12.5px]">
                  <Link href={`/clientes/${encodeURIComponent(a.nombre)}`} className="hover:text-venta hover:underline">{a.nombre}</Link>
                </td>
                {pts.map((p) => (
                  <td
                    key={p.p}
                    title={`${a.nombre} · ${mes(p.p)}\nReal ${clp(p.real)}\nEsperado ${clp(p.esperado)}${p.z != null ? `\nz ${p.z.toFixed(1)}` : ""}`}
                    className="num h-7 min-w-[46px] rounded-sm text-center text-[10.5px]"
                    style={{ background: colorZ(esporadico && p.real <= 0 ? null : p.z, p.real), color: !(esporadico && p.real <= 0) && p.z != null && Math.abs(p.z) > 2 ? "#fff" : "#33454C" }}
                  >
                    {p.real > 0 ? (p.real >= 1e6 ? (p.real / 1e6).toFixed(0) : "<1") : "·"}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11.5px] text-muted">
        <span>Cifras en millones de CLP. El color compara cada mes con lo normal <b>para ese cliente</b>:</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(179,64,46,.85)" }} /> muy bajo lo normal</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(179,64,46,.3)" }} /> algo bajo</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm border border-line" style={{ background: "#F4F7F6" }} /> normal</span>
        <span className="flex items-center gap-1"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: "rgba(42,120,214,.7)" }} /> sobre lo normal</span>
      </div>
    </div>
  );
}
