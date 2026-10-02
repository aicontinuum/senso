import Link from 'next/link';
import { ArrowLeft, Check, ChevronLeft, Plus } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@senso/ui';

// The frame both register pages share: a way back to Devices, the page
// title, and one card holding the form. On success the card becomes a
// notice with the two next steps, back to the list or another of the
// same kind, the way New customer ends.

type PageProps = {
  title: string;
  /** The card's own heading, so it does not repeat the page title. */
  cardTitle: string;
  description: string;
  children: React.ReactNode;
};

export function RegisterPage({ title, cardTitle, description, children }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/devices">
            <ChevronLeft className="size-4" />
            Devices
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <Card className="max-w-xl">
        <CardHeader className="border-b border-hairline">
          <CardTitle>{cardTitle}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {children}
      </Card>
    </div>
  );
}

type DoneProps = {
  title: string;
  message: string;
  anotherLabel: string;
  onAnother: () => void;
};

export function RegisteredNotice({ title, message, anotherLabel, onAnother }: DoneProps) {
  return (
    <CardContent className="space-y-4 px-5 py-8 text-center animate-[senso-rise_var(--dur-base)_var(--ease-out)_both]">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok-text">
        <Check className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href="/devices">
            <ArrowLeft className="size-4" />
            Back to devices
          </Link>
        </Button>
        <Button variant="secondary" onClick={onAnother}>
          <Plus className="size-4" />
          {anotherLabel}
        </Button>
      </div>
    </CardContent>
  );
}
