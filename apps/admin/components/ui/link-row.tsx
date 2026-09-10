'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@senso/ui';

// A table row that navigates when clicked anywhere, so a list of customers
// does not make people hunt for the one word that is a link.
//
// The row keeps a real <Link> in its first cell for keyboard users and screen
// readers; this only widens the mouse target. Clicks that land on a nested
// link or button are left alone so those keep their own behaviour.

interface LinkRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  href: string;
}

export function LinkRow({ href, className, onClick, children, ...props }: LinkRowProps) {
  const router = useRouter();

  return (
    <tr
      {...props}
      className={cn('cursor-pointer transition-colors hover:bg-sunken', className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if ((event.target as HTMLElement).closest('a, button')) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
