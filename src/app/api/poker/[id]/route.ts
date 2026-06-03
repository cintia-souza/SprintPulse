import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getOrCreateRoom(roomId: string) {
  return prisma.pokerRoom.upsert({
    where: { roomId },
    create: { roomId },
    update: {},
    include: { players: true },
  });
}

function formatRoom(room: Awaited<ReturnType<typeof getOrCreateRoom>>) {
  return {
    players: room.players.map((p) => ({
      nickname: p.nickname,
      role: p.role,
      vote: p.vote ? (isNaN(Number(p.vote)) ? p.vote : Number(p.vote)) : null,
    })),
    revealed: room.revealed,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const room = await getOrCreateRoom(id);
  return NextResponse.json(formatRoom(room));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  switch (body.action) {
    case "join": {
      const { nickname, role } = body as { nickname: string; role: string };
      if (!nickname || nickname.trim().length < 1) break;
      const cleanNick = nickname.trim().slice(0, 30);
      const validRole = role === "host" ? "host" : "dev";
      await prisma.pokerRoom.upsert({
        where: { roomId: id },
        create: { roomId: id },
        update: {},
      });
      await prisma.pokerPlayer.upsert({
        where: { roomId_nickname: { roomId: id, nickname: cleanNick } },
        create: { roomId: id, nickname: cleanNick, role: validRole },
        update: {}, // Idempotent - don't change role if already exists
      });
      break;
    }
    case "vote": {
      const { nickname, vote } = body as { nickname: string; vote: string | number };
      await prisma.pokerPlayer.updateMany({
        where: { roomId: id, nickname, role: "dev" },
        data: { vote: String(vote) },
      });
      // Only allow if not revealed
      const room = await prisma.pokerRoom.findUnique({ where: { roomId: id } });
      if (room?.revealed) {
        // Revert
        await prisma.pokerPlayer.updateMany({
          where: { roomId: id, nickname },
          data: { vote: null },
        });
      }
      break;
    }
    case "reveal": {
      await prisma.pokerRoom.update({
        where: { roomId: id },
        data: { revealed: true },
      });
      break;
    }
    case "reset": {
      await prisma.pokerRoom.update({
        where: { roomId: id },
        data: { revealed: false },
      });
      await prisma.pokerPlayer.updateMany({
        where: { roomId: id },
        data: { vote: null },
      });
      break;
    }
  }

  const updatedRoom = await getOrCreateRoom(id);
  return NextResponse.json(formatRoom(updatedRoom));
}
