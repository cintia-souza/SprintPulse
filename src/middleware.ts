import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "sprintpulse-dev-secret-change-me"
);

const PROTECTED_PATHS = ["/retro/", "/poker/"];

export async function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PATHS.some((p) =>
    req.nextUrl.pathname.startsWith(p)
  );
  if (!isProtected) return NextResponse.next();

  const token = req.cookies.get("sp_session")?.value;
  if (!token) {
    // Allow page load — client-side will show nickname prompt
    return NextResponse.next();
  }

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    // Expired/invalid token — clear cookie, client will re-prompt
    const res = NextResponse.next();
    res.cookies.delete("sp_session");
    return res;
  }
}

export const config = {
  matcher: ["/retro/:path*", "/poker/:path*"],
};
