import type { Metadata, Viewport } from "next";
import { Poppins, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/lib/constants";

// The design system's three voices. Loaded through next/font rather than the
// Google Fonts @import its tokens/fonts.css ships, so the families are
// self-hosted: no render-blocking request to a third party, and no layout shift.
// globals.css maps these variables onto --font-display / --font-sans / --font-mono.

// Brand voice: headings, KPI numbers, sensor readings.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

// Everything else: labels, body, table cells, buttons.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
});

// Machine values only: timestamps, device IDs, axis ticks, units.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Senso administration",
};

// Every page is rendered per request, never at build time. The Content-
// Security-Policy from proxy.ts marks the page's scripts with a nonce that
// Next stamps in while rendering; a page prerendered at build time has no
// nonce, so the browser refuses all of its scripts and anything drawn by
// the browser (the login form, the root redirect) never appears.
export const dynamic = "force-dynamic";

// The platform layer that separates "a website in a browser" from something
// that feels installed. viewport-fit lets the page under the notch so the
// header can paint edge to edge; the theme colour matches the top bar, not the
// brand; and zoom stays enabled — the 16px inputs below are what stop iOS
// zooming into a field, not a scale lock.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${jakarta.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="h-full font-sans">{children}</body>
    </html>
  );
}
