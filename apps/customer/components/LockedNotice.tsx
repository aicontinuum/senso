import { Lock } from "lucide-react";

// Shown on the login page to an account that was just signed out because
// it is suspended. Says why, and how to reach Senso.

export type SupportContact = { phone: string | null; email: string | null };

export function LockedNotice({ contact }: { contact: SupportContact }) {
  return (
    <div role="alert" className="mb-6 rounded-card border border-alert-border bg-alert-soft p-5 text-center">
      <Lock className="mx-auto size-6 text-alert-text" aria-hidden />
      <p className="mt-2 font-display text-lg font-bold text-alert-text">This account is locked</p>
      <p className="mt-1 text-sm text-alert-text">Please contact the Senso team to unlock it.</p>
      {(contact.phone || contact.email) && (
        <dl className="mt-3 space-y-1 text-sm text-alert-text">
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
    </div>
  );
}
