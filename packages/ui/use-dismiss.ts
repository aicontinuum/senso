'use client';

import { useEffect, useRef, type RefObject } from 'react';

// A panel that opened under a row closes the way a menu does: a click
// anywhere outside it, or Escape, counts as Cancel. The decision is made
// on the completed click, so starting a scroll does not dismiss it, but it
// is judged against the panel that was open when the press began: a click
// on another row's button has already opened that row's panel by the time
// the click bubbles here (React flushes click handlers before the event
// reaches the document), and that new panel must stay. Pass active=false
// while the panel is busy so a stray tap cannot dismiss a request in flight.
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  // The panel the current press started outside of, or null.
  const pressedOutside = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    function onPointerDown(event: PointerEvent) {
      const panel = ref.current;
      pressedOutside.current = panel && event.target instanceof Node && !panel.contains(event.target) ? panel : null;
    }
    function onClick(event: MouseEvent) {
      const panel = ref.current;
      const outside = pressedOutside.current;
      pressedOutside.current = null;
      if (panel && outside === panel && event.target instanceof Node && !panel.contains(event.target)) dismiss.current();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss.current();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, active]);
}
