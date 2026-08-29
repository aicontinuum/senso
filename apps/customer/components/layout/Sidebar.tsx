"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/alerts": Bell,
  "/reports": FileText,
  "/settings": Settings,
};

interface Props {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapse: () => void;
  onMobileClose: () => void;
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapse,
  onMobileClose,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-200 print:hidden",
        // Mobile: fixed overlay, slides in/out
        "fixed left-0 top-0 z-30 w-56",
        mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
        // Desktop: in-flow, collapsible width
        "md:relative md:left-auto md:top-auto md:z-auto md:translate-x-0 md:shadow-none",
        collapsed ? "md:w-16" : "md:w-56",
      )}
    >
      {/* Header row — controls only; the brand sits below the divider */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center justify-end border-b px-3",
          collapsed && "md:justify-center md:px-1",
        )}
      >
        {/* Mobile: close button */}
        <button
          onClick={onMobileClose}
          className="rounded-md p-1.5 hover:bg-accent md:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Desktop: collapse toggle */}
        <button
          onClick={onToggleCollapse}
          className="hidden rounded-md p-1.5 hover:bg-accent md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = NAV_ICONS[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors",
                collapsed && "md:justify-center md:gap-0",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {Icon && <Icon className="h-4 w-4 shrink-0" />}
              <span className={cn(collapsed && "md:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      {/* Logout */}
      <div className="shrink-0 border-t px-2 py-3">
        <button
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            collapsed && "md:justify-center md:gap-0",
          )}
          title={collapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(collapsed && "md:hidden")}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
