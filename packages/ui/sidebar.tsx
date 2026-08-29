"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, LogOut } from "lucide-react";
import { cn } from "./cn";
import type { NavItem } from "./nav";

// The rail adapts to the viewport rather than to a toggle:
//
//   < 768px   hidden; the header's menu button slides it in as an overlay
//   768–1023  icons only, 64px
//   >= 1024   icons and labels, 248px (--sidebar-width)
//
// Labels come back at lg rather than xl because a 1280px viewport is common on
// 13" laptops, and those are plainly desktops that should show labels.
//
// This is why there is no collapse state: the design system defines exactly one
// --sidebar-width and no collapsed variant, and letting CSS decide removes a
// boolean, a toggle button and nine conditionals.
//
// Labels are hidden only in the middle tier. The mobile drawer is the full 248px
// when open, so it shows them like the wide rail does.
const RAIL_LABEL = "inline md:hidden lg:inline";

interface SidebarProps {
  navItems: NavItem[];
  mobileOpen: boolean;
  onMobileClose: () => void;
  onLogout: () => void;
}

export function Sidebar({ navItems, mobileOpen, onMobileClose, onLogout }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-transform duration-200 print:hidden",
        // Mobile: fixed overlay, slides in and out.
        "fixed left-0 top-0 z-30 w-62",
        mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
        // Desktop: in flow, width set by breakpoint.
        "md:relative md:left-auto md:top-auto md:z-auto md:translate-x-0 md:shadow-none",
        "md:w-16 lg:w-62",
      )}
    >
      {/* Header row. On desktop it holds nothing — the brand lives in the top
          bar — but it stays so this divider lines up with the header's. */}
      <div className="flex h-(--topbar-height) shrink-0 items-center justify-end border-b px-3">
        <button
          onClick={onMobileClose}
          className="rounded-md p-1.5 hover:bg-accent md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              aria-current={isActive ? "page" : undefined}
              // Named explicitly because the label is not rendered in the
              // icons-only tier. `title` would not do this: it is unreliable for
              // screen readers and never appears on keyboard focus.
              aria-label={item.label}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                "md:justify-center md:gap-0 lg:justify-start lg:gap-3",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className={RAIL_LABEL}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t px-2 py-3">
        <button
          onClick={onLogout}
          aria-label="Logout"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            "md:justify-center md:gap-0 lg:justify-start lg:gap-3",
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={RAIL_LABEL}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
