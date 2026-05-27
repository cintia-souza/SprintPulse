import { NextRequest, NextResponse } from "next/server";
import {
  getRetroRoom,
  generateCardId,
  CardColumn,
  setRetroRoom,
} from "@/lib/retro-store";
import { persistRetro, loadRetroFromDB } from "@/lib/retro-sync";

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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = await ensureRoom(id);
  return NextResponse.json(room);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = await ensureRoom(id);
  const body = await req.json();

  switch (body.action) {
    case "join": {
      const { nickname, role } = body as { nickname: string; role: "host" | "member" };
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
      if (!room.players.find((p) => p.nickname === nickname)) {
        room.players.push({ nickname, role, votesRemaining: 5, votedCardIds: [] });
      }
      break;
    }

    case "add-card": {
      const { nickname, column, content } = body as {
        nickname: string;
        column: CardColumn;
        content: string;
      };
      if (content?.trim()) {
        room.cards.push({
          id: generateCardId(),
          column,
          content: content.trim(),
          author: nickname,
          votes: 0,
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
      // Persiste estado parcial no banco
      await persistRetro(id, room);
      break;
    }

    case "reveal-all": {
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      room.votingOpen = true;
      room.phase = "voting";
      await persistRetro(id, room);
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
      const allRevealed = room.revealedColumns.includes("WENT_WELL") &&
        room.revealedColumns.includes("IMPROVE") &&
        room.revealedColumns.includes("ACTION_ITEMS");
      if (!allRevealed) {
        return NextResponse.json(
          { error: "Revele os 3 pilares antes de encerrar a votação" },
          { status: 400 }
        );
      }
      room.votingOpen = false;
      room.phase = "done";
      // Persiste resultado final no Neon
      await persistRetro(id, room);
      break;
    }

    case "reset": {
      room.cards = [];
      room.revealedColumns = [];
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
