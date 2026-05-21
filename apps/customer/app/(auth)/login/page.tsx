import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-secondary">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold">{APP_NAME}</h1>
        <p className="text-sm text-muted-foreground">
          Login — coming soon
        </p>
      </div>
    </div>
  );
}
