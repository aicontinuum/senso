// An account's devices in two numbers, for a list row: how many live
// sensors it has and whether any gateway is up. Retired devices keep
// their readings but are not counted as live. Used wherever accounts are
// listed, so every list agrees on what "6 sensors, online" means.

export type GatewaySummaryRow = {
  id: string;
  is_online: boolean;
  decommissioned_at: string | null;
  sensors?: { id: string; decommissioned_at: string | null }[] | null;
};

export type GatewayStatus = 'none' | 'online' | 'offline';

export type DeviceSummary = { sensorCount: number; gwStatus: GatewayStatus };

export function summariseDevices(rows: GatewaySummaryRow[] | null | undefined): DeviceSummary {
  const gateways = (rows ?? []).filter(gw => gw.decommissioned_at === null);
  const sensorCount = gateways.reduce(
    (sum, gw) => sum + (gw.sensors ?? []).filter(s => s.decommissioned_at === null).length,
    0,
  );
  const anyOnline = gateways.some(gw => gw.is_online);
  return { sensorCount, gwStatus: gateways.length === 0 ? 'none' : anyOnline ? 'online' : 'offline' };
}

/** The gateway columns a list query embeds to feed summariseDevices(). */
export const GATEWAY_SUMMARY_SELECT = 'gateways (id, is_online, decommissioned_at, sensors (id, decommissioned_at))';
