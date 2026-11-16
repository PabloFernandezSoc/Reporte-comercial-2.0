"use client";
import { useDatos } from "@/components/DataProvider";
import { Aviso, Btn, Card, Eyebrow, Tabla } from "@/components/ui";
import { UMBRALES_DEF, type Umbrales } from "@/lib/anomaly";
import { clp, num } from "@/lib/format";
import { descargar } from "@/lib/storage";

const CAMPOS: { k: keyof Umbrales; label: string; hint: string; step?: number }[] = [
  { k: "zAlerta", label: "Sensibilidad de caída anómala (z)", hint: "-2 ≈ 98% de confianza. Más negativo = menos alertas.", step: 0.1 },
  { k: "zVigilancia", label: "Sensibilidad 'bajo vigilancia' (z)", hint: "-1,28 ≈ 90%.", step: 0.1 },
  { k: "caidaMinPct", label: "Caída mínima vs esperado (%)", hint: "Evita alertas por caídas chicas en clientes muy estables." },
  { k: "brechaMinClp", label: "Monto mínimo para alertar (CLP)", hint: "Evita alertas en clientes de bajo volumen.", step: 100000 },
  { k: "mesesMinHistoria", label: "Meses con venta mínimos", hint: "Historia mínima para evaluar a un cliente." },
  { k: "umbralOk", label: "Cumplimiento verde (%)", hint: "" },
  { k: "umbralAlerta", label: "Cumplimiento ámbar (%)", hint: "Bajo esto es rojo y genera alerta de brecha a meta." },
];

export default function Config() {
  const d = useDatos();
  const u = d.umbrales;
  const ct = d.contactos;
  const inp = "mt-0.5 w-full rounded border border-line px-2.5 py-1.5 text-[13px] font-normal tracking-normal normal-case text-ink focus:outline-2 focus:outline-venta";

  const exportarHechos = () => {
    if (!d.datos) return;
    const f = [["Cliente", "Mandante", "Periodo", "Etapa", "Ejecutiva", "Tipo", "Venta", "Costo", "Utilidad", "Servicios"]];
    d.datos.hechos.forEach((h) => f.push([h.c, h.m, h.p, h.e, h.x, h.t, String(h.v), String(h.k), String(h.u), String(h.s)]));
    descargar("datos-comerciales.csv", "﻿" + f.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n"), "text/csv");
  };

  return (
    <div>
      <Eyebrow>Detección de fluctuaciones</Eyebrow>
      <Card titulo="Umbrales de alerta" sub="Se guardan en este navegador." accion={<Btn peque onClick={() => d.setUmbrales(UMBRALES_DEF)}>Valores por defecto</Btn>}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {CAMPOS.map((c) => (
            <label key={c.k} className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
              {c.label}
              <input type="number" step={c.step ?? 1} className={inp} value={u[c.k]} onChange={(e) => d.setUmbrales({ ...u, [c.k]: parseFloat(e.target.value) || 0 })} />
              <span className="mt-0.5 block text-[11px] font-normal tracking-normal normal-case">{c.hint}</span>
            </label>
          ))}
        </div>
      </Card>

      <Eyebrow>Correos</Eyebrow>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card titulo="Ejecutivas comerciales" sub="Destinatario de las alertas internas.">
          {d.modelo?.ejecutivas.length ? d.modelo.ejecutivas.map((e) => (
            <label key={e} className="mb-2 block text-[11px] font-semibold tracking-wider text-muted uppercase">{e}
              <input type="email" className={inp} value={ct.ejecutivas[e] ?? ""} placeholder="correo@lydcargo.cl" onChange={(ev) => d.setContactos({ ...ct, ejecutivas: { ...ct.ejecutivas, [e]: ev.target.value } })} />
            </label>
          )) : <p className="text-sm text-muted">El ERP no informa ejecutivas.</p>}
        </Card>
        <Card titulo="Jefatura y firma">
          <label className="block text-[11px] font-semibold tracking-wider text-muted uppercase">Correo de jefatura (escalamientos)
            <input type="email" className={inp} value={ct.jefatura ?? ""} onChange={(e) => d.setContactos({ ...ct, jefatura: e.target.value })} />
          </label>
          <label className="mt-3 block text-[11px] font-semibold tracking-wider text-muted uppercase">Firma
            <textarea className={`${inp} min-h-[90px]`} value={ct.firma ?? ""} placeholder={"Nombre Apellido\nGerencia Comercial · LYD Cargo"} onChange={(e) => d.setContactos({ ...ct, firma: e.target.value })} />
          </label>
          <p className="mt-3 text-[12px] text-muted">
            Envío directo: <b>{d.emailDirecto ? "habilitado (Resend)" : "no configurado"}</b>. Sin envío directo, el botón abre tu Outlook/Gmail con el borrador listo.
          </p>
        </Card>
      </div>

      <Eyebrow>Datos</Eyebrow>
      {d.datos && (
        <div className="grid gap-3.5 lg:grid-cols-2">
          <Card titulo="Fuente" accion={<Btn peque onClick={exportarHechos}>⇩ CSV de datos</Btn>}>
            <ul className="space-y-1 text-[13px]">
              <li>Origen: <b>{d.datos.fuente === "demo" ? "DEMO (ficticio)" : "Bit ERP"}</b></li>
              <li>Actualizado: {new Date(d.datos.actualizado).toLocaleString("es-CL")}</li>
              <li>Filas recibidas: {num(d.datos.filas)} → {num(d.datos.hechos.length)} hechos agregados</li>
              <li>Anulados excluidos: {num(d.datos.anulados.servicios)} servicios · {clp(d.datos.anulados.venta)}</li>
              <li>Metas: {d.metasLocales ? "editadas en el navegador" : d.datos.metasFuente}</li>
            </ul>
            {d.datos.fuente === "demo" && <div className="mt-3"><Aviso tono="warn">Para conectar Bit ERP define <code>ERP_API_KEY</code> en <code>.env.local</code> (ver README). La clave queda en el servidor, nunca en el navegador.</Aviso></div>}
          </Card>
          <Card titulo="Mapeo de campos detectado" sub="Si algún campo quedó mal, corrígelo con ERP_FIELD_MAP en el servidor.">
            <Tabla>
              <thead><tr><th>Campo</th><th>Columna del ERP</th></tr></thead>
              <tbody>{Object.entries(d.datos.mapeo).map(([k, v]) => <tr key={k}><td>{k}</td><td className="font-mono text-[12px]">{v}</td></tr>)}</tbody>
            </Tabla>
          </Card>
        </div>
      )}

      <Eyebrow>Respaldo</Eyebrow>
      <div className="flex gap-2">
        <Btn onClick={() => descargar("gestion-alertas.json", JSON.stringify({ gestion: d.gestion, contactos: d.contactos, umbrales: d.umbrales, alias: d.alias }, null, 1), "application/json")}>Exportar gestión y configuración</Btn>
      </div>
    </div>
  );
}
