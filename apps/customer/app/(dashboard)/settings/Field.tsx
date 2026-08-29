// Label-above-value row, shared by the settings sections.
//
// Was defined identically in two of them; kept here so the settings page has one
// definition of what a field looks like.
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
