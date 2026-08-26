import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('oppy_admin_session');
  return response;
}
