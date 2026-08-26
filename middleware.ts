import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Middleware runs on the Edge runtime, which has no Node `crypto` module —
// so we verify the signed session token using the standard Web Crypto API
// (SubtleCrypto). This mirrors the HMAC-SHA256 signing done with Node's
// `crypto` in lib/auth.ts; both produce the same hex digest for the same
// key/message, so a token minted server-side (Node) verifies fine here (Edge).
async function verifySessionTokenEdge(token: string | undefined, secret: string | undefined): Promise<boolean> {
  if (!token || !secret) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [random, expiresAtStr, signature] = parts

  const expiresAt = Number(expiresAtStr)
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false

  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(`${random}.${expiresAtStr}`))
  const expectedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time-ish comparison (Edge runtime has no crypto.timingSafeEqual)
  if (expectedHex.length !== signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return mismatch === 0
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin routes — full cryptographic session verification (Edge-safe HMAC).
  if (pathname.startsWith('/admin')) {
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

    const token = request.cookies.get('oppy_admin_session')?.value
    const validSecret = process.env.ADMIN_SECRET

    const isValid = await verifySessionTokenEdge(token, validSecret)
    if (!isValid) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    return NextResponse.next()
  }

  // User-only routes — fast existence check only (redirect UX). The actual
  // security boundary is server-side: each page/API calls getCurrentUser(),
  // which looks the session token up in MongoDB and can reject/expire it.
  // (Full DB-backed validation can't run in Edge middleware — the mongodb
  // driver requires the Node runtime.)
  const USER_PROTECTED = ['/dashboard', '/saved', '/profile']
  if (USER_PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const hasSessionCookie = Boolean(request.cookies.get('oppy_session')?.value)
    if (!hasSessionCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/saved/:path*', '/profile/:path*'],
}
