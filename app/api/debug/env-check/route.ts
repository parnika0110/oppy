import { NextResponse } from "next/server";

/**
 * GET /api/debug/env-check
 *
 * Safe diagnostic: reports which env vars are present at runtime.
 * Does NOT expose any values. Only reports "present" or "missing".
 *
 * This endpoint should be removed after diagnosis.
 */
export async function GET() {
  const check = (name: string): "present" | "missing" => {
    const val = process.env[name];
    return val && val.length > 0 ? "present" : "missing";
  };

  return NextResponse.json({
    GOOGLE_CLIENT_ID: check("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: check("GOOGLE_CLIENT_SECRET"),
    SESSION_SECRET: check("SESSION_SECRET"),
    ADMIN_SECRET: check("ADMIN_SECRET"),
    MONGODB_URI: check("MONGODB_URI"),
    NODE_ENV: process.env.NODE_ENV || "unknown",
  });
}
