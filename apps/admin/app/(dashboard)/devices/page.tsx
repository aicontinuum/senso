import { Card, CardContent } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadNetworkDevices } from '@/lib/network/load';
import { NETWORK_NOT_CONFIGURED, NETWORK_SERVER_UNAVAILABLE } from '@/lib/billing/route-helpers';
import { RegisterGatewayForm } from '@/components/devices/RegisterGatewayForm';
import { RegisterSensorForm } from '@/components/devices/RegisterSensorForm';
import { NetworkDevicesTable } from '@/components/devices/NetworkDevicesTable';

// Office prep for new hardware: register it on the network server here,
// then link it to a customer on the customer's page. Two forms, one per
// kind of device, and below them everything the network server knows.

export default async function DevicesPage() {
  const devices = await loadNetworkDevices(createAdminClient());

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
      {devices.state === 'ok' ? (
        <NetworkDevicesTable rows={devices.rows} now={devices.now} />
      ) : (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm font-medium">{devices.state === 'unconfigured' ? NETWORK_NOT_CONFIGURED : NETWORK_SERVER_UNAVAILABLE}</p>
            {devices.state === 'unreachable' && <p className="mt-1 text-xs text-muted-foreground">The list of registered devices cannot be shown until it does.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
