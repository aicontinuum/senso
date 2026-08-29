import type { Metadata } from "next";
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
  description: "Temperature monitoring dashboard",
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
