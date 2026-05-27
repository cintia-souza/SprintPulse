// In-memory ephemeral store for poker rooms (lives only while server is running)

export type PointValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | "?" | "☕";

export interface Player {
  nickname: string;
  role: "host" | "dev";
  vote: PointValue | null;
}

export interface PokerRoom {
  players: Player[];
  revealed: boolean;
}

const rooms = new Map<string, PokerRoom>();

export function getRoom(id: string): PokerRoom {
  if (!rooms.has(id)) {
    rooms.set(id, { players: [], revealed: false });
  }
  return rooms.get(id)!;
}

export function resetRoom(id: string) {
  const room = getRoom(id);
  room.revealed = false;
  room.players.forEach((p) => (p.vote = null));
}

export { rooms };
