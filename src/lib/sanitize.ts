// Sanitize user input to prevent XSS
export function sanitize(input: string, maxLength = 500): string {
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "")
    .trim();
}

export function isValidNickname(nickname: string): boolean {
  return nickname.length >= 2 && nickname.length <= 30 && !/[<>"'&]/.test(nickname);
}

export function isValidRoomId(id: string): boolean {
  return id.length >= 3 && id.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(id);
}
