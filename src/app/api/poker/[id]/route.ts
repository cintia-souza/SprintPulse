import { NextRequest, NextResponse } from "next/server";
import { getRoom, resetRoom, PointValue } from "@/lib/poker-store";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = getRoom(id);
  return NextResponse.json(room);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = getRoom(id);
  const body = await req.json();

  switch (body.action) {
    case "join": {
      const { nickname, role } = body as { nickname: string; role: "host" | "dev" };
      if (!nickname || nickname.trim().length < 1) break;
      const cleanNick = nickname.trim().slice(0, 30);
      const validRole = role === "host" ? "host" : "dev";
      if (!room.players.find((p) => p.nickname === cleanNick)) {
        room.players.push({ nickname: cleanNick, role: validRole, vote: null });
      }
      break;
    }
    case "vote": {
      const { nickname, vote } = body as { nickname: string; vote: PointValue };
      const player = room.players.find((p) => p.nickname === nickname);
      if (player && player.role === "dev" && !room.revealed) {
        player.vote = vote;
      }
      break;
    }
    case "reveal": {
      room.revealed = true;
      break;
    }
    case "reset": {
      resetRoom(id);
      break;
    }
  }

  return NextResponse.json(room);
}
