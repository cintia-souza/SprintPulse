import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const squad = req.nextUrl.searchParams.get("squad");

  const where = squad ? { squad } : {};

  const sessions = await prisma.retroSession.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      roomId: true,
      squad: true,
      phase: true,
      createdAt: true,
      closedAt: true,
      _count: { select: { cards: true } },
    },
  });

  // Listar squads distintos
  const squads = await prisma.retroSession.findMany({
    distinct: ["squad"],
    select: { squad: true },
    orderBy: { squad: "asc" },
  });

  return NextResponse.json({
    squads: squads.map((s) => s.squad),
    sessions,
  });
}
