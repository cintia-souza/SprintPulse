// In-memory ephemeral store for retro rooms
// Uses globalThis to survive Next.js hot reloads

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
  return rooms.get(id)!;
}

export function setRetroRoom(id: string, room: RetroRoom) {
  rooms.set(id, room);
}

export function generateCardId(): string {
  globalForRetro.retroCardCounter! += 1;
  return `card_${globalForRetro.retroCardCounter}_${Date.now().toString(36)}`;
}

export { rooms };
