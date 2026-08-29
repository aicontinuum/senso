"use client"; // Error boundaries must be Client Components
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-sm rounded-lg border bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This page couldn’t load. Try again in a moment.
        </p>
        <Button className="mt-5" onClick={() => unstable_retry()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
