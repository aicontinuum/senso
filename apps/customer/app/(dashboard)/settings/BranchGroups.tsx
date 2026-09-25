// A list split under a heading per branch. A group with no name is the
// whole list, drawn without a heading, which is what a single-branch
// customer gets. An empty named group still shows, so a branch with
// nothing installed yet is visible rather than missing. The heading is the
// same one the dashboard uses: the site's name at section-title weight,
// with what the caller wants said beside it.

type Group<T> = { name: string | null; items: T[] };

type Props<T> = {
  groups: Group<T>[];
  empty: string;
  emptyInBranch: string;
  /** What a branch heading says beside the name: a count, a state. */
  summary?: (items: T[]) => React.ReactNode;
  renderList: (items: T[]) => React.ReactNode;
};

export function BranchGroups<T>({ groups, empty, emptyInBranch, summary, renderList }: Props<T>) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0 && groups.every((g) => g.name === null)) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.name ?? ""} aria-label={g.name ?? undefined}>
          {g.name && (
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-base font-semibold tracking-tight">{g.name}</h3>
              {summary && g.items.length > 0 && <p className="text-sm font-medium">{summary(g.items)}</p>}
            </div>
          )}
          {g.items.length === 0
            ? <p className="text-sm text-muted-foreground">{emptyInBranch}</p>
            : renderList(g.items)}
        </section>
      ))}
    </div>
  );
}
