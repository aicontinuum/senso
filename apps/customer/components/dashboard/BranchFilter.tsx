'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { ALL_BRANCHES, BRANCH_PARAM } from '@/lib/branches';

// All, or one site (a branch, or for an owner login a member account). The
// choice lives in the URL, so the page stays a server component and a
// filtered view is a link you can send to someone.

type Props = { branches: { id: string; name: string }[]; selected: string; allLabel: string; className?: string };

export function BranchFilter({ branches, selected, allLabel, className }: Props) {
  const router = useRouter();
  const options = [{ value: ALL_BRANCHES, label: allLabel }, ...branches.map(b => ({ value: b.id, label: b.name }))];

  function choose(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === ALL_BRANCHES) params.delete(BRANCH_PARAM); else params.set(BRANCH_PARAM, value);
    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname);
  }

  return <SegmentedControl options={options} value={selected} onChange={choose} aria-label="Site" className={className} />;
}
