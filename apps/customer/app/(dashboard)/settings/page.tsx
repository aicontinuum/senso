import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/supabase/get-customer";
import { loadSettings } from "@/lib/settings/load";
import { AccountInfoSection } from "./AccountInfoSection";
import { SensorsSection } from "./SensorsSection";
import { GatewaysSection } from "./GatewaysSection";
import { AlertRecipientsSection } from "./AlertRecipientsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { TimezoneSection } from "./TimezoneSection";

export default async function SettingsPage() {
  const customer = await requireCustomer();
  const supabase = await createClient();
  const { now, customerShape, branches, initialAlertEmails, sensorGroups, gatewayGroups } = await loadSettings(supabase, customer);

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountInfoSection customer={customerShape} />
      <TimezoneSection initialTimezone={customer.timezone} />
      {/* An owner login has no devices and is emailed about nothing of its
          own; those cards belong to the member accounts. */}
      {!customer.is_group && (
        <>
          <SensorsSection groups={sensorGroups} />
          <GatewaysSection groups={gatewayGroups} timezone={customer.timezone} now={now} />
          <AlertRecipientsSection initialEmails={initialAlertEmails} branches={branches} />
        </>
      )}
      <ChangePasswordSection />
    </div>
  );
}
