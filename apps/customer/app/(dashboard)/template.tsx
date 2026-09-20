import { PageTransition } from "@senso/ui";

// A template, not a layout: it remounts on every navigation, so each page
// arrives with the same short rise and at the top of its scroll container.
// The shell around it stays put.
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
