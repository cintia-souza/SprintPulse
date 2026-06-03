// In-memory ephemeral store for retro rooms
// Uses globalThis to survive Next.js hot reloads in dev

export type CardColumn = "WENT_WELL" | "IMPROVE" | "ACTION_ITEMS";
export type Phase = "writing" | "revealed" | "voting" | "done";

export interface RetroCard {
  id: string;
  column: CardColumn;
  content: string;
  author: string;
  votes: number;
  completed: boolean;
  migratedTo?: string | null;
}

export interface RetroPlayer {
  nickname: string;
  role: "host" | "member";
  votesRemaining: number;
  votedCardIds: string[];
  lastSeen: number;
}

export interface RetroRoom {
  squad: string;
  players: RetroPlayer[];
  cards: RetroCard[];
  revealedColumns: CardColumn[];
  votingOpen: boolean;
  phase: Phase;
}

const globalForRetro = globalThis as unknown as {
  retroRooms?: Map<string, RetroRoom>;
  retroCardCounter?: number;
};

if (!globalForRetro.retroRooms) {
  globalForRetro.retroRooms = new Map();
}
if (!globalForRetro.retroCardCounter) {
  globalForRetro.retroCardCounter = 0;
}

const rooms = globalForRetro.retroRooms;

// Remove players inactive for 30s
function cleanStale(room: RetroRoom) {
  const now = Date.now();
  room.players = room.players.filter((p) => now - p.lastSeen < 30_000);
}

export function getRetroRoom(id: string): RetroRoom {
  if (!rooms.has(id)) {
    rooms.set(id, {
      squad: "default",
      players: [],
      cards: [],
      revealedColumns: ["ACTION_ITEMS"],
      votingOpen: false,
      phase: "writing",
    });
  }
  const room = rooms.get(id)!;
  cleanStale(room);
  return room;
}

export function setRetroRoom(id: string, room: RetroRoom) {
  rooms.set(id, room);
}

export function touchRetroPlayer(room: RetroRoom, nickname: string) {
  const player = room.players.find((p) => p.nickname === nickname);
  if (player) player.lastSeen = Date.now();
}

export function generateCardId(): string {
  globalForRetro.retroCardCounter! += 1;
  return `card_${globalForRetro.retroCardCounter}_${Date.now().toString(36)}`;
}

export { rooms };
