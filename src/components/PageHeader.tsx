import type { ReactNode } from "react";

/** Título de página consistente: h1 + bajada + acciones a la derecha. */
export function PageHeader({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
      <div>
        <h1 className="font-display text-[28px] leading-none font-bold tracking-wide text-ink">{titulo}</h1>
        {sub && <p className="mt-1.5 text-[13px] text-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
