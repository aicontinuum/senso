import { NextResponse, type NextRequest } from 'next/server';

const PROJECT_REF = 'bvoucxjplrreezvetthp';

function hasSession(request: NextRequest): boolean {
  return (
    request.cookies.has(`sb-${PROJECT_REF}-auth-token`) ||
    request.cookies.has(`sb-${PROJECT_REF}-auth-token.0`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith('/login');
  const session = hasSession(request);

  if (!session && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
