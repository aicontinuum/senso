import { RegisterGatewayForm } from '@/components/devices/RegisterGatewayForm';
import { RegisterSensorForm } from '@/components/devices/RegisterSensorForm';

// Office prep for new hardware: register it on the network server here,
// then link it to a customer on the customer's page. Two forms, one per
// kind of device.

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register new hardware on the network server before it is linked to a customer.
        </p>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <RegisterGatewayForm />
        <RegisterSensorForm />
      </div>
    </div>
  );
}
