"use client";

import { useRouter } from "next/navigation";
import { LayoutDashboard, Users, Cpu, CreditCard, Settings } from "lucide-react";
import { AppShell, type NavItem } from "@senso/ui";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME, NAV_ITEMS } from "@/lib/constants";

const NAV_ICONS: Record<string, NavItem["icon"]> = {
  "/dashboard": LayoutDashboard,
  "/customers": Users,
  "/devices": Cpu,
  "/billing": CreditCard,
  "/settings": Settings,
};

const navItems: NavItem[] = NAV_ITEMS.map((item) => ({
  ...item,
  icon: NAV_ICONS[item.href],
}));

export function ShellClient({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Sign-out stays here rather than in the shared shell: each app has its own
  // Supabase client and its own post-logout destination.
  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <AppShell
      appName={APP_NAME}
      navItems={navItems}
      headerRight="Admin"
      onLogout={handleLogout}
    >
      {children}
    </AppShell>
  );
}
