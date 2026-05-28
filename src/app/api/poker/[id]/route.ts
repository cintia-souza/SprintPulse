import { NextRequest, NextResponse } from "next/server";
import { getRoom, resetRoom, PointValue } from "@/lib/poker-store";
import { sanitize, isValidNickname } from "@/lib/sanitize";

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
      const { nickname, role } = body as {
        nickname: string;
        role: "host" | "dev";
      };
      if (!nickname || !isValidNickname(nickname)) {
        return NextResponse.json({ error: "Nickname inválido" }, { status: 400 });
      }
      if (role !== "host" && role !== "dev") {
        return NextResponse.json({ error: "Role inválido" }, { status: 400 });
      }
      if (!room.players.find((p) => p.nickname === nickname)) {
        room.players.push({ nickname: sanitize(nickname, 30), role, vote: null });
      }
      break;
    }
    case "vote": {
      const { nickname, vote } = body as {
        nickname: string;
        vote: PointValue;
      };
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
