"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Sign out and land on the login page. One place, because the shell's
// header and the locked-account card both offer it.
export function useLogout() {
  const router = useRouter();
  return async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };
}
