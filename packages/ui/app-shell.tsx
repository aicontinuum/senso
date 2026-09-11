"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { NavItem } from "./nav";

interface AppShellProps {
  children: React.ReactNode;
  appName: string;
  /** Override the brand artwork; admin uses a lockup carrying an ADMIN badge. */
  logoSrc?: string;
  navItems: NavItem[];
  /** Right-hand header slot. */
  headerRight?: React.ReactNode;
  /** Sign-out, supplied by the app because each has its own client and redirect. */
  onLogout: () => void;
}

export function AppShell({ children, appName, logoSrc, navItems, headerRight, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // The bar spans the full width and the rail starts under it, so the rail's
  // edge and the bar's edge meet at a corner instead of crossing. A rail that
  // ran up beside the bar needed an empty header-height row with its own rule
  // just to make the two lines line up, and left a cross where they met.
  return (
    <div className="flex h-full flex-col overflow-hidden print:block print:h-auto print:overflow-visible">
      <Header
        onMenuClick={() => setMobileOpen((v) => !v)}
        appName={appName}
        logoSrc={logoSrc}
        right={headerRight}
      />

      <div className="flex min-h-0 flex-1 print:block">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <Sidebar
          navItems={navItems}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onLogout={onLogout}
        />

        <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
