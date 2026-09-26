import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifySession, COOKIE_NAME } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  let body: { nickname?: string };
  try {
    body = (await req.json()) as { nickname?: string };
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const nickname = body.nickname?.trim() ?? "";
  if (nickname.length < 2 || nickname.length > 30) {
    return NextResponse.json(
      { error: "Apelido deve ter entre 2 e 30 caracteres" },
      { status: 400 }
    );
  }

  // Reaproveita o uid de uma sessão válida do mesmo apelido: é ele que define a
  // autoria dos cards, então trocá-lo a cada re-join faria o "seu card" sumir.
  const existing = await verifySession();
  const uid = existing?.nickname === nickname && existing.uid ? existing.uid : randomUUID();

  const token = await createSessionToken({ nickname, uid });

  const res = NextResponse.json({ nickname });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 horas
    path: "/",
  });

  return res;
}
