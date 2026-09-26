import { Lock } from "lucide-react";
import { ShellClient } from "@/components/layout/ShellClient";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { LogoutButton } from "@/components/LogoutButton";

// What a suspended account sees instead of the app: the shell and a
// dashboard-shaped stand-in, blurred and inert behind a card that says the
// account is locked and how to reach Senso. The stand-in is the loading
// skeleton, not the real page, so there is no data behind the blur to
// uncover; nothing but the Log out button responds.

export type SupportContact = { phone: string | null; email: string | null };

export function LockedAccount({ customerName, contact }: { customerName: string; contact: SupportContact }) {
  return (
    <div className="relative min-h-dvh">
      <div inert aria-hidden className="pointer-events-none select-none blur-sm">
        <ShellClient customerName={customerName}>
          <DashboardSkeleton />
        </ShellClient>
      </div>

      <div role="dialog" aria-modal="true" aria-labelledby="locked-title" className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 p-4">
        <div className="w-full max-w-md rounded-card border border-alert-border bg-alert-soft p-6 text-center shadow-lg">
          <Lock className="mx-auto size-8 text-alert-text" aria-hidden />
          <h1 id="locked-title" className="mt-3 font-display text-xl font-bold text-alert-text">This account is locked</h1>
          <p className="mt-2 text-sm text-alert-text">
            Please contact the Senso team to unlock it.
          </p>
          {(contact.phone || contact.email) && (
            <dl className="mt-4 space-y-1 text-sm text-alert-text">
              {contact.phone && (
                <div className="flex justify-center gap-2">
                  <dt className="font-medium">Phone</dt>
                  <dd><a href={`tel:${contact.phone}`} className="underline">{contact.phone}</a></dd>
                </div>
              )}
              {contact.email && (
                <div className="flex justify-center gap-2">
                  <dt className="font-medium">Email</dt>
                  <dd><a href={`mailto:${contact.email}`} className="underline">{contact.email}</a></dd>
                </div>
              )}
            </dl>
          )}
          <div className="mt-6">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
