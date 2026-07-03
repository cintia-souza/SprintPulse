import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getOrCreateSession(roomId: string) {
  return prisma.retroSession.upsert({
    where: { roomId },
    create: { roomId, revealedColumns: ["ACTION_ITEMS"] },
    update: {},
    include: { players: true, cards: { orderBy: { createdAt: "asc" } } },
  });
}

function formatRoom(
  session: Awaited<ReturnType<typeof getOrCreateSession>>,
  requesterNickname?: string
) {
  const revealedColumns = session.revealedColumns;

  return {
    players: session.players.map((p) => ({
      nickname: p.nickname,
      role: p.role,
      votesRemaining: p.votesRemaining,
      votedCardIds: p.votedCardIds,
    })),
    cards: session.cards.map((c) => {
      const isRevealed = revealedColumns.includes(c.column);
      const isMine = requesterNickname && c.author === requesterNickname;
      // ACTION_ITEMS sempre visível; demais só após revelar ou se for do próprio autor
      const canSee = c.column === "ACTION_ITEMS" || isRevealed || isMine;
      return {
        id: c.id,
        column: c.column,
        content: canSee ? c.content : null,   // null = card oculto
        author: canSee ? c.author : null,      // null = anônimo
        votes: c.votes,
        completed: c.completed,
        migratedTo: c.migratedTo,
      };
    }),
    revealedColumns,
    votingOpen: session.votingOpen,
    phase: session.phase,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Nickname passado como query param para mascarar cards no GET
  const nickname = req.nextUrl.searchParams.get("nickname") || undefined;
  const session = await getOrCreateSession(id);
  return NextResponse.json(formatRoom(session, nickname));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Ensure session exists
  const session = await getOrCreateSession(id);

  switch (body.action) {
    case "join": {
      const { nickname, role, squad } = body as { nickname: string; role: string; squad?: string };
      if (!nickname || nickname.trim().length < 1) break;
      const cleanNick = nickname.trim().slice(0, 30);
      const validRole = role === "host" ? "host" : "member";

      // Primeiro a entrar deve ser host
      if (session.players.length === 0 && validRole !== "host") {
        return NextResponse.json(
          { error: "Somente o Host (PM/TL) pode criar a sala" },
          { status: 403 }
        );
      }
      // Máximo 2 hosts por sala
      const hostCount = session.players.filter((p) => p.role === "host").length;
      if (validRole === "host" && hostCount >= 2) {
        const isRejoin = session.players.some((p) => p.nickname === cleanNick && p.role === "host");
        if (!isRejoin) {
          return NextResponse.json(
            { error: "Já existem 2 Hosts nesta sala (limite máximo)" },
            { status: 403 }
          );
        }
      }

      if (squad && session.players.length === 0) {
        await prisma.retroSession.update({
          where: { id: session.id },
          data: { squad: squad.slice(0, 50) },
        });
      }

      await prisma.retroPlayer.upsert({
        where: { sessionId_nickname: { sessionId: session.id, nickname: cleanNick } },
        create: { sessionId: session.id, nickname: cleanNick, role: validRole },
        update: {},
      });
      break;
    }

    case "transfer-host": {
      // Um host passa o papel de host para um membro
      const { fromNickname, toNickname } = body as { fromNickname: string; toNickname: string };
      const requester = session.players.find((p) => p.nickname === fromNickname && p.role === "host");
      const target = session.players.find((p) => p.nickname === toNickname);
      if (!requester || !target) break;
      // Rebaixa quem transfere para membro, promove o alvo para host
      await prisma.$transaction([
        prisma.retroPlayer.update({
          where: { id: requester.id },
          data: { role: "member" },
        }),
        prisma.retroPlayer.update({
          where: { id: target.id },
          data: { role: "host" },
        }),
      ]);
      break;
    }

    case "promote-to-host": {
      // Um host promove um membro a host (sem perder o próprio papel)
      const { fromNickname, toNickname } = body as { fromNickname: string; toNickname: string };
      const requester = session.players.find((p) => p.nickname === fromNickname && p.role === "host");
      const target = session.players.find((p) => p.nickname === toNickname && p.role === "member");
      if (!requester || !target) break;
      const hostCount = session.players.filter((p) => p.role === "host").length;
      if (hostCount >= 2) {
        return NextResponse.json(
          { error: "Já existem 2 Hosts nesta sala" },
          { status: 400 }
        );
      }
      await prisma.retroPlayer.update({
        where: { id: target.id },
        data: { role: "host" },
      });
      break;
    }

    case "add-card": {
      const { nickname, column, content } = body as { nickname: string; column: string; content: string };
      const validColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      if (!validColumns.includes(column) || !content?.trim()) break;
      await prisma.retroCard.create({
        data: {
          sessionId: session.id,
          column: column as "WENT_WELL" | "IMPROVE" | "ACTION_ITEMS",
          content: content.trim().slice(0, 500),
          author: (nickname || "").trim().slice(0, 30),
        },
      });
      break;
    }

    case "edit-card": {
      const { nickname, cardId, content } = body as { nickname: string; cardId: string; content: string };
      const card = session.cards.find((c) => c.id === cardId);
      // Só o autor pode editar, e apenas antes de ser revelado
      if (!card || card.author !== nickname.trim()) break;
      if (session.revealedColumns.includes(card.column)) break;
      if (!content?.trim()) break;
      await prisma.retroCard.update({
        where: { id: cardId },
        data: { content: content.trim().slice(0, 500) },
      });
      break;
    }

    case "delete-card": {
      const { nickname, cardId } = body as { nickname: string; cardId: string };
      const card = session.cards.find((c) => c.id === cardId);
      // Só o autor pode excluir, e apenas antes de ser revelado
      if (!card || card.author !== nickname.trim()) break;
      if (session.revealedColumns.includes(card.column)) break;
      await prisma.retroCard.delete({ where: { id: cardId } });
      break;
    }

    case "reveal-column": {
      const { column } = body as { column: string };
      const current = session.revealedColumns;
      if (!current.includes(column)) {
        await prisma.retroSession.update({
          where: { id: session.id },
          data: {
            revealedColumns: [...current, column],
            votingOpen: true,
            phase: "voting",
          },
        });
      }
      break;
    }

    case "reveal-all": {
      await prisma.retroSession.update({
        where: { id: session.id },
        data: {
          revealedColumns: ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"],
          votingOpen: true,
          phase: "voting",
        },
      });
      break;
    }

    case "vote": {
      const { nickname, cardId } = body as { nickname: string; cardId: string };
      const player = session.players.find((p) => p.nickname === nickname);
      const card = session.cards.find((c) => c.id === cardId);
      if (!player || !card || !session.votingOpen) break;
      if (player.votesRemaining <= 0 || player.votedCardIds.includes(cardId)) break;
      if (!session.revealedColumns.includes(card.column)) break;

      // Transação atômica para voto
      await prisma.$transaction([
        prisma.retroCard.update({
          where: { id: cardId },
          data: { votes: { increment: 1 } },
        }),
        prisma.retroPlayer.update({
          where: { id: player.id },
          data: {
            votesRemaining: { decrement: 1 },
            votedCardIds: { push: cardId },
          },
        }),
      ]);
      break;
    }

    case "close-voting": {
      const minRevealed = session.revealedColumns.includes("WENT_WELL") &&
        session.revealedColumns.includes("IMPROVE");
      if (!minRevealed) {
        return NextResponse.json(
          { error: "Revele pelo menos os pilares 'O que foi bem' e 'O que pode melhorar'" },
          { status: 400 }
        );
      }
      await prisma.retroSession.update({
        where: { id: session.id },
        data: { votingOpen: false, phase: "done", closedAt: new Date() },
      });
      break;
    }

    case "toggle-action-complete": {
      const { cardId } = body as { cardId: string };
      const card = session.cards.find((c) => c.id === cardId && c.column === "ACTION_ITEMS");
      if (card) {
        await prisma.retroCard.update({
          where: { id: cardId },
          data: { completed: !card.completed },
        });
      }
      break;
    }

    case "migrate-action": {
      const { cardId, targetRoomId } = body as { cardId: string; targetRoomId: string };
      const card = session.cards.find((c) => c.id === cardId && c.column === "ACTION_ITEMS");
      if (card && !card.completed) {
        // Marcar como migrado
        await prisma.retroCard.update({
          where: { id: cardId },
          data: { migratedTo: targetRoomId },
        });
        // Criar na sala alvo
        const targetSession = await prisma.retroSession.upsert({
          where: { roomId: targetRoomId },
          create: { roomId: targetRoomId, revealedColumns: ["ACTION_ITEMS"] },
          update: {},
        });
        await prisma.retroCard.create({
          data: {
            sessionId: targetSession.id,
            column: "ACTION_ITEMS",
            content: card.content,
            author: card.author,
          },
        });
      }
      break;
    }

    case "reset": {
      // Reset session state and votes, keep players
      await prisma.retroCard.deleteMany({ where: { sessionId: session.id } });
      await prisma.retroPlayer.updateMany({
        where: { sessionId: session.id },
        data: { votesRemaining: 5, votedCardIds: [] },
      });
      await prisma.retroSession.update({
        where: { id: session.id },
        data: {
          phase: "writing",
          votingOpen: false,
          revealedColumns: ["ACTION_ITEMS"],
          closedAt: null,
        },
      });
      break;
    }
  }

  // Return fresh state masked for the requester
  const requesterNickname = (body.nickname as string | undefined) || undefined;
  const updated = await getOrCreateSession(id);
  return NextResponse.json(formatRoom(updated, requesterNickname));
}
