import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "sprintpulse-dev-secret-change-me"
);

const COOKIE_NAME = "sp_session";

export interface GuestPayload {
  nickname: string;
  uid: string; // short-lived UUID
}

export async function createSessionToken(payload: GuestPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function verifySession(): Promise<GuestPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as GuestPayload;
  } catch {
    return null;
  }
}

export { COOKIE_NAME };
