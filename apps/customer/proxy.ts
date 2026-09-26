import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, newNonce } from '@senso/security';

export async function proxy(request: NextRequest) {
  // The Content-Security-Policy for this response, with a nonce that
  // marks the page's own scripts. Next reads the nonce from the request
  // header and stamps it on the scripts it emits; the response header
  // tells the browser to refuse any script without it.
  const nonce = newNonce();
  const csp = contentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    isDev: process.env.NODE_ENV === 'development',
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const nextWithCsp = () => {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  let supabaseResponse = nextWithCsp();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = nextWithCsp();
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname.startsWith('/login');

  // Not logged in → send to login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Already logged in on login page (no error) → send to dashboard
  if (user && isLoginPage && !request.nextUrl.searchParams.get('error')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  // Static assets are excluded so they are served directly. Without the file
  // extensions here every image request runs a Supabase auth check first, and an
  // unauthenticated one gets redirected to /login instead of the file — which
  // would break the sidebar logo on the login page and waste a round-trip on
  // every asset elsewhere.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
