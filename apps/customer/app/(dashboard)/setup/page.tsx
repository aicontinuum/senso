import Link from "next/link";

export default function SetupPage() {
  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Dashboard
      </Link>
      <div className="mt-4">
        <h1 className="text-2xl font-bold">Add Device</h1>
        <p className="mt-2 text-muted-foreground">
          Sensor and gateway setup coming soon.
        </p>
      </div>
    </div>
  );
}
