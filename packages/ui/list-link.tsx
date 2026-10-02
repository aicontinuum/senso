'use client';

import Link, { useLinkStatus } from 'next/link';
import { cn } from './cn';

// A phone list row that is a link: the whole row navigates, and between
// the tap and the new page it dims, so a slow connection never reads as
// an ignored tap. The layout classes go on the body, which is what dims;
// the Link itself is only the block that catches the tap.

interface ListLinkProps extends Omit<React.ComponentProps<typeof Link>, 'className'> {
  /** On the body, which is what dims: the row's layout and hover classes. */
  className?: string;
  /** On the link itself, for how it sits among siblings (a flex-1, say). */
  wrapperClassName?: string;
}

function Body({ className, children }: { className?: string; children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <div
      aria-busy={pending || undefined}
      className={cn('transition-[background-color,opacity] duration-[--dur-fast]', pending && 'opacity-60', className)}
    >
      {children}
    </div>
  );
}

export function ListLink({ className, wrapperClassName, children, ...props }: ListLinkProps) {
  return (
    <Link {...props} className={cn('block', wrapperClassName)}>
      <Body className={className}>{children}</Body>
    </Link>
  );
}
