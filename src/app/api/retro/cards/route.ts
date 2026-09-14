import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth";
import { toPublicCard } from "@/lib/retro-visibility";

const COLUMNS = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"] as const;
type Column = (typeof COLUMNS)[number];

function isColumn(value: unknown): value is Column {
  return typeof value === "string" && (COLUMNS as readonly string[]).includes(value);
}

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; column?: unknown; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  const { sessionId, column, content } = body;

  if (!sessionId || !isColumn(column) || !content?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const viewer = await getViewer(sessionId);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Só quem entrou na retro pode escrever nela.
  const player = await prisma.retroPlayer.findUnique({
    where: { sessionId_nickname: { sessionId, nickname: viewer.nickname } },
  });
  if (!player) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const card = await prisma.retroCard.create({
    data: {
      sessionId,
      column,
      content: content.trim().slice(0, 500),
      authorKey: viewer.authorKey,
    },
  });

  return NextResponse.json(
    { id: card.id, column: card.column, content: card.content, votes: card.votes, isMine: true },
    { status: 201, headers: NO_STORE }
  );
}

// GET cards for a session (query param: ?sessionId=xxx)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const viewer = await getViewer(sessionId);
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.retroSession.findUnique({
    where: { id: sessionId },
    include: { cards: { orderBy: { createdAt: "desc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const player = await prisma.retroPlayer.findUnique({
    where: { sessionId_nickname: { sessionId, nickname: viewer.nickname } },
  });
  if (!player) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Mesma regra da sala: sem authorKey na resposta e sem texto de card virado.
  const cards = session.cards.map((c) =>
    toPublicCard(c, session.revealedColumns, viewer.authorKey)
  );

  return NextResponse.json(cards, { headers: NO_STORE });
}
