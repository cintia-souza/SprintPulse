import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { APP_SECRET } from "@/lib/secret";
import { authorKeyFor } from "@/lib/author-key";

const SECRET = new TextEncoder().encode(APP_SECRET);

const COOKIE_NAME = "sp_session";

export interface GuestPayload {
  nickname: string;
  uid: string; // aleatório por browser, nunca derivado do nickname
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

// Identidade do requisitante já resolvida para uma retro específica.
export async function getViewer(retroSessionId: string) {
  const guest = await verifySession();
  if (!guest?.uid) return null;
  return {
    nickname: guest.nickname,
    authorKey: authorKeyFor(guest.uid, retroSessionId),
  };
}

export type Viewer = Awaited<ReturnType<typeof getViewer>>;

export { COOKIE_NAME };
