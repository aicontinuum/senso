'use client';

import { useRouter } from 'next/navigation';
import { Select } from '@senso/ui';
import { ALL_BRANCHES, BRANCH_PARAM, type BranchOption } from '@/lib/branches';

// All, or one branch, as a dropdown: one control on one line at any count,
// and on a phone the native picker, which is the best list there is for a
// dozen sites. The choice lives in the URL, so the page stays a server
// component and a filtered view is a link you can send to someone.

type Props = { branches: BranchOption[]; selected: string; className?: string };

export function BranchFilter({ branches, selected, className }: Props) {
  const router = useRouter();

  function choose(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === ALL_BRANCHES) params.delete(BRANCH_PARAM); else params.set(BRANCH_PARAM, value);
    const query = params.toString();
    router.push(query ? `?${query}` : window.location.pathname);
  }

  return (
    <Select aria-label="Branch" value={selected} onChange={e => choose(e.target.value)} wrapperClassName={className}>
      <option value={ALL_BRANCHES}>All branches</option>
      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
    </Select>
  );
}
