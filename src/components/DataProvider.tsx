"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  analizarClientes,
  construirModelo,
  generarAlertas,
  type Alerta,
  type AnalisisCliente,
  type Filtros,
  type Modelo,
} from "@/lib/analytics";
import { UMBRALES_DEF, type Umbrales } from "@/lib/anomaly";
import { sumarMes } from "@/lib/format";
import { usePersistente } from "@/lib/storage";
import type { Metas, RespuestaDatos } from "@/lib/types";

export type EstadoAlerta = "nueva" | "gestion" | "resuelta" | "descartada";

export interface GestionAlerta {
  estado: EstadoAlerta;
  responsable?: string;
  nota?: string;
  historial: { t: string; txt: string }[];
}

export interface Contactos {
  ejecutivas: Record<string, string>; // nombre → correo
  clientes: Record<string, { correo?: string; contacto?: string }>;
  jefatura?: string;
  firma?: string;
}

interface Ctx {
  datos: RespuestaDatos | null;
  cargando: boolean;
  error: string | null;
  refrescar: () => void;
  modelo: Modelo | null;
  metas: Metas | null;
  metasLocales: boolean;
  setMetas: (m: Metas | null) => void;
  alias: Record<string, string>;
  setAlias: (a: Record<string, string>) => void;
  filtros: Filtros;
  setFiltros: (f: Partial<Filtros>) => void;
  limpiarFiltros: () => void;
  umbrales: Umbrales;
  setUmbrales: (u: Umbrales) => void;
  mesAnalisis: string;
  setMesAnalisis: (p: string) => void;
  analisis: AnalisisCliente[];
  alertas: Alerta[];
  gestion: Record<string, GestionAlerta>;
  gestionar: (id: string, cambio: Partial<GestionAlerta>, txt: string) => void;
  contactos: Contactos;
  setContactos: (c: Contactos) => void;
  emailDirecto: boolean;
}

const C = createContext<Ctx | null>(null);

export function useDatos() {
  const c = useContext(C);
  if (!c) throw new Error("useDatos fuera de DataProvider");
  return c;
}

const F0: Filtros = { desde: "", hasta: "", segmento: "", ejecutiva: "", etapa: "", buscar: "" };

export function DataProvider({ children }: { children: ReactNode }) {
  const [datos, setDatos] = useState<RespuestaDatos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metasLoc, setMetasLoc] = usePersistente<Metas | null>("lyd2_metas", null);
  const [alias, setAlias] = usePersistente<Record<string, string>>("lyd2_alias", {});
  const [umbrales, setUmbrales] = usePersistente<Umbrales>("lyd2_umbrales", UMBRALES_DEF);
  const [filtros, setF] = usePersistente<Filtros>("lyd2_filtros", F0);
  const [mesSel, setMesAnalisis] = useState("");
  const [gestion, setGestion] = usePersistente<Record<string, GestionAlerta>>("lyd2_gestion", {});
  const [contactos, setContactos] = usePersistente<Contactos>("lyd2_contactos", { ejecutivas: {}, clientes: {} });
  const [emailDirecto, setEmailDirecto] = useState(false);

  const cargar = useCallback(async (forzar: boolean) => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch(`/api/datos${forzar ? "?refresh=1" : ""}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Error ${r.status}`);
      setDatos(j);
      try {
        localStorage.setItem("lyd2_snapshot", JSON.stringify(j));
      } catch {
        /* sin espacio: se omite la copia local */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      try {
        const s = localStorage.getItem("lyd2_snapshot");
        if (s) setDatos(JSON.parse(s));
      } catch {
        /* sin copia */
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(false);
    fetch("/api/email").then((r) => r.json()).then((j) => setEmailDirecto(!!j.habilitado)).catch(() => {});
  }, [cargar]);

  const metas = metasLoc ?? datos?.metas ?? null;
  const modelo = useMemo(() => (datos ? construirModelo(datos, metas, alias) : null), [datos, metas, alias]);

  // por defecto: el último mes cerrado dentro del filtro "hasta"
  const mesAnalisis = useMemo(() => {
    if (!modelo) return "";
    if (mesSel) return mesSel;
    const tope = filtros.hasta && filtros.hasta < modelo.mesCerrado ? filtros.hasta : modelo.mesCerrado;
    return tope;
  }, [modelo, mesSel, filtros.hasta]);

  const analisis = useMemo(
    () => (modelo && mesAnalisis ? analizarClientes(modelo, filtros, mesAnalisis, umbrales) : []),
    [modelo, filtros, mesAnalisis, umbrales],
  );
  const alertas = useMemo(() => (modelo ? generarAlertas(modelo, analisis, mesAnalisis, umbrales) : []), [modelo, analisis, mesAnalisis, umbrales]);

  const gestionar = useCallback(
    (id: string, cambio: Partial<GestionAlerta>, txt: string) => {
      setGestion((g) => {
        const prev = g[id] ?? { estado: "nueva", historial: [] };
        return { ...g, [id]: { ...prev, ...cambio, historial: [...prev.historial, { t: new Date().toISOString(), txt }] } };
      });
    },
    [setGestion],
  );

  // filtros por defecto: últimos 12 meses cerrados + mes en curso
  useEffect(() => {
    if (modelo && !filtros.desde && !filtros.hasta) {
      setF({ ...filtros, desde: sumarMes(modelo.mesCerrado, -11), hasta: modelo.mesActual });
    }
  }, [modelo]); // eslint-disable-line react-hooks/exhaustive-deps

  const value: Ctx = {
    datos,
    cargando,
    error,
    refrescar: () => cargar(true),
    modelo,
    metas,
    metasLocales: !!metasLoc,
    setMetas: setMetasLoc,
    alias,
    setAlias,
    filtros,
    setFiltros: (f) => setF((prev) => ({ ...prev, ...f })),
    limpiarFiltros: () => modelo && setF({ ...F0, desde: sumarMes(modelo.mesCerrado, -11), hasta: modelo.mesActual }),
    umbrales,
    setUmbrales,
    mesAnalisis,
    setMesAnalisis,
    analisis,
    alertas,
    gestion,
    gestionar,
    contactos,
    setContactos,
    emailDirecto,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
