"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";

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

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r bg-card transition-all duration-200 print:hidden",
        // Mobile: fixed overlay, slides in/out
        "fixed left-0 top-0 z-30 w-56",
        mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
        // Desktop: in-flow, collapsible width
        "md:relative md:left-auto md:top-auto md:z-auto md:translate-x-0 md:shadow-none",
        collapsed ? "md:w-14" : "md:w-56",
      )}
    >
      {/* Header row */}
      <div className="flex h-14 shrink-0 items-center border-b px-3">
        <span
          className={cn(
            "flex-1 truncate px-1 text-lg font-bold tracking-tight",
            collapsed && "md:hidden",
          )}
        >
          {APP_NAME}
        </span>

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
          className={cn(
            "hidden rounded-md p-1.5 hover:bg-accent md:block",
            collapsed && "mx-auto",
          )}
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
      <nav className="flex-1 space-y-1 px-2 py-4">
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
    </aside>
  );
}
