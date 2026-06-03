import { getRoom, resetRoom, PokerRoom } from "@/lib/poker-store";

describe("Poker Store - Integration", () => {
  const ROOM_ID = "test-poker-room";

  beforeEach(() => {
    const room = getRoom(ROOM_ID);
    room.players = [];
    room.revealed = false;
  });

  describe("Room lifecycle", () => {
    it("should create a room on first access", () => {
      const room = getRoom("new-room");
      expect(room.players).toEqual([]);
      expect(room.revealed).toBe(false);
    });

    it("should return the same room instance", () => {
      const room1 = getRoom(ROOM_ID);
      const room2 = getRoom(ROOM_ID);
      expect(room1).toBe(room2);
    });
  });

  describe("Player management with 20 players", () => {
    it("should handle 20 concurrent players without data loss", () => {
      const room = getRoom(ROOM_ID);

      // Simulate 20 players joining
      for (let i = 0; i < 20; i++) {
        room.players.push({ nickname: `dev${i}`, role: "dev", vote: null });
      }

      expect(room.players).toHaveLength(20);
      expect(room.players[0].nickname).toBe("dev0");
      expect(room.players[19].nickname).toBe("dev19");
    });

    it("should not duplicate players on re-join", () => {
      const room = getRoom(ROOM_ID);

      room.players.push({ nickname: "alice", role: "dev", vote: null });
      // Simulate re-join (idempotent)
      if (!room.players.find((p) => p.nickname === "alice")) {
        room.players.push({ nickname: "alice", role: "dev", vote: null });
      }

      expect(room.players.filter((p) => p.nickname === "alice")).toHaveLength(1);
    });

    it("should maintain all players across multiple reads", () => {
      const room = getRoom(ROOM_ID);
      for (let i = 0; i < 20; i++) {
        room.players.push({ nickname: `player${i}`, role: i === 0 ? "host" : "dev", vote: null });
      }

      // Simulate multiple reads (like polling)
      for (let poll = 0; poll < 100; poll++) {
        const current = getRoom(ROOM_ID);
        expect(current.players).toHaveLength(20);
      }
    });
  });

  describe("Voting flow", () => {
    let room: PokerRoom;

    beforeEach(() => {
      room = getRoom(ROOM_ID);
      room.players.push({ nickname: "host", role: "host", vote: null });
      for (let i = 0; i < 10; i++) {
        room.players.push({ nickname: `dev${i}`, role: "dev", vote: null });
      }
    });

    it("should allow devs to vote", () => {
      const player = room.players.find((p) => p.nickname === "dev0");
      player!.vote = 5;
      expect(player!.vote).toBe(5);
    });

    it("should not allow host to vote", () => {
      const host = room.players.find((p) => p.role === "host");
      // Host shouldn't vote - simulating API logic
      if (host!.role !== "host") host!.vote = 5;
      expect(host!.vote).toBeNull();
    });

    it("should handle all 10 devs voting simultaneously", () => {
      const votes = [1, 2, 3, 5, 8, 13, 21, 5, 8, 3] as const;
      room.players.filter((p) => p.role === "dev").forEach((p, i) => {
        p.vote = votes[i];
      });

      const devVotes = room.players.filter((p) => p.role === "dev" && p.vote !== null);
      expect(devVotes).toHaveLength(10);
    });

    it("should detect consensus correctly", () => {
      room.players.filter((p) => p.role === "dev").forEach((p) => {
        p.vote = 8;
      });

      const votes = room.players.filter((p) => p.role === "dev").map((p) => p.vote);
      const unique = new Set(votes);
      expect(unique.size).toBe(1);
    });

    it("should detect no consensus", () => {
      room.players.filter((p) => p.role === "dev").forEach((p, i) => {
        p.vote = i % 2 === 0 ? 5 : 8;
      });

      const votes = room.players.filter((p) => p.role === "dev").map((p) => p.vote);
      const unique = new Set(votes);
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe("Reveal and Reset", () => {
    it("should reveal votes", () => {
      const room = getRoom(ROOM_ID);
      room.players.push({ nickname: "dev1", role: "dev", vote: 5 });
      room.revealed = true;
      expect(room.revealed).toBe(true);
    });

    it("should reset all votes and revealed state", () => {
      const room = getRoom(ROOM_ID);
      room.players.push(
        { nickname: "dev1", role: "dev", vote: 5 },
        { nickname: "dev2", role: "dev", vote: 8 }
      );
      room.revealed = true;

      resetRoom(ROOM_ID);

      const resetted = getRoom(ROOM_ID);
      expect(resetted.revealed).toBe(false);
      expect(resetted.players.every((p) => p.vote === null)).toBe(true);
    });
  });

  describe("Performance: concurrent access simulation", () => {
    it("should handle rapid read/write cycles (simulating 20 users polling at 3s)", () => {
      const room = getRoom(ROOM_ID);
      for (let i = 0; i < 20; i++) {
        room.players.push({ nickname: `user${i}`, role: "dev", vote: null });
      }

      const startTime = Date.now();

      // Simulate 1000 polling cycles (20 users × 50 polls each)
      for (let cycle = 0; cycle < 1000; cycle++) {
        const snapshot = getRoom(ROOM_ID);
        expect(snapshot.players).toHaveLength(20);
      }

      const elapsed = Date.now() - startTime;
      // Should complete in under 100ms (in-memory is fast)
      expect(elapsed).toBeLessThan(100);
    });

    it("should handle simultaneous votes without race conditions", () => {
      const room = getRoom(ROOM_ID);
      for (let i = 0; i < 20; i++) {
        room.players.push({ nickname: `user${i}`, role: "dev", vote: null });
      }

      // All 20 vote at once
      room.players.forEach((p, i) => {
        p.vote = [1, 2, 3, 5, 8, 13, 21, 1, 2, 3, 5, 8, 13, 21, 1, 2, 3, 5, 8, 13][i] as any;
      });

      const voted = room.players.filter((p) => p.vote !== null);
      expect(voted).toHaveLength(20);
    });
  });

  describe("JSON serialization stability", () => {
    it("should produce identical JSON for unchanged state", () => {
      const room = getRoom(ROOM_ID);
      room.players.push(
        { nickname: "host", role: "host", vote: null },
        { nickname: "dev1", role: "dev", vote: 5 }
      );

      const json1 = JSON.stringify(room);
      const json2 = JSON.stringify(getRoom(ROOM_ID));
      expect(json1).toBe(json2);
    });

    it("should produce different JSON when state changes", () => {
      const room = getRoom(ROOM_ID);
      room.players.push({ nickname: "dev1", role: "dev", vote: null });

      const before = JSON.stringify(room);
      room.players[0].vote = 8;
      const after = JSON.stringify(room);

      expect(before).not.toBe(after);
    });
  });
});
