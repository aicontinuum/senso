import { mockCustomer, mockSensors, mockGateway } from "@senso/mock-data";
import { AccountInfoSection } from "./AccountInfoSection";
import { SensorsSection } from "./SensorsSection";
import { GatewaysSection } from "./GatewaysSection";
import { AlertRecipientsSection } from "./AlertRecipientsSection";
import { ChangePasswordSection } from "./ChangePasswordSection";

export default function SettingsPage() {
  return (
    <div className="max-w-lg space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>
      <AccountInfoSection customer={mockCustomer} />
      <SensorsSection sensors={mockSensors} />
      <GatewaysSection gateways={[mockGateway]} />
      <AlertRecipientsSection />
      <ChangePasswordSection />
    </div>
  );
}
