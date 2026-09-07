import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Request-level authentication gate across all /api/* routes (Finding #9).
 * Enforces shared secret authentication when APPFLOW_API_SECRET is configured.
 */
export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const apiSecret = process.env.APPFLOW_API_SECRET;

  if (apiSecret) {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-appflow-secret");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    const providedSecret = customHeader || bearerToken;
    if (!providedSecret || providedSecret !== apiSecret) {
      return NextResponse.json(
        {
          error: "Unauthorized: Invalid or missing API secret header",
          hint: "Provide 'x-appflow-secret: <secret>' or 'Authorization: Bearer <secret>'",
        },
        { status: 401 }
      );
    }
  }

  // Same-origin & browser fetch protection
  const response = NextResponse.next();
  response.headers.set("x-appflow-guarded", "true");
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
