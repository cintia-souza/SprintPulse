import { sanitize, isValidNickname, isValidRoomId } from "@/lib/sanitize";
import { rateLimit } from "@/lib/rate-limit";

describe("Sanitize", () => {
  it("should remove angle brackets", () => {
    expect(sanitize("<script>alert('xss')</script>")).toBe("scriptalert('xss')/script");
  });

  it("should trim whitespace", () => {
    expect(sanitize("  hello  ")).toBe("hello");
  });

  it("should limit length", () => {
    const long = "a".repeat(1000);
    expect(sanitize(long, 50).length).toBe(50);
  });

  it("should handle empty string", () => {
    expect(sanitize("")).toBe("");
  });
});

describe("isValidNickname", () => {
  it("should accept valid nicknames", () => {
    expect(isValidNickname("alice")).toBe(true);
    expect(isValidNickname("Dev 01")).toBe(true);
    expect(isValidNickname("ab")).toBe(true);
  });

  it("should reject too short", () => {
    expect(isValidNickname("a")).toBe(false);
  });

  it("should reject too long", () => {
    expect(isValidNickname("a".repeat(31))).toBe(false);
  });

  it("should reject special chars", () => {
    expect(isValidNickname("<script>")).toBe(false);
    expect(isValidNickname('test"name')).toBe(false);
    expect(isValidNickname("name&more")).toBe(false);
  });
});

describe("isValidRoomId", () => {
  it("should accept valid room IDs", () => {
    expect(isValidRoomId("sprint-42")).toBe(true);
    expect(isValidRoomId("my_room_123")).toBe(true);
    expect(isValidRoomId("abc")).toBe(true);
  });

  it("should reject too short", () => {
    expect(isValidRoomId("ab")).toBe(false);
  });

  it("should reject special chars", () => {
    expect(isValidRoomId("room with spaces")).toBe(false);
    expect(isValidRoomId("room<id>")).toBe(false);
  });
});

describe("Rate Limiter", () => {
  it("should allow requests within limit", () => {
    const ip = "test-ip-" + Date.now();
    for (let i = 0; i < 100; i++) {
      expect(rateLimit(ip)).toBe(true);
    }
  });

  it("should block after exceeding limit", () => {
    const ip = "flood-ip-" + Date.now();
    // Exhaust limit
    for (let i = 0; i < 600; i++) {
      rateLimit(ip);
    }
    expect(rateLimit(ip)).toBe(false);
  });

  it("should allow different IPs independently", () => {
    const ip1 = "ip1-" + Date.now();
    const ip2 = "ip2-" + Date.now();

    for (let i = 0; i < 300; i++) {
      expect(rateLimit(ip1)).toBe(true);
      expect(rateLimit(ip2)).toBe(true);
    }
  });
});
