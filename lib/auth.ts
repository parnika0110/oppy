import { NextRequest } from "next/server";

function matchesBearerToken(request: Request, secret?: string): boolean {
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export function isAdminRequest(request: NextRequest | Request): boolean {
  return matchesBearerToken(request, process.env.ADMIN_SECRET);
}

export function isCronRequest(request: NextRequest | Request): boolean {
  return matchesBearerToken(request, process.env.CRON_SECRET) || isAdminRequest(request);
}
