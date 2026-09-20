"use client";

import { useLayoutEffect, useRef } from "react";

// The wrapper a per-navigation template renders: each page arrives with the
// same short rise, and starts at the top.
//
// The scroll container is <main>, not the window, so the router's own reset
// (which checks the window viewport) leaves a little residual scroll in place
// whenever the new page's top is still on screen. This scrolls the nearest
// scrollable ancestor to the top on mount, before paint, so a page never
// opens mid-header. Under reduced motion the rise duration token is 0 and
// the entrance is a cut; the scroll reset is instant either way.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let node: HTMLElement | null = ref.current?.parentElement ?? null;
    while (node && node !== document.body) {
      const { overflowY } = getComputedStyle(node);
      if ((overflowY === "auto" || overflowY === "scroll") && node.scrollTop > 0) {
        node.scrollTop = 0;
        return;
      }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div ref={ref} className="animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      {children}
    </div>
  );
}
