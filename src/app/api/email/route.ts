import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Indica si el envío directo está habilitado (si no, la app usa el cliente de correo del usuario). */
export async function GET() {
  return NextResponse.json({ habilitado: !!process.env.RESEND_API_KEY });
}

/** Envía un correo con Resend (https://resend.com). Requiere RESEND_API_KEY y EMAIL_FROM. */
export async function POST(req: Request) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "Envío directo no configurado (RESEND_API_KEY)." }, { status: 501 });
  const { para, cc, asunto, cuerpo } = (await req.json()) as { para?: string; cc?: string; asunto?: string; cuerpo?: string };
  const lista = (s?: string) => (s || "").split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const to = lista(para);
  if (!to.length || !asunto || !cuerpo) return NextResponse.json({ error: "Faltan destinatario, asunto o cuerpo." }, { status: 400 });
  if (to.some((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) return NextResponse.json({ error: "Correo de destino inválido." }, { status: 400 });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to, cc: lista(cc), subject: asunto, text: cuerpo }),
  });
  if (!res.ok) return NextResponse.json({ error: `El proveedor de correo respondió ${res.status}` }, { status: 502 });
  return NextResponse.json({ ok: true });
}
