import type { NextRequest } from "next/server";
import { updateSession } from "../lib/supabase/proxy";

// Next.js 16: file ini menggantikan middleware.ts
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/email-password"],
};
