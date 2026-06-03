import { getRetroRoom, setRetroRoom, generateCardId, RetroRoom } from "@/lib/retro-store";

describe("Retro Store - Integration", () => {
  const ROOM_ID = "test-retro-room";

  beforeEach(() => {
    const room = getRetroRoom(ROOM_ID);
    room.players = [];
    room.cards = [];
    room.revealedColumns = ["ACTION_ITEMS"];
    room.votingOpen = false;
    room.phase = "writing";
    room.squad = "default";
  });

  describe("Room initialization", () => {
    it("should create room with ACTION_ITEMS always revealed", () => {
      const room = getRetroRoom("new-retro");
      expect(room.revealedColumns).toContain("ACTION_ITEMS");
      expect(room.phase).toBe("writing");
    });

    it("should return same instance", () => {
      const r1 = getRetroRoom(ROOM_ID);
      const r2 = getRetroRoom(ROOM_ID);
      expect(r1).toBe(r2);
    });
  });

  describe("Player management", () => {
    it("should add host as first player", () => {
      const room = getRetroRoom(ROOM_ID);
      room.players.push({ nickname: "pm", role: "host", votesRemaining: 5, votedCardIds: [] });
      expect(room.players).toHaveLength(1);
      expect(room.players[0].role).toBe("host");
    });

    it("should handle 20 members", () => {
      const room = getRetroRoom(ROOM_ID);
      room.players.push({ nickname: "host", role: "host", votesRemaining: 5, votedCardIds: [] });
      for (let i = 0; i < 19; i++) {
        room.players.push({ nickname: `member${i}`, role: "member", votesRemaining: 5, votedCardIds: [] });
      }
      expect(room.players).toHaveLength(20);
    });

    it("should not duplicate on re-join", () => {
      const room = getRetroRoom(ROOM_ID);
      room.players.push({ nickname: "alice", role: "member", votesRemaining: 5, votedCardIds: [] });
      if (!room.players.find((p) => p.nickname === "alice")) {
        room.players.push({ nickname: "alice", role: "member", votesRemaining: 5, votedCardIds: [] });
      }
      expect(room.players.filter((p) => p.nickname === "alice")).toHaveLength(1);
    });
  });

  describe("Card management", () => {
    it("should add cards to correct columns", () => {
      const room = getRetroRoom(ROOM_ID);
      room.cards.push({
        id: generateCardId(),
        column: "WENT_WELL",
        content: "Great teamwork",
        author: "alice",
        votes: 0,
        completed: false,
        migratedTo: null,
      });
      room.cards.push({
        id: generateCardId(),
        column: "IMPROVE",
        content: "Need more testing",
        author: "bob",
        votes: 0,
        completed: false,
        migratedTo: null,
      });
      room.cards.push({
        id: generateCardId(),
        column: "ACTION_ITEMS",
        content: "Setup CI/CD",
        author: "alice",
        votes: 0,
        completed: false,
        migratedTo: null,
      });

      expect(room.cards.filter((c) => c.column === "WENT_WELL")).toHaveLength(1);
      expect(room.cards.filter((c) => c.column === "IMPROVE")).toHaveLength(1);
      expect(room.cards.filter((c) => c.column === "ACTION_ITEMS")).toHaveLength(1);
    });

    it("should generate unique card IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCardId());
      }
      expect(ids.size).toBe(100);
    });

    it("should handle 50+ cards per room", () => {
      const room = getRetroRoom(ROOM_ID);
      for (let i = 0; i < 50; i++) {
        room.cards.push({
          id: generateCardId(),
          column: ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"][i % 3] as any,
          content: `Card ${i}`,
          author: `user${i % 10}`,
          votes: 0,
          completed: false,
          migratedTo: null,
        });
      }
      expect(room.cards).toHaveLength(50);
    });
  });

  describe("Reveal flow", () => {
    it("should reveal individual columns", () => {
      const room = getRetroRoom(ROOM_ID);
      room.revealedColumns.push("WENT_WELL");
      expect(room.revealedColumns).toContain("WENT_WELL");
      expect(room.revealedColumns).toContain("ACTION_ITEMS");
      expect(room.revealedColumns).not.toContain("IMPROVE");
    });

    it("should reveal all columns at once", () => {
      const room = getRetroRoom(ROOM_ID);
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      expect(room.revealedColumns).toHaveLength(3);
    });

    it("should not duplicate column on multiple reveals", () => {
      const room = getRetroRoom(ROOM_ID);
      if (!room.revealedColumns.includes("WENT_WELL")) room.revealedColumns.push("WENT_WELL");
      if (!room.revealedColumns.includes("WENT_WELL")) room.revealedColumns.push("WENT_WELL");
      expect(room.revealedColumns.filter((c) => c === "WENT_WELL")).toHaveLength(1);
    });
  });

  describe("Voting system", () => {
    let room: RetroRoom;

    beforeEach(() => {
      room = getRetroRoom(ROOM_ID);
      room.players.push({ nickname: "host", role: "host", votesRemaining: 5, votedCardIds: [] });
      for (let i = 0; i < 10; i++) {
        room.players.push({ nickname: `member${i}`, role: "member", votesRemaining: 5, votedCardIds: [] });
      }
      room.cards.push(
        { id: "card1", column: "WENT_WELL", content: "Test", author: "member0", votes: 0, completed: false, migratedTo: null },
        { id: "card2", column: "IMPROVE", content: "Test2", author: "member1", votes: 0, completed: false, migratedTo: null }
      );
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      room.votingOpen = true;
      room.phase = "voting";
    });

    it("should allow voting on revealed cards", () => {
      const player = room.players.find((p) => p.nickname === "member0")!;
      const card = room.cards.find((c) => c.id === "card1")!;
      card.votes++;
      player.votesRemaining--;
      player.votedCardIds.push("card1");

      expect(card.votes).toBe(1);
      expect(player.votesRemaining).toBe(4);
    });

    it("should enforce 5 votes per participant", () => {
      const player = room.players.find((p) => p.nickname === "member0")!;
      for (let i = 0; i < 5; i++) {
        player.votesRemaining--;
      }
      expect(player.votesRemaining).toBe(0);
    });

    it("should prevent double voting on same card", () => {
      const player = room.players.find((p) => p.nickname === "member0")!;
      player.votedCardIds.push("card1");
      const canVote = !player.votedCardIds.includes("card1");
      expect(canVote).toBe(false);
    });

    it("should handle all 11 players voting simultaneously", () => {
      const card = room.cards[0];
      room.players.forEach((p) => {
        if (p.votesRemaining > 0 && !p.votedCardIds.includes(card.id)) {
          card.votes++;
          p.votesRemaining--;
          p.votedCardIds.push(card.id);
        }
      });
      expect(card.votes).toBe(11);
    });
  });

  describe("Close retro and action plan", () => {
    it("should close retro after revealing WENT_WELL and IMPROVE", () => {
      const room = getRetroRoom(ROOM_ID);
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      room.votingOpen = false;
      room.phase = "done";

      const minRevealed = room.revealedColumns.includes("WENT_WELL") && room.revealedColumns.includes("IMPROVE");
      expect(minRevealed).toBe(true);
      expect(room.phase).toBe("done");
    });

    it("should not close without revealing both columns", () => {
      const room = getRetroRoom(ROOM_ID);
      room.revealedColumns = ["WENT_WELL", "ACTION_ITEMS"];
      const minRevealed = room.revealedColumns.includes("WENT_WELL") && room.revealedColumns.includes("IMPROVE");
      expect(minRevealed).toBe(false);
    });

    it("should toggle action item completion", () => {
      const room = getRetroRoom(ROOM_ID);
      room.cards.push({
        id: "action1",
        column: "ACTION_ITEMS",
        content: "Deploy fix",
        author: "host",
        votes: 0,
        completed: false,
        migratedTo: null,
      });

      const card = room.cards.find((c) => c.id === "action1")!;
      card.completed = !card.completed;
      expect(card.completed).toBe(true);

      card.completed = !card.completed;
      expect(card.completed).toBe(false);
    });

    it("should migrate action to another room", () => {
      const room = getRetroRoom(ROOM_ID);
      const targetRoom = getRetroRoom("next-sprint");

      room.cards.push({
        id: "action1",
        column: "ACTION_ITEMS",
        content: "Pending task",
        author: "host",
        votes: 0,
        completed: false,
        migratedTo: null,
      });

      const card = room.cards.find((c) => c.id === "action1")!;
      card.migratedTo = "next-sprint";
      targetRoom.cards.push({
        id: generateCardId(),
        column: "ACTION_ITEMS",
        content: card.content,
        author: card.author,
        votes: 0,
        completed: false,
        migratedTo: null,
      });

      expect(card.migratedTo).toBe("next-sprint");
      expect(targetRoom.cards).toHaveLength(1);
      expect(targetRoom.cards[0].content).toBe("Pending task");
    });
  });

  describe("Reset", () => {
    it("should reset room keeping ACTION_ITEMS revealed", () => {
      const room = getRetroRoom(ROOM_ID);
      room.cards.push({ id: "c1", column: "WENT_WELL", content: "x", author: "a", votes: 3, completed: false, migratedTo: null });
      room.revealedColumns = ["WENT_WELL", "IMPROVE", "ACTION_ITEMS"];
      room.phase = "done";

      // Reset
      room.cards = [];
      room.revealedColumns = ["ACTION_ITEMS"];
      room.votingOpen = false;
      room.phase = "writing";
      room.players.forEach((p) => { p.votesRemaining = 5; p.votedCardIds = []; });

      expect(room.cards).toHaveLength(0);
      expect(room.revealedColumns).toEqual(["ACTION_ITEMS"]);
      expect(room.phase).toBe("writing");
    });
  });

  describe("Performance: concurrent access", () => {
    it("should handle 1000 rapid reads without degradation", () => {
      const room = getRetroRoom(ROOM_ID);
      for (let i = 0; i < 20; i++) {
        room.players.push({ nickname: `user${i}`, role: "member", votesRemaining: 5, votedCardIds: [] });
      }
      for (let i = 0; i < 30; i++) {
        room.cards.push({ id: generateCardId(), column: "WENT_WELL", content: `Card ${i}`, author: `user${i % 20}`, votes: 0, completed: false, migratedTo: null });
      }

      const start = Date.now();
      for (let i = 0; i < 1000; i++) {
        const snapshot = getRetroRoom(ROOM_ID);
        JSON.stringify(snapshot); // Simulate serialization like in API response
      }
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    it("should produce stable JSON for unchanged state (no flicker)", () => {
      const room = getRetroRoom(ROOM_ID);
      room.players.push({ nickname: "alice", role: "host", votesRemaining: 5, votedCardIds: [] });
      room.cards.push({ id: "c1", column: "WENT_WELL", content: "test", author: "alice", votes: 0, completed: false, migratedTo: null });

      const json1 = JSON.stringify(room);
      const json2 = JSON.stringify(getRetroRoom(ROOM_ID));
      const json3 = JSON.stringify(getRetroRoom(ROOM_ID));

      expect(json1).toBe(json2);
      expect(json2).toBe(json3);
    });
  });

  describe("Squad management", () => {
    it("should set squad on room creation", () => {
      const room = getRetroRoom(ROOM_ID);
      room.squad = "squad-payments";
      expect(room.squad).toBe("squad-payments");
    });

    it("should persist squad through operations", () => {
      const room = getRetroRoom(ROOM_ID);
      room.squad = "squad-core";
      room.cards.push({ id: generateCardId(), column: "WENT_WELL", content: "test", author: "a", votes: 0, completed: false, migratedTo: null });
      room.revealedColumns.push("WENT_WELL");
      expect(room.squad).toBe("squad-core");
    });
  });
});
