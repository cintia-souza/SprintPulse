import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

type CardColumn = "WENT_WELL" | "IMPROVE" | "ACTION_ITEMS";

export async function POST(req: NextRequest) {
  const guest = await verifySession();
  if (!guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId, column, content } = (await req.json()) as {
    sessionId: string;
    column: CardColumn;
    content: string;
  };

  if (!sessionId || !column || !content?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const card = await prisma.retroCard.create({
    data: {
      sessionId,
      column,
      content: content.trim(),
      author: guest.nickname,
    },
  });

  return NextResponse.json(card, { status: 201 });
}

// GET cards for a session (query param: ?sessionId=xxx)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const cards = await prisma.retroCard.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(cards);
}
