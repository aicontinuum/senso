import { NewAccountForm } from '@/components/customers/NewAccountForm';

// An owner login over several accounts: the same login as any customer,
// flagged as a group, with its members linked on its page afterwards.
export default function NewGroupAccountPage() {
  return <NewAccountForm isGroup />;
}
