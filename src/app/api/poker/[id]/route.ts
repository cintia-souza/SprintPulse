import { NextRequest, NextResponse } from "next/server";
import { getRoom, resetRoom, touchPlayer, PointValue } from "@/lib/poker-store";
import { rateLimit } from "@/lib/rate-limit";
import { sanitize, isValidNickname } from "@/lib/sanitize";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { id } = await params;
  const room = getRoom(id);

  // Return without lastSeen (internal field)
  const sanitizedRoom = {
    players: room.players.map(({ nickname, role, vote }) => ({ nickname, role, vote })),
    revealed: room.revealed,
  };

  return NextResponse.json(sanitizedRoom);
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
      const existing = room.players.find((p) => p.nickname === nickname);
      if (existing) {
        existing.lastSeen = Date.now();
      } else {
        room.players.push({ nickname: sanitize(nickname, 30), role, vote: null, lastSeen: Date.now() });
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
        player.lastSeen = Date.now();
      }
      break;
    }
    case "heartbeat": {
      const { nickname } = body as { nickname: string };
      touchPlayer(room, nickname);
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

  const sanitizedRoom = {
    players: room.players.map(({ nickname, role, vote }) => ({ nickname, role, vote })),
    revealed: room.revealed,
  };

  return NextResponse.json(sanitizedRoom);
}
