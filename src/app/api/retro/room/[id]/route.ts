import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewer, type Viewer } from "@/lib/auth";
import { toPublicCard } from "@/lib/retro-visibility";

const COLUMNS = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"] as const;
type Column = (typeof COLUMNS)[number];

function isColumn(value: unknown): value is Column {
  return typeof value === "string" && (COLUMNS as readonly string[]).includes(value);
}

// Resposta é personalizada por viewer — nunca pode ser cacheada e servida a outro.
const NO_STORE = { "Cache-Control": "private, no-store" };

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
  viewer: Viewer
) {
  return {
    players: session.players.map((p) => ({
      nickname: p.nickname,
      role: p.role,
      votesRemaining: p.votesRemaining,
      // Em quem cada um votou é privado: só o próprio jogador recebe a lista.
      votedCardIds:
        viewer && p.nickname === viewer.nickname ? p.votedCardIds : [],
    })),
    // authorKey nunca sai daqui, e card virado vai sem o texto.
    cards: session.cards.map((c) =>
      toPublicCard(c, session.revealedColumns, viewer?.authorKey)
    ),
    revealedColumns: session.revealedColumns,
    votingOpen: session.votingOpen,
    phase: session.phase,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getOrCreateSession(id);
  // Identidade vem do cookie assinado: ?nickname= era falsificável com um curl.
  const viewer = await getViewer(session.id);
  return NextResponse.json(formatRoom(session, viewer), { headers: NO_STORE });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo inválido" }, { status: 400 });
  }

  // Ensure session exists
  const session = await getOrCreateSession(id);
  const viewer = await getViewer(session.id);

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
      // Sem sessão não dá para marcar autoria, e sem autoria o autor não
      // conseguiria reler o próprio card antes do reveal.
      if (!viewer) {
        return NextResponse.json({ error: "Entre na sala novamente" }, { status: 401 });
      }
      const { column, content } = body as { column: unknown; content?: string };
      if (!isColumn(column) || !content?.trim()) break;
      await prisma.retroCard.create({
        data: {
          sessionId: session.id,
          column,
          content: content.trim().slice(0, 500),
          authorKey: viewer.authorKey,
        },
      });
      break;
    }

    case "edit-card": {
      const { cardId, content } = body as { cardId: string; content: string };
      const card = session.cards.find((c) => c.id === cardId);
      // Só o autor pode editar, e apenas antes de ser revelado. A autoria vem
      // do cookie: conferir contra um nickname do corpo deixava qualquer um
      // editar o card alheio só mandando o nome da pessoa.
      if (!card || !viewer || card.authorKey === "" || card.authorKey !== viewer.authorKey) break;
      if (session.revealedColumns.includes(card.column)) break;
      if (!content?.trim()) break;
      await prisma.retroCard.update({
        where: { id: cardId },
        data: { content: content.trim().slice(0, 500) },
      });
      break;
    }

    case "delete-card": {
      const { cardId } = body as { cardId: string };
      const card = session.cards.find((c) => c.id === cardId);
      // Só o autor pode excluir, e apenas antes de ser revelado (autoria pelo cookie).
      if (!card || !viewer || card.authorKey === "" || card.authorKey !== viewer.authorKey) break;
      if (session.revealedColumns.includes(card.column)) break;
      await prisma.retroCard.delete({ where: { id: cardId } });
      break;
    }

    case "reveal-column": {
      const { column } = body as { column: unknown };
      if (!isColumn(column)) break;
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
            // A ação migrada não tem dono: a chave do autor original é válida
            // só na sala de origem, e não é reversível.
            authorKey: "",
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

  // Return fresh state
  const updated = await getOrCreateSession(id);
  return NextResponse.json(formatRoom(updated, viewer), { headers: NO_STORE });
}
