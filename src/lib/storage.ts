"use client";
import { useCallback, useEffect, useState } from "react";

/** Estado persistido en localStorage, tolerante a navegadores sin almacenamiento. */
export function usePersistente<T>(clave: string, inicial: T): [T, (v: T | ((prev: T) => T)) => void, boolean] {
  const [valor, setValor] = useState<T>(inicial);
  const [listo, setListo] = useState(false);
  useEffect(() => {
    try {
      const s = localStorage.getItem(clave);
      if (s != null) setValor(JSON.parse(s));
    } catch {
      /* sin almacenamiento */
    }
    setListo(true);
  }, [clave]);
  const set = useCallback(
    (v: T | ((prev: T) => T)) => {
      setValor((prev) => {
        const nuevo = typeof v === "function" ? (v as (p: T) => T)(prev) : v;
        try {
          localStorage.setItem(clave, JSON.stringify(nuevo));
        } catch {
          /* sin almacenamiento */
        }
        return nuevo;
      });
    },
    [clave],
  );
  return [valor, set, listo];
}

export function descargar(nombre: string, contenido: string, tipo = "text/plain") {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
