import { NextRequest, NextResponse } from "next/server";
import {
  getRetroRoom,
  generateCardId,
  CardColumn,
  setRetroRoom,
} from "@/lib/retro-store";
import { persistRetro, loadRetroFromDB } from "@/lib/retro-sync";
import { rateLimit } from "@/lib/rate-limit";
import { sanitize, isValidNickname } from "@/lib/sanitize";

// Garante que a sala está carregada (do banco ou nova)
async function ensureRoom(id: string) {
  let room = getRetroRoom(id);
  // Se a sala está vazia no memory, tenta carregar do banco
  if (room.cards.length === 0 && room.players.length === 0) {
    const fromDB = await loadRetroFromDB(id);
    if (fromDB) {
      // Restaura cards e estado do banco, players são efêmeros
      room.cards = fromDB.cards;
      room.revealedColumns = fromDB.revealedColumns;
      room.votingOpen = fromDB.votingOpen;
      room.phase = fromDB.phase;
      setRetroRoom(id, room);
    }
  }
  return room;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  const room = await ensureRoom(id);
  return NextResponse.json(room);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  const room = await ensureRoom(id);
  const body = await req.json();

  switch (body.action) {
    case "join": {
      const { nickname, role, squad } = body as { nickname: string; role: "host" | "member"; squad?: string };
      if (!nickname || !isValidNickname(nickname)) {
        return NextResponse.json({ error: "Nickname inválido" }, { status: 400 });
      }
      if (role !== "host" && role !== "member") {
        return NextResponse.json({ error: "Role inválido" }, { status: 400 });
      }
      if (room.players.length === 0 && role !== "host") {
        return NextResponse.json(
          { error: "Somente o Host (PM/TL) pode criar a sala" },
          { status: 403 }
        );
      }
      if (role === "host" && room.players.some((p) => p.role === "host")) {
        return NextResponse.json(
          { error: "Já existe um Host nesta sala" },
          { status: 403 }
        );
      }
      if (squad && room.players.length === 0) {
        room.squad = sanitize(squad, 50);
      }
      if (!room.players.find((p) => p.nickname === nickname)) {
        room.players.push({ nickname: sanitize(nickname, 30), role, votesRemaining: 5, votedCardIds: [] });
      }
      break;
    }

    case "add-card": {
      const { nickname, column, content } = body as {
        nickname: string;
        column: CardColumn;
        content: string;
      };
      const validColumns: CardColumn[] = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      if (!validColumns.includes(column)) {
        return NextResponse.json({ error: "Coluna inválida" }, { status: 400 });
      }
      const sanitizedContent = sanitize(content, 500);
      if (sanitizedContent) {
        room.cards.push({
          id: generateCardId(),
          column,
          content: sanitizedContent,
          author: sanitize(nickname, 30),
          votes: 0,
          completed: false,
          migratedTo: null,
        });
      }
      break;
    }

    case "reveal-column": {
      const { column } = body as { column: CardColumn };
      if (!room.revealedColumns.includes(column)) {
        room.revealedColumns.push(column);
      }
      room.votingOpen = true;
      room.phase = "voting";
      await persistRetro(id, room, room.squad);
      break;
    }

    case "reveal-all": {
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      room.votingOpen = true;
      room.phase = "voting";
      await persistRetro(id, room, room.squad);
      break;
    }

    case "vote": {
      const { nickname, cardId } = body as { nickname: string; cardId: string };
      const player = room.players.find((p) => p.nickname === nickname);
      const card = room.cards.find((c) => c.id === cardId);
      const columnRevealed = card && room.revealedColumns.includes(card.column);
      if (player && card && room.votingOpen && columnRevealed && player.votesRemaining > 0 && !player.votedCardIds.includes(cardId)) {
        card.votes++;
        player.votesRemaining--;
        player.votedCardIds.push(cardId);
      }
      break;
    }

    case "close-voting": {
      // Regra: precisa ter revelado WENT_WELL e IMPROVE
      const minRevealed = room.revealedColumns.includes("WENT_WELL") &&
        room.revealedColumns.includes("IMPROVE");
      if (!minRevealed) {
        return NextResponse.json(
          { error: "Revele pelo menos os pilares 'O que foi bem' e 'O que pode melhorar' antes de encerrar" },
          { status: 400 }
        );
      }
      room.votingOpen = false;
      room.phase = "done";
      await persistRetro(id, room, room.squad);
      break;
    }

    case "toggle-action-complete": {
      const { cardId } = body as { cardId: string };
      const card = room.cards.find((c) => c.id === cardId && c.column === "ACTION_ITEMS");
      if (card) {
        card.completed = !card.completed;
        await persistRetro(id, room, room.squad);
      }
      break;
    }

    case "migrate-action": {
      const { cardId, targetRoomId } = body as { cardId: string; targetRoomId: string };
      const card = room.cards.find((c) => c.id === cardId && c.column === "ACTION_ITEMS");
      if (card && !card.completed) {
        card.migratedTo = targetRoomId;
        const targetRoom = (await import("@/lib/retro-store")).getRetroRoom(targetRoomId);
        targetRoom.cards.push({
          id: generateCardId(),
          column: "ACTION_ITEMS",
          content: card.content,
          author: card.author,
          votes: 0,
          completed: false,
          migratedTo: null,
        });
        await persistRetro(id, room, room.squad);
        await persistRetro(targetRoomId, targetRoom, targetRoom.squad);
      }
      break;
    }

    case "reset": {
      room.cards = [];
      room.revealedColumns = ["ACTION_ITEMS"];
      room.votingOpen = false;
      room.phase = "writing";
      room.players.forEach((p) => {
        p.votesRemaining = 5;
        p.votedCardIds = [];
      });
      break;
    }
  }

  return NextResponse.json(room);
}
