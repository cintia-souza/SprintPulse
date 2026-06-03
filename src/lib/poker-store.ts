// In-memory ephemeral store for poker rooms
// Uses globalThis to survive Next.js hot reloads in dev

export type PointValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | "?" | "☕";

export interface Player {
  nickname: string;
  role: "host" | "dev";
  vote: PointValue | null;
  lastSeen: number; // timestamp to detect disconnects
}

export interface PokerRoom {
  players: Player[];
  revealed: boolean;
}

const globalForPoker = globalThis as unknown as {
  pokerRooms?: Map<string, PokerRoom>;
};

if (!globalForPoker.pokerRooms) {
  globalForPoker.pokerRooms = new Map();
}

const rooms = globalForPoker.pokerRooms;

// Remove players inactive for 30s
function cleanStale(room: PokerRoom) {
  const now = Date.now();
  room.players = room.players.filter((p) => now - p.lastSeen < 30_000);
}

export function getRoom(id: string): PokerRoom {
  if (!rooms.has(id)) {
    rooms.set(id, { players: [], revealed: false });
  }
  const room = rooms.get(id)!;
  cleanStale(room);
  return room;
}

export function touchPlayer(room: PokerRoom, nickname: string) {
  const player = room.players.find((p) => p.nickname === nickname);
  if (player) player.lastSeen = Date.now();
}

export function resetRoom(id: string) {
  const room = getRoom(id);
  room.revealed = false;
  room.players.forEach((p) => (p.vote = null));
}

export { rooms };
