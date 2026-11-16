import assert from "node:assert/strict";
import { test } from "node:test";
import { analizarClientes, construirModelo, generarAlertas } from "../src/lib/analytics";
import { analizarSerie, diagnosticar, UMBRALES_DEF } from "../src/lib/anomaly";
import { generarDemo } from "../src/lib/demo";
import { aFecha, aNumero, normalizar } from "../src/lib/normalize";
import type { RespuestaDatos } from "../src/lib/types";

const P = Array.from({ length: 18 }, (_, i) => `2025-${String((i % 12) + 1).padStart(2, "0")}`).map((p, i) => (i >= 12 ? p.replace("2025", "2026") : p));

test("una caída dentro de la variación habitual de un cliente volátil es normal", () => {
  const v = [100, 60, 140, 80, 150, 70, 120, 55, 145, 90, 130, 65, 125, 75, 150, 60, 135, 72].map((x) => x * 1e6);
  const a = analizarSerie(P, v);
  const d = diagnosticar(a, v.length - 1, UMBRALES_DEF);
  assert.equal(d.diag, "normal");
});

test("la misma caída en un cliente estable es anómala", () => {
  const v = [100, 102, 98, 101, 99, 103, 100, 97, 101, 100, 102, 99, 101, 100, 98, 102, 100, 55].map((x) => x * 1e6);
  const a = analizarSerie(P, v);
  const d = diagnosticar(a, v.length - 1, UMBRALES_DEF);
  assert.equal(d.diag, "caida-significativa");
  assert.ok(d.confianza > 0.99);
});

test("venta cero en cliente recurrente es fuga", () => {
  const v = [50, 52, 48, 51, 49, 53, 50, 47, 51, 50, 52, 49, 51, 50, 48, 52, 50, 0].map((x) => x * 1e6);
  const d = diagnosticar(analizarSerie(P, v), v.length - 1, UMBRALES_DEF);
  assert.equal(d.diag, "fuga");
});

test("parseo de números y fechas del ERP", () => {
  assert.equal(aNumero("1.234.567"), 1234567);
  assert.equal(aNumero("1.234,5"), 1234.5);
  assert.deepEqual(aFecha("15/03/2026"), ["2026-03", "2026-03-15"]);
  assert.deepEqual(aFecha("2026-03-15T10:00:00"), ["2026-03", "2026-03-15"]);
});

test("demo: el detector encuentra los escenarios sembrados y no alerta al volátil", () => {
  const hoy = "2026-11-16";
  const demo = generarDemo(hoy);
  const n = normalizar(demo.filas);
  assert.ok(n.mapeo.cliente && n.mapeo.venta && n.mapeo.idExtracosto, "mapeo automático");
  const datos: RespuestaDatos = {
    fuente: "demo", actualizado: "", hoy, filas: n.filas, mapeo: n.mapeo, avisos: [], hechos: n.hechos,
    ultimaFecha: n.ultimaFecha, metas: demo.metas, metasFuente: "demo", anulados: n.anulados,
  };
  const M = construirModelo(datos, demo.metas, {});
  const F = { desde: "", hasta: "", segmento: "", ejecutiva: "", etapa: "" as const, buscar: "" };
  const an = analizarClientes(M, F, M.mesCerrado, UMBRALES_DEF);
  const al = generarAlertas(M, an, M.mesCerrado, UMBRALES_DEF);
  const tipos = (c: string) => al.filter((a) => a.cliente === c).map((a) => a.tipo);
  assert.ok(tipos("Trans Ruta Internacional").includes("fuga"));
  assert.ok(tipos("Agroexport Rancagua").includes("fuga"));
  assert.ok(tipos("Pacific Cargo Logistics").includes("caida"));
  assert.ok(!tipos("Global Link Transitarios").some((t) => t === "caida" || t === "fuga"));
  assert.ok(!tipos("Proyecto Minero Altiplano").some((x) => x === "fuga" || x === "caida"), "esporádico sin carga no alerta");
  assert.ok(tipos("Oceanic Brokers Ltda").includes("tendencia"), "tendencia gradual");
  assert.ok(tipos("Retail Hub Santiago").includes("caida"));
});
