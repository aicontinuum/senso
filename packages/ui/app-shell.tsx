"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import type { NavItem } from "./nav";

interface AppShellProps {
  children: React.ReactNode;
  appName: string;
  navItems: NavItem[];
  /** Right-hand header slot. */
  headerRight?: React.ReactNode;
  /** Sign-out, supplied by the app because each has its own client and redirect. */
  onLogout: () => void;
}

export function AppShell({ children, appName, navItems, headerRight, onLogout }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-full overflow-hidden print:block print:h-auto print:overflow-visible">
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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <Header onMenuClick={() => setMobileOpen((v) => !v)} appName={appName} right={headerRight} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 print:overflow-visible print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
