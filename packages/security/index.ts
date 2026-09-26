// The browser-side security headers both sites send, in one place so the
// two never drift. None of these stops an attacker who has found a hole;
// they limit what a hole can do. Nothing here changes what a page looks
// like.
//
// Two kinds. The fixed headers go on every response from next.config.ts.
// The Content-Security-Policy is built per request in proxy.ts, because
// it carries a nonce: a one-time value that marks the scripts the page
// itself emitted, so an injected script, which cannot know the nonce,
// is refused by the browser.
//
// To let the site load something new from outside (a font host, a map, a
// widget), add its origin to the matching directive in `contentSecurityPolicy`
// below. A missing origin shows up at once as that thing not loading and
// a console message naming the directive; it is never silent.

/** Two years, the value preload lists expect. */
const HSTS_MAX_AGE_SECONDS = 63072000;

/** Sent on every response. Never needs maintenance. */
export const FIXED_SECURITY_HEADERS: { key: string; value: string }[] = [
  // Only ever HTTPS for this host, remembered by the browser.
  { key: 'Strict-Transport-Security', value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains` },
  // No other site may put these pages in a frame (clickjacking). The CSP's
  // frame-ancestors says the same to newer browsers; this covers the rest.
  { key: 'X-Frame-Options', value: 'DENY' },
  // A file is what its type says it is; the browser must not guess.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // A link out of the app tells the destination the site, not the page.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The sites never use these; say so, so an injected page cannot either.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

export type CspInput = {
  /** The per-request nonce, base64. */
  nonce: string;
  /** The Supabase project URL, so the browser may call it. */
  supabaseUrl: string;
  /** Development needs eval for React's error overlays; production does not. */
  isDev: boolean;
};

/** The policy for one response. */
export function contentSecurityPolicy({ nonce, supabaseUrl, isDev }: CspInput): string {
  const supabase = new URL(supabaseUrl);
  const supabaseWs = `wss://${supabase.host}`;
  const directives = [
    `default-src 'self'`,
    // Scripts: the page's own, marked with this request's nonce, and what
    // they load ('strict-dynamic'). No other source, inline or remote.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Styles: inline style attributes are used for computed values (a
    // tile's animation delay, a bar segment's width), so inline is allowed
    // for styles. Scripts, which matter, are not.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    // Fonts are self-hosted through next/font.
    `font-src 'self'`,
    // The browser talks to this site and to Supabase (REST and realtime).
    `connect-src 'self' ${supabase.origin} ${supabaseWs}`,
    // A generated PDF opens in a new window as a data: URL inside a frame.
    `frame-src 'self' blob: data:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ];
  return directives.join('; ');
}

/** A fresh nonce for one request. */
export function newNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString('base64');
}
