import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@senso/ui';
import { AccountInfoSection, type CustomerRow } from '@/components/customers/AccountInfoSection';
import { AlertRecipientsSection } from '@/components/customers/AlertRecipientsSection';
import { GatewaysSection, type GatewayRow } from '@/components/customers/GatewaysSection';
import { SensorsSection, type SensorRow } from '@/components/customers/SensorsSection';

interface Props {
  customer: CustomerRow;
  gateways: GatewayRow[];
  sensors: SensorRow[];
  /** Server clock at render, so relative times match the rest of the page. */
  now: number;
}

// One customer, top to bottom: who they are, the gateway at their site, the
// sensors on it, and who gets emailed. Each card owns its own editing state.
export function CustomerDetailClient({ customer, gateways, sensors, now }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link href="/customers">
            <ChevronLeft className="size-4" />
            Customers
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
      </div>

      <AccountInfoSection customer={customer} />
      <GatewaysSection customerId={customer.id} gateways={gateways} sensors={sensors} now={now} />
      <SensorsSection customerId={customer.id} gateways={gateways} sensors={sensors} />
      <AlertRecipientsSection customer={customer} />
    </div>
  );
}
