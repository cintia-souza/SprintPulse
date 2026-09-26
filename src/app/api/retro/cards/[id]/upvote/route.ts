import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guest = await verifySession();
  if (!guest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const card = await prisma.retroCard.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mesmas regras do voto na sala: sem elas isto aqui era um incremento infinito.
  if (!card.session.votingOpen || !card.session.revealedColumns.includes(card.column)) {
    return NextResponse.json({ error: "Votação fechada" }, { status: 409 });
  }

  const player = await prisma.retroPlayer.findUnique({
    where: {
      sessionId_nickname: { sessionId: card.sessionId, nickname: guest.nickname },
    },
  });
  if (!player) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (player.votesRemaining <= 0 || player.votedCardIds.includes(id)) {
    return NextResponse.json({ error: "Sem votos disponíveis" }, { status: 409 });
  }

  const [updated] = await prisma.$transaction([
    prisma.retroCard.update({
      where: { id },
      data: { votes: { increment: 1 } },
    }),
    prisma.retroPlayer.update({
      where: { id: player.id },
      data: {
        votesRemaining: { decrement: 1 },
        votedCardIds: { push: id },
      },
    }),
  ]);

  return NextResponse.json(
    { id: updated.id, votes: updated.votes },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
