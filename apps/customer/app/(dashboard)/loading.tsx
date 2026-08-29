import { Spinner } from "@/components/ui/spinner";

// Rendered instantly on navigation while the route's server component fetches.
//
// Without a loading.tsx there is no Suspense boundary, so the browser waits for
// the entire server response before painting anything and the page appears
// frozen after a click. Sitting at the (dashboard) group level means it covers
// every dashboard route from one file, and the nav shell in layout.tsx stays
// mounted and interactive while the content swaps.
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
