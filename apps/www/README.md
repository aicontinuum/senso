# Senso marketing site — www.sensoqa.com

Static files, no framework, no build step. Edit the HTML and push.

```
index.html          Home
how-it-works.html   How it works   (served as /how-it-works)
privacy.html        Privacy policy (served as /privacy)
styles.css          Design tokens + the few component rules
site.js             Mobile menu
assets/             Logos, the how-it-works illustration, the sensor photo
                    (now only the link-preview image), the Bloctech mark
vercel.json         Clean URLs, sensoqa.com → www redirect, security headers
```

## Hosting

Its own Vercel project, separate from the two apps:

- Framework preset **Other**, root directory `apps/www`, no build command,
  output directory left blank.
- Domains `www.sensoqa.com` (primary) and `sensoqa.com`. The apex
  redirects to www; the rule is in `vercel.json`, so Vercel's own
  domain redirect can be left off.

Vercel deploys from `main` on its own, but only when a commit touches a
file inside `apps/www`. To force a redeploy, use **Redeploy** on the
latest entry in the project's Deployments tab.

The only third-party request a visitor makes is for the Google fonts.
Everything else is served from this folder. The Content-Security-Policy
in `vercel.json` says so; a new external script, image host or embed
needs adding there or the browser blocks it.

## Still placeholders

Fill these when the office decides them:

- ~~WhatsApp number~~ done: +974 5028 8285 in every `wa.me` link
- ~~Email~~ done: `info@sensoqa.com`, forwarded through Cloudflare Email Routing
- ~~Privacy~~ done: `/privacy`, text supplied by the office 2026-10-09. No
  Terms page, by decision; the footer links only to Privacy.
- ~~The **Book a site visit** form~~ gone, by decision (2026-10-09): every
  inquiry button is a plain link to WhatsApp with a short message pre-filled.
  The number and the message are in the `wa.me` links in the three pages;
  search for `wa.me` to change them.

## Where the pages came from

The design was a Claude Design export whose pages were rendered by React
in the browser from unpkg. They were converted once to the static markup
here (icons inlined, buttons and cards turned into classes); the export
itself is not kept in the repo. Change the HTML directly.
