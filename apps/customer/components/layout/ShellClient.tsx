"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

export function ShellClient({ children, customerName }: { children: React.ReactNode; customerName: string }) {
  const [collapsed, setCollapsed] = useState(false);
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
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        <Header onMenuClick={() => setMobileOpen((v) => !v)} customerName={customerName} />
        <main className="flex-1 overflow-auto p-4 sm:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
