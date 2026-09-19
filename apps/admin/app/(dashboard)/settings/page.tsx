import { createAdminClient } from '@/lib/supabase/admin';
import { loadSettings } from '@/lib/billing/detail';
import { BillingSettingsForm } from '@/components/settings/BillingSettingsForm';

export default async function AdminSettingsPage() {
  const settings = await loadSettings(createAdminClient());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <BillingSettingsForm settings={settings} />
    </div>
  );
}
