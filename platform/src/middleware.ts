import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import { UserRole } from "@prisma/client";

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

function gameCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowedRaw = process.env.GAME_CORS_ORIGIN?.trim();
  const allowed = allowedRaw
    ? allowedRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  let allowOrigin = "*";
  if (process.env.NODE_ENV === "production") {
    if (allowed && allowed.length > 0) {
      if (allowed.includes("*")) allowOrigin = "*";
      else if (origin && allowed.includes(origin)) allowOrigin = origin;
      else allowOrigin = allowed[0]!;
    } else if (origin) {
      allowOrigin = origin;
    }
  } else if (origin) {
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Game-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function isPublicStudentPath(path: string): boolean {
  if (path === "/student") return true;
  if (path.startsWith("/student/login")) return true;
  if (path.startsWith("/student/home")) return true;
  if (path.startsWith("/student/play")) return true;
  return false;
}

function isPublicStudentApi(path: string): boolean {
  return path === "/api/student/login" || path === "/api/student/logout";
}

export default withAuth(
  function middleware(req) {
    const path = req.nextUrl.pathname;

    if (path.startsWith("/api/game")) {
      if (req.method === "OPTIONS") {
        return applySecurityHeaders(
          new NextResponse(null, { status: 204, headers: gameCorsHeaders(req) })
        );
      }
      const res = NextResponse.next();
      for (const [key, value] of Object.entries(gameCorsHeaders(req))) {
        res.headers.set(key, value);
      }
      return applySecurityHeaders(res);
    }

    const role = req.nextauth.token?.role as UserRole | undefined;

    if (path.startsWith("/admin") && role !== UserRole.ADMIN) {
      return applySecurityHeaders(NextResponse.redirect(new URL("/login", req.url)));
    }

    if (path.startsWith("/teacher") && role !== UserRole.TEACHER && role !== UserRole.ADMIN) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/student", req.url))
      );
    }

    if (isPublicStudentPath(path)) {
      return applySecurityHeaders(NextResponse.next());
    }

    if (path.startsWith("/student") && role !== UserRole.STUDENT) {
      return applySecurityHeaders(
        NextResponse.redirect(new URL("/student/login?portal=1", req.url))
      );
    }

    return applySecurityHeaders(NextResponse.next());
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (path.startsWith("/api/game")) return true;
        if (isPublicStudentApi(path)) return true;
        if (path.startsWith("/api/student")) return true;
        if (isPublicStudentPath(path)) return true;
        if (path === "/login" || path === "/forgot-password" || path.startsWith("/reset-password")) {
          return true;
        }
        if (path === "/") return true;
        if (path.startsWith("/admin")) return token?.role === UserRole.ADMIN;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/teacher/:path*",
    "/student/:path*",
    "/api/student/:path*",
    "/api/teacher/:path*",
    "/api/admin/:path*",
    "/api/game/:path*",
  ],
};
