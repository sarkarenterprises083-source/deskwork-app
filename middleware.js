import { NextResponse } from 'next/server';

// Serves a marketing landing page on the root domain (deskworkapp.in /
// www.deskworkapp.in), while the app subdomain (app.deskworkapp.in) keeps
// showing the actual tool at '/'.
export function middleware(request) {
  const host = request.headers.get('host') || '';
  const isRootDomain = host === 'deskworkapp.in' || host === 'www.deskworkapp.in';

  if (isRootDomain && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/landing', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/',
};
