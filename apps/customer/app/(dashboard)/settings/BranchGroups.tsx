// A list split under a heading per branch. A group with no name is the
// whole list, drawn without a heading, which is what a single-branch
// customer gets. An empty named group still shows, so a branch with
// nothing installed yet is visible rather than missing.

type Group<T> = { name: string | null; items: T[] };

type Props<T> = {
  groups: Group<T>[];
  empty: string;
  emptyInBranch: string;
  renderList: (items: T[]) => React.ReactNode;
};

export function BranchGroups<T>({ groups, empty, emptyInBranch, renderList }: Props<T>) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  if (total === 0 && groups.every((g) => g.name === null)) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.name ?? ""} aria-label={g.name ?? undefined}>
          {g.name && <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{g.name}</h3>}
          {g.items.length === 0
            ? <p className="text-sm text-muted-foreground">{emptyInBranch}</p>
            : renderList(g.items)}
        </section>
      ))}
    </div>
  );
}
