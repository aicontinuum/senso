import { mockCustomer } from "@senso/mock-data";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {mockCustomer.name}
        </span>
      </div>
    </header>
  );
}
