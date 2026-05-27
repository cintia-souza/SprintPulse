import { NextRequest, NextResponse } from "next/server";
import { getRoom, resetRoom, PointValue } from "@/lib/poker-store";

// GET: return current room state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = getRoom(id);
  return NextResponse.json(room);
}

// POST: handle actions (join, vote, reveal, reset)
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
      if (!room.players.find((p) => p.nickname === nickname)) {
        room.players.push({ nickname, role, vote: null });
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
