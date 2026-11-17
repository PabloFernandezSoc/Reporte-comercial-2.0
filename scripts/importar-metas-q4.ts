/**
 * Mezcla la "Propuesta metas Q4" (Excel) en el archivo privado de metas.
 *
 *   npm run metas:q4 -- "ruta/Propuesta metas Q4.xlsx" [anio]
 *
 * Lee:
 *  - Hoja "CARTERA CD": meta Oct/Nov/Dic por cliente, calificación y ejecutiva.
 *    Las filas de control bajo "TOTALES" dan la meta del segmento CD ("Total proyectado").
 *  - Hoja "Cartera FFWW": bloque "META PROPUESTA Q4" (meta FFWW por mes) y "Total carteras" (plan general).
 * Escribe data/private/metas.json (ignorado por git) o la ruta de METAS_PATH.
 */
import ExcelJS from "exceljs";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { clave } from "../src/lib/metas";
import type { MetaCliente, Metas } from "../src/lib/types";

type Celda = ExcelJS.CellValue;
const val = (c: Celda): unknown => {
  if (c && typeof c === "object") {
    const o = c as { result?: unknown; text?: string; richText?: { text: string }[] };
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return o.text;
    return null;
  }
  return c;
};
const numero = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
const texto = (v: unknown) => String(v ?? "").trim();

async function main() {
  const archivo = process.argv[2];
  const anio = process.argv[3] || "2026";
  if (!archivo) throw new Error('Uso: npm run metas:q4 -- "Propuesta metas Q4.xlsx" [anio]');
  const P = [`${anio}-10`, `${anio}-11`, `${anio}-12`];
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);

  /* ---- CD por cliente ---- */
  const cd = wb.getWorksheet("CARTERA CD");
  if (!cd) throw new Error('No existe la hoja "CARTERA CD"');
  const cab = (cd.getRow(1).values as Celda[]).slice(1).map((c) => texto(val(c)).toLowerCase());
  const col = (n: string) => {
    const i = cab.findIndex((h) => h === n.toLowerCase());
    if (i < 0) throw new Error(`Falta la columna "${n}" en CARTERA CD`);
    return i + 1;
  };
  const cCli = col("Cliente"), cCal = col("Calificación"), cEje = col("Ejecutiva");
  const cMes = [col("Meta Oct"), col("Meta Nov"), col("Meta Dic")];
  const clientesCD: { c: string; cal: string; x: string; m: number[] }[] = [];
  const segCD: number[] = [0, 0, 0];
  let enControl = false;
  cd.eachRow((r, i) => {
    if (i === 1) return;
    const nombre = texto(val(r.getCell(cCli).value));
    if (!nombre) return;
    if (/^TOTALES$/i.test(nombre)) { enControl = true; return; }
    if (enControl) {
      if (/total proyectado/i.test(nombre)) cMes.forEach((c, k) => (segCD[k] = numero(val(r.getCell(c).value))));
      return;
    }
    clientesCD.push({ c: nombre, cal: texto(val(r.getCell(cCal).value)), x: texto(val(r.getCell(cEje).value)), m: cMes.map((c) => numero(val(r.getCell(c).value))) });
  });

  /* ---- FFWW y total desde el bloque de resumen ---- */
  const ff = wb.getWorksheet("Cartera FFWW");
  if (!ff) throw new Error('No existe la hoja "Cartera FFWW"');
  const segFF: number[] = [];
  const general: number[] = [];
  let enQ4 = false;
  ff.eachRow((r) => {
    const t = texto(val(r.getCell(2).value));
    if (/META PROPUESTA Q4/i.test(t)) enQ4 = true;
    if (enQ4 && /^META FFWW$/i.test(t)) segFF.push(numero(val(r.getCell(5).value)));
    if (/^(Oct|Nov|Dic)$/i.test(t)) general.push(numero(val(r.getCell(3).value)));
  });
  if (segFF.length !== 3 || general.length !== 3) throw new Error(`No se encontró el bloque Q4 completo (FFWW=${segFF.length}, total=${general.length})`);
  const cuadre = general.map((g, k) => g - segFF[k] - segCD[k]);
  if (cuadre.some((d) => Math.abs(d) > 1)) console.warn("⚠ El total no cuadra con FFWW + CD:", cuadre);

  /* ---- mezcla ---- */
  const ruta = process.env.METAS_PATH || path.join(process.cwd(), "data", "private", "metas.json");
  const metas: Metas = existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : { general: {}, seg: {}, clientes: [] };
  P.forEach((p, k) => {
    metas.general[p] = general[k];
    (metas.seg.FFWW ||= {})[p] = segFF[k];
    (metas.seg.CD ||= {})[p] = segCD[k];
  });
  const idx = new Map<string, MetaCliente>();
  metas.clientes.forEach((o) => { const k = clave(o.c); if (!idx.has(k)) idx.set(k, o); });
  let actualizados = 0, nuevos = 0;
  for (const q of clientesCD) {
    let o = idx.get(clave(q.c));
    if (!o) {
      o = { c: q.c.toUpperCase(), s: "CD", m: {} };
      metas.clientes.push(o);
      idx.set(clave(q.c), o);
      nuevos++;
    } else actualizados++;
    P.forEach((p, k) => { if (q.m[k]) o!.m[p] = q.m[k]; else delete o!.m[p]; });
    if (q.cal) o.cal = q.cal.replace(/\s+/g, " ").trim();
    if (q.x) o.x = q.x;
  }
  metas.q4 = { archivo: path.basename(archivo), importado: new Date().toISOString(), periodos: P };
  mkdirSync(path.dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(metas));
  const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");
  console.log(`Metas Q4 ${anio} mezcladas en ${ruta}`);
  console.log(`  General: ${general.map(fmt).join(" · ")}`);
  console.log(`  FFWW:    ${segFF.map(fmt).join(" · ")}`);
  console.log(`  CD:      ${segCD.map(fmt).join(" · ")}`);
  console.log(`  Clientes CD: ${actualizados} actualizados, ${nuevos} nuevos`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
