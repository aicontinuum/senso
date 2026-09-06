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
        {/* Devices are installed by a technician, not self-served: a sensor has to
            be registered on the network and physically mounted before it records
            anything. "Coming soon" implied a feature was on its way. */}
        <p className="mt-2 text-muted-foreground">
          Contact the Senso team if you need to add more sensors.
        </p>
      </div>
    </div>
  );
}
