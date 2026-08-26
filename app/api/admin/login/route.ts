import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminSessionToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json();

    if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
    }

    // Mint a random, signed, time-limited session token. The raw
    // ADMIN_SECRET is verified once here and then never touches the
    // browser — only this opaque session token is stored client-side.
    const sessionToken = createAdminSessionToken();

    const response = NextResponse.json({ success: true });

    response.cookies.set('oppy_admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days, matches SESSION_TTL_MS in lib/auth.ts
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
