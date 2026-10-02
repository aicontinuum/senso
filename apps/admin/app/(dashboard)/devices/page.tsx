import Link from 'next/link';
import { Plus, Radio } from 'lucide-react';
import { Button, Card, CardContent } from '@senso/ui';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadNetworkDevices } from '@/lib/network/load';
import { NETWORK_NOT_CONFIGURED, NETWORK_SERVER_UNAVAILABLE } from '@/lib/billing/route-helpers';
import { NetworkDevicesCard } from '@/components/devices/NetworkDevicesCard';

// Everything the network server knows, first, since that is what the
// page is opened to check: gateways, the few things that can take a
// whole site down, then the sensors. Registering new hardware is rare,
// so it is two buttons in the title row, each to its own page, and the
// device is then linked to a customer on the customer's page.

export default async function DevicesPage() {
  const devices = await loadNetworkDevices(createAdminClient());

  return (
    <div className="space-y-6">
      {/* The two ways in share a row with the title from tablet width up; on
          a phone they take a full-width row of their own, as an even pair. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
          <p className="mt-1 text-sm text-muted-foreground">Hardware on the network server, and what it is linked to.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Button asChild variant="secondary" size="sm" className="flex-1 sm:flex-none">
            <Link href="/devices/new-gateway">
              <Radio className="size-4" />
              Register gateway
            </Link>
          </Button>
          <Button asChild size="sm" className="flex-1 sm:flex-none">
            <Link href="/devices/new-sensor">
              <Plus className="size-4" />
              Register sensor
            </Link>
          </Button>
        </div>
      </div>
      {devices.state === 'ok' ? (
        <>
          <NetworkDevicesCard kind="gateway" rows={devices.rows.filter(r => r.kind === 'gateway')} now={devices.now} />
          <NetworkDevicesCard kind="sensor" rows={devices.rows.filter(r => r.kind === 'sensor')} now={devices.now} />
        </>
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
