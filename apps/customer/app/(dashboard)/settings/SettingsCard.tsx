import { Card, CardDescription, CardHeader, CardTitle } from "@senso/ui";

// One shape for every card on the settings page: a header row with the title,
// an optional description and an optional action, a hairline, then the body.
// The sections differ in what they hold, not in how they are framed.
export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Omit for a card that is only its header, such as a collapsed form. */
  children?: React.ReactNode;
}) {
  return (
    <Card asChild className="overflow-hidden">
      <section aria-label={title}>
        <CardHeader className={children ? "border-b border-hairline" : undefined}>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{title}</CardTitle>
            {action}
          </div>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        {children && <div className="p-5">{children}</div>}
      </section>
    </Card>
  );
}
