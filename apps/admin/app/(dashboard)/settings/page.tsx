import { createAdminClient } from '@/lib/supabase/admin';
import { loadSettings } from '@/lib/billing/detail';
import { BillingSettingsCards } from '@/components/settings/BillingSettingsCards';

export default async function AdminSettingsPage() {
  const settings = await loadSettings(createAdminClient());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <BillingSettingsCards settings={settings} />
    </div>
  );
}
