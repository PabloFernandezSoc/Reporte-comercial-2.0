import { NextResponse } from "next/server";
import { obtenerDatos } from "@/lib/server/fuente";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const forzar = new URL(req.url).searchParams.get("refresh") === "1";
  try {
    const data = await obtenerDatos(forzar);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `No se pudo consultar el ERP: ${msg}` }, { status: 502 });
  }
}
