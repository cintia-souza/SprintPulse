import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const { nickname } = (await req.json()) as { nickname?: string };

  if (!nickname || nickname.trim().length < 2) {
    return NextResponse.json(
      { error: "Nickname must be at least 2 characters" },
      { status: 400 }
    );
  }

  const uid = randomUUID().slice(0, 8);
  const token = await createSessionToken({ nickname: nickname.trim(), uid });

  const res = NextResponse.json({ nickname: nickname.trim(), uid });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });

  return res;
}
