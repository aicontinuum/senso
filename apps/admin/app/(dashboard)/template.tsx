// A template, not a layout: it remounts on every navigation, so each page
// arrives with the same short rise. The shell around it stays put. Rare enough
// per page to earn motion, and under 200ms so it never reads as waiting.
// The duration token is 0 under reduced motion, which turns this into a cut.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      {children}
    </div>
  );
}
