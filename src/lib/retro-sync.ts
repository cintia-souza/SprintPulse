import { prisma } from "@/lib/prisma";
import { RetroRoom, CardColumn } from "@/lib/retro-store";

// Persiste o estado da retro no Neon quando a votação é encerrada
export async function persistRetro(roomId: string, room: RetroRoom, squad?: string) {
  const session = await prisma.retroSession.upsert({
    where: { roomId },
    create: {
      roomId,
      squad: squad || "default",
      phase: room.phase,
      revealedColumns: room.revealedColumns,
      closedAt: room.phase === "done" ? new Date() : null,
    },
    update: {
      phase: room.phase,
      revealedColumns: room.revealedColumns,
      closedAt: room.phase === "done" ? new Date() : null,
    },
  });

  // Deletar cards antigos e recriar com votos atualizados
  await prisma.retroCard.deleteMany({ where: { sessionId: session.id } });

  if (room.cards.length > 0) {
    await prisma.retroCard.createMany({
      data: room.cards.map((card) => ({
        sessionId: session.id,
        column: card.column as CardColumn,
        content: card.content,
        author: card.author,
        votes: card.votes,
        completed: card.completed ?? false,
        migratedTo: card.migratedTo ?? null,
      })),
    });
  }

  return session;
}

// Carrega uma retro do banco (para sessões já finalizadas ou em andamento)
export async function loadRetroFromDB(roomId: string): Promise<RetroRoom | null> {
  const session = await prisma.retroSession.findUnique({
    where: { roomId },
    include: { cards: { orderBy: { votes: "desc" } } },
  });

  if (!session) return null;

  return {
    squad: session.squad,
    players: [],
    cards: session.cards.map((c) => ({
      id: c.id,
      column: c.column as CardColumn,
      content: c.content,
      author: c.author,
      votes: c.votes,
      completed: c.completed,
      migratedTo: c.migratedTo,
    })),
    revealedColumns: session.revealedColumns as CardColumn[],
    votingOpen: session.phase === "voting",
    phase: session.phase as RetroRoom["phase"],
  };
}
