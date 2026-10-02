'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from './cn';

// A table row that navigates when clicked anywhere, so a list of customers
// does not make people hunt for the one word that is a link.
//
// The row keeps a real <Link> in its first cell for keyboard users and screen
// readers; this only widens the mouse target. Clicks that land on a nested
// link or button are left alone so those keep their own behaviour.
//
// The navigation runs in a transition, so between the click and the new
// page the row dims: feedback from the press, not from the reply, which on
// a slow connection is the difference between one click and three.

interface LinkRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  href: string;
}

export function LinkRow({ href, className, onClick, children, ...props }: LinkRowProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <tr
      {...props}
      aria-busy={pending || undefined}
      className={cn(
        'cursor-pointer transition-[background-color,opacity] duration-[--dur-fast] hover:bg-sunken active:bg-inset',
        pending && 'opacity-60',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if ((event.target as HTMLElement).closest('a, button')) return;
        startTransition(() => router.push(href));
      }}
    >
      {children}
    </tr>
  );
}
