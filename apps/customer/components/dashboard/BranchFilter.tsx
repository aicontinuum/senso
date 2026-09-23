'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ALL_BRANCHES, BRANCH_PARAM, type BranchOption } from '@/lib/branches';

// All, or one branch. The choice lives in the URL, so the page stays a
// server component and a filtered view is a link you can send to someone.

type Props = { branches: BranchOption[]; selected: string; className?: string };

export function BranchFilter({ branches, selected, className }: Props) {
  const router = useRouter();
  const options = [{ value: ALL_BRANCHES, label: 'All branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))];

  function choose(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === ALL_BRANCHES) params.delete(BRANCH_PARAM); else params.set(BRANCH_PARAM, value);
    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname);
  }

  return <SegmentedControl options={options} value={selected} onChange={choose} aria-label="Branch" className={className} />;
}
