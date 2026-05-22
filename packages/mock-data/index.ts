import type {
  Customer,
  Gateway,
  Sensor,
  Reading,
  AlertConfig,
  Alert,
} from '@senso/types';

export const mockCustomer: Customer = {
  id: 'customer_001',
  name: 'Al Noor Pharmacy',
  contactName: 'Ahmed Al-Mansoori',
  contactEmail: 'ahmed@alnoor-pharmacy.qa',
  billingStatus: 'active',
  createdAt: '2024-09-01T08:00:00.000Z',
};

export const mockGateway: Gateway = {
  id: 'gateway_001',
  customerId: 'customer_001',
  name: 'Al Noor Main Site',
  status: 'online',
  lastSeen: '2025-05-21T17:00:00.000Z',
  firmwareVersion: '1.2.4',
};

const buildReadings = (
  sensorId: string,
  baseTemp: number,
  variance: number,
): Reading[] => {
  const now = new Date('2025-05-21T17:00:00.000Z');
  return Array.from({ length: 96 }, (_, i) => {
    const ts = new Date(now.getTime() - (95 - i) * 15 * 60 * 1000);
    const offset = (Math.random() * 2 - 1) * variance;
    return {
      id: `reading_${sensorId}_${i + 1}`,
      sensorId,
      temperature: Math.round((baseTemp + offset) * 10) / 10,
      recordedAt: ts.toISOString(),
    };
  });
};

const coldStorageAReadings = buildReadings('sensor_001', 4.2, 0.8);
const coldStorageBReadings = buildReadings('sensor_002', 3.9, 0.6);
const medicineFridgeReadings = buildReadings('sensor_003', 6.1, 0.4);
const labFreezerReadings = buildReadings('sensor_004', -18.5, 1.2);

export const mockSensors: Sensor[] = [
  {
    id: 'sensor_001',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Cold Storage A',
    status: 'online',
    lastReading: coldStorageAReadings[coldStorageAReadings.length - 1],
  },
  {
    id: 'sensor_002',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Cold Storage B',
    status: 'online',
    lastReading: coldStorageBReadings[coldStorageBReadings.length - 1],
  },
  {
    id: 'sensor_003',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Medicine Fridge',
    status: 'online',
    lastReading: medicineFridgeReadings[medicineFridgeReadings.length - 1],
  },
  {
    id: 'sensor_004',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Lab Freezer',
    status: 'offline',
    lastReading: labFreezerReadings[labFreezerReadings.length - 1],
  },
];

export const mockReadings: Record<string, Reading[]> = {
  sensor_001: coldStorageAReadings,
  sensor_002: coldStorageBReadings,
  sensor_003: medicineFridgeReadings,
  sensor_004: labFreezerReadings,
};

export const mockAlertConfigs: AlertConfig[] = [
  {
    id: 'alertconfig_001',
    sensorId: 'sensor_001',
    minTemp: 2,
    maxTemp: 8,
    emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'ops@alnoor-pharmacy.qa'],
  },
  {
    id: 'alertconfig_002',
    sensorId: 'sensor_002',
    minTemp: 2,
    maxTemp: 8,
    emailRecipients: ['ahmed@alnoor-pharmacy.qa'],
  },
  {
    id: 'alertconfig_003',
    sensorId: 'sensor_003',
    minTemp: 2,
    maxTemp: 8,
    emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'pharmacist@alnoor-pharmacy.qa'],
  },
  {
    id: 'alertconfig_004',
    sensorId: 'sensor_004',
    minTemp: -25,
    maxTemp: -15,
    emailRecipients: ['ahmed@alnoor-pharmacy.qa'],
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'alert_001',
    sensorId: 'sensor_003',
    type: 'above_max',
    temperature: 9.4,
    triggeredAt: '2025-05-21T09:15:00.000Z',
    resolvedAt: '2025-05-21T09:52:00.000Z',
  },
  {
    id: 'alert_002',
    sensorId: 'sensor_004',
    type: 'above_max',
    temperature: -13.1,
    triggeredAt: '2025-05-21T14:30:00.000Z',
  },
];
