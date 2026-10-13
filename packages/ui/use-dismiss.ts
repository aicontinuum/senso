'use client';

import { useEffect, useRef, type RefObject } from 'react';

// A panel that opened under a row closes the way a menu does: a click
// anywhere outside it, or Escape, counts as Cancel. It waits for the
// completed click rather than the press, so starting a scroll does not
// dismiss it and a tap on another row's button lands on that button before
// the panel collapses under it. Whatever was clicked has already handled
// the click by the time onDismiss runs, so a handler that opens a different
// panel wins if onDismiss closes only the panel that was open. Pass
// active=false while the panel is busy so a stray tap cannot dismiss a
// request in flight.
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;

  useEffect(() => {
    if (!active) return;
    function onClick(event: MouseEvent) {
      const panel = ref.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) dismiss.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss.current();
    }
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, active]);
}
