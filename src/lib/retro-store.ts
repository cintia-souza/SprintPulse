// In-memory ephemeral store for retro rooms

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

const rooms = new Map<string, RetroRoom>();

let cardCounter = 0;

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
  return `card_${++cardCounter}_${Date.now().toString(36)}`;
}

export { rooms };
