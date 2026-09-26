"use client";

import { LogOut } from "lucide-react";
import { Button } from "@senso/ui";
import { useLogout } from "@/hooks/useLogout";

export function LogoutButton() {
  const logout = useLogout();
  return (
    <Button variant="secondary" onClick={logout}>
      <LogOut className="size-4" />
      Log out
    </Button>
  );
}
