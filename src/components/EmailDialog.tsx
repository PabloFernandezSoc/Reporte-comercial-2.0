"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { TIPO_ALERTA, type Alerta } from "@/lib/analytics";
import { clp, mesLargo } from "@/lib/format";
import { useDatos } from "./DataProvider";
import { Aviso, Btn } from "./ui";

type Plantilla = "ejecutiva" | "cliente" | "jefatura";

const PLANTILLAS: Record<Plantilla, string> = {
  ejecutiva: "Alerta a la ejecutiva",
  cliente: "Seguimiento al cliente",
  jefatura: "Escalar a jefatura",
};

function armar(p: Plantilla, a: Alerta, contacto: string, firma: string) {
  const tipo = TIPO_ALERTA[a.tipo].label;
  if (p === "cliente") {
    const saludo = contacto ? `Estimado/a ${contacto}:` : "Estimados:";
    const cuerpoTipo =
      a.tipo === "nuevo"
        ? "Queremos agradecer la confianza en LYD Cargo para sus primeros servicios con nosotros y saber cómo fue su experiencia."
        : a.tipo === "alza"
          ? "Hemos visto un aumento importante en su operación con nosotros y queremos asegurar la capacidad y el nivel de servicio que necesitan para los próximos meses."
          : "Les escribo para hacer seguimiento de su operación con LYD Cargo. Queremos asegurarnos de que el servicio esté a la altura de lo que necesitan y conocer sus planes de carga para las próximas semanas.";
    return {
      asunto: "LYD Cargo · Seguimiento de su operación",
      cuerpo: `${saludo}\n\n${cuerpoTipo}\n\n¿Podríamos coordinar una llamada breve esta semana? Si hay algo que podamos mejorar en tarifas, coordinación o tiempos, nos interesa mucho saberlo.\n\nQuedo atenta.\n\n${firma || "Equipo comercial LYD Cargo"}`,
    };
  }
  const datos = `Cliente: ${a.cliente}\nSegmento: ${a.segmento}\nMes analizado: ${mesLargo(a.periodo)}\nTipo: ${tipo}\nImpacto estimado: ${clp(a.impacto)}${a.confianza ? `\nProbabilidad de que no sea fluctuación normal: ${a.confianza >= 0.99 ? "≥99" : Math.round(a.confianza * 100)}%` : ""}\n\nDiagnóstico: ${a.diag}\n${a.evidencia.map((e) => `- ${e}`).join("\n")}\n\nAcción sugerida: ${a.accion}`;
  if (p === "jefatura") {
    return {
      asunto: `[Escalamiento] ${tipo} · ${a.cliente}`,
      cuerpo: `Hola,\n\nEscalo esta alerta comercial para revisión y apoyo:\n\n${datos}\n\nResponsable: ${a.ejecutiva || "sin asignar"}\n\n${firma}`,
    };
  }
  return {
    asunto: `[Alerta comercial] ${tipo} · ${a.cliente}`,
    cuerpo: `Hola ${a.ejecutiva?.split(" ")[0] || ""},\n\nEl sistema detectó una situación que requiere gestión:\n\n${datos}\n\nPor favor registra el resultado de la gestión en la bitácora de la alerta.\n\n${firma}`,
  };
}

export function EmailDialog({ alerta: a, onClose }: { alerta: Alerta; onClose: () => void }) {
  const d = useDatos();
  const ref = useRef<HTMLDialogElement>(null);
  const [pl, setPl] = useState<Plantilla>(a.tipo === "nuevo" || a.tipo === "alza" ? "cliente" : "ejecutiva");
  const cc = d.contactos.clientes[a.cliente] ?? {};
  const base = useMemo(() => armar(pl, a, cc.contacto ?? "", d.contactos.firma ?? ""), [pl, a, cc.contacto, d.contactos.firma]);
  const paraDef = pl === "cliente" ? cc.correo ?? "" : pl === "jefatura" ? d.contactos.jefatura ?? "" : d.contactos.ejecutivas[a.ejecutiva] ?? "";
  const [para, setPara] = useState(paraDef);
  const [asunto, setAsunto] = useState(base.asunto);
  const [cuerpo, setCuerpo] = useState(base.cuerpo);
  const [msg, setMsg] = useState<{ t: "info" | "err"; s: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    setPara(paraDef);
    setAsunto(base.asunto);
    setCuerpo(base.cuerpo);
  }, [base, paraDef]);

  const registrar = (via: string) =>
    d.gestionar(a.id, { estado: (d.gestion[a.id]?.estado ?? "nueva") === "nueva" ? "gestion" : d.gestion[a.id]!.estado }, `Correo "${PLANTILLAS[pl]}" a ${para || "(sin destinatario)"} ${via}`);

  const abrirCliente = () => {
    // los clientes de correo aceptan URLs mailto acotadas: se recorta el cuerpo antes de codificar
    const corto = cuerpo.length > 1400 ? `${cuerpo.slice(0, 1400)}\n[…]` : cuerpo;
    window.location.href = `mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(corto)}`;
    registrar("(borrador en cliente de correo)");
  };

  const enviar = async () => {
    setEnviando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ para, asunto, cuerpo }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      registrar("(enviado)");
      setMsg({ t: "info", s: "Correo enviado." });
    } catch (e) {
      setMsg({ t: "err", s: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  };

  const campo = "mt-0.5 w-full rounded border border-line px-2.5 py-1.5 text-[13px] font-normal tracking-normal normal-case text-ink focus:outline-2 focus:outline-venta";
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[94vw] max-w-[720px] rounded border border-line p-0 shadow-2xl backdrop:bg-ink/50">
      <div className="flex items-center justify-between border-b border-line bg-[#F5F8F7] px-5 py-3.5">
        <h3 className="font-display text-lg font-semibold">Correo · {a.cliente}</h3>
        <Btn peque onClick={() => ref.current?.close()}>Cerrar</Btn>
      </div>
      <div className="max-h-[68vh] space-y-3 overflow-auto px-5 py-4">
        <div className="flex flex-wrap gap-1">
          {(Object.keys(PLANTILLAS) as Plantilla[]).map((k) => (
            <button key={k} onClick={() => setPl(k)} className={`cursor-pointer rounded border px-2.5 py-1 text-xs ${pl === k ? "border-ink bg-ink text-white" : "border-line"}`}>
              {PLANTILLAS[k]}
            </button>
          ))}
        </div>
        <label className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
          Para
          <input className={campo} value={para} onChange={(e) => setPara(e.target.value)} placeholder="correo@empresa.cl (configura los correos en Configuración)" />
        </label>
        <label className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
          Asunto
          <input className={campo} value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        </label>
        <label className="block text-[11px] font-semibold tracking-wider text-muted uppercase">
          Mensaje
          <textarea className={`${campo} min-h-[240px] font-sans normal-case`} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} />
        </label>
        {msg && <Aviso tono={msg.t}>{msg.s}</Aviso>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-[#F5F8F7] px-5 py-3">
        <Btn onClick={() => { navigator.clipboard?.writeText(`${asunto}\n\n${cuerpo}`); setMsg({ t: "info", s: "Copiado al portapapeles." }); }}>Copiar</Btn>
        <Btn onClick={abrirCliente}>Abrir en mi correo</Btn>
        {d.emailDirecto && <Btn primario disabled={enviando || !para} onClick={enviar}>{enviando ? "Enviando…" : "Enviar ahora"}</Btn>}
      </div>
    </dialog>
  );
}
