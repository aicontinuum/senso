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
  lastSeen: '2025-05-22T03:00:00.000Z',
  firmwareVersion: '1.2.4',
};

// 672 readings = 7 days × 24 h × 4 per hour (every 15 min)
// overrides: time windows where temperature is forced to a different base/variance
type TempOverride = { from: string; to: string; baseTemp: number; variance: number };

const buildReadings = (
  sensorId: string,
  baseTemp: number,
  variance: number,
  overrides: TempOverride[] = [],
): Reading[] => {
  const now = new Date('2025-05-22T03:00:00.000Z');
  return Array.from({ length: 672 }, (_, i) => {
    const ts = new Date(now.getTime() - (671 - i) * 15 * 60 * 1000);
    const tsMs = ts.getTime();
    const ov = overrides.find(
      o => tsMs >= new Date(o.from).getTime() && tsMs <= new Date(o.to).getTime(),
    );
    const b = ov ? ov.baseTemp : baseTemp;
    const v = ov ? ov.variance : variance;
    return {
      id: `reading_${sensorId}_${i + 1}`,
      sensorId,
      temperature: Math.round((b + (Math.random() * 2 - 1) * v) * 10) / 10,
      recordedAt: ts.toISOString(),
    };
  });
};

const coldStorageAReadings     = buildReadings('sensor_001',  4.2,  0.8);
const coldStorageBReadings     = buildReadings('sensor_002',  3.9,  0.6);
const medicineFridgeReadings   = buildReadings('sensor_003',  6.1,  0.4, [
  { from: '2025-05-21T09:00:00.000Z', to: '2025-05-21T10:00:00.000Z', baseTemp: 9.5, variance: 0.3 },
]);
const labFreezerReadings       = buildReadings('sensor_004', -18.5, 1.2, [
  { from: '2025-05-21T14:15:00.000Z', to: '2025-05-22T03:00:00.000Z', baseTemp: -12.5, variance: 0.8 },
]);
const vaccineFridge1Readings   = buildReadings('sensor_005',  4.5,  0.6);
const vaccineFridge2Readings   = buildReadings('sensor_006',  5.1,  0.7);
const dispensaryFridgeReadings = buildReadings('sensor_007',  4.8,  0.5);
const compoundingUnitReadings  = buildReadings('sensor_008',  3.8,  0.4);
const bloodBankReadings        = buildReadings('sensor_009',  3.2,  0.5);
const staffFridgeReadings      = buildReadings('sensor_010',  2.8,  1.2);
const biologicsReadings        = buildReadings('sensor_011',  5.5,  0.6);
const sampleCoolerReadings     = buildReadings('sensor_012',  6.2,  1.0);
const ivSolutionsReadings      = buildReadings('sensor_013',  4.1,  0.5);
const controlledMedsReadings   = buildReadings('sensor_014', 20.5,  1.5);

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
  {
    id: 'sensor_005',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Vaccine Fridge 1',
    status: 'online',
    lastReading: vaccineFridge1Readings[vaccineFridge1Readings.length - 1],
  },
  {
    id: 'sensor_006',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Vaccine Fridge 2',
    status: 'online',
    lastReading: vaccineFridge2Readings[vaccineFridge2Readings.length - 1],
  },
  {
    id: 'sensor_007',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Dispensary Fridge',
    status: 'online',
    lastReading: dispensaryFridgeReadings[dispensaryFridgeReadings.length - 1],
  },
  {
    id: 'sensor_008',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Compounding Unit',
    status: 'online',
    lastReading: compoundingUnitReadings[compoundingUnitReadings.length - 1],
  },
  {
    id: 'sensor_009',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Blood Bank',
    status: 'online',
    lastReading: bloodBankReadings[bloodBankReadings.length - 1],
  },
  {
    id: 'sensor_010',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Staff Refrigerator',
    status: 'online',
    lastReading: staffFridgeReadings[staffFridgeReadings.length - 1],
  },
  {
    id: 'sensor_011',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Biologics Storage',
    status: 'online',
    lastReading: biologicsReadings[biologicsReadings.length - 1],
  },
  {
    id: 'sensor_012',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Sample Cooler',
    status: 'online',
    lastReading: sampleCoolerReadings[sampleCoolerReadings.length - 1],
  },
  {
    id: 'sensor_013',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'IV Solutions Fridge',
    status: 'offline',
    lastReading: ivSolutionsReadings[ivSolutionsReadings.length - 1],
  },
  {
    id: 'sensor_014',
    gatewayId: 'gateway_001',
    customerId: 'customer_001',
    name: 'Controlled Meds Cabinet',
    status: 'online',
    lastReading: controlledMedsReadings[controlledMedsReadings.length - 1],
  },
];

export const mockReadings: Record<string, Reading[]> = {
  sensor_001: coldStorageAReadings,
  sensor_002: coldStorageBReadings,
  sensor_003: medicineFridgeReadings,
  sensor_004: labFreezerReadings,
  sensor_005: vaccineFridge1Readings,
  sensor_006: vaccineFridge2Readings,
  sensor_007: dispensaryFridgeReadings,
  sensor_008: compoundingUnitReadings,
  sensor_009: bloodBankReadings,
  sensor_010: staffFridgeReadings,
  sensor_011: biologicsReadings,
  sensor_012: sampleCoolerReadings,
  sensor_013: ivSolutionsReadings,
  sensor_014: controlledMedsReadings,
};

export const mockAlertConfigs: AlertConfig[] = [
  { id: 'alertconfig_001', sensorId: 'sensor_001', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'ops@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_002', sensorId: 'sensor_002', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_003', sensorId: 'sensor_003', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'pharmacist@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_004', sensorId: 'sensor_004', minTemp: -25, maxTemp: -15, emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_005', sensorId: 'sensor_005', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'pharmacist@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_006', sensorId: 'sensor_006', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'pharmacist@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_007', sensorId: 'sensor_007', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_008', sensorId: 'sensor_008', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'ops@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_009', sensorId: 'sensor_009', minTemp: 2,   maxTemp: 6,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'pharmacist@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_010', sensorId: 'sensor_010', minTemp: 0,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_011', sensorId: 'sensor_011', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'ops@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_012', sensorId: 'sensor_012', minTemp: 2,   maxTemp: 10,  emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_013', sensorId: 'sensor_013', minTemp: 2,   maxTemp: 8,   emailRecipients: ['ahmed@alnoor-pharmacy.qa'] },
  { id: 'alertconfig_014', sensorId: 'sensor_014', minTemp: 15,  maxTemp: 25,  emailRecipients: ['ahmed@alnoor-pharmacy.qa', 'ops@alnoor-pharmacy.qa'] },
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
