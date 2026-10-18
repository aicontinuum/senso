export type BillingStatus = 'active' | 'overdue' | 'suspended';

export type DeviceStatus = 'online' | 'offline';

export type AlertType = 'min' | 'max';

export interface Customer {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  billingStatus: BillingStatus;
  createdAt: string;
}

export interface Gateway {
  id: string;
  customerId: string;
  name: string;
  status: DeviceStatus;
  lastSeen: string;
  firmwareVersion: string;
}

export interface Reading {
  id: string;
  sensorId: string;
  temperature: number;
  recordedAt: string;
}

export interface Sensor {
  id: string;
  gatewayId: string;
  customerId: string;
  name: string;
  status: DeviceStatus;
  lastReading?: Reading;
  batteryLevel?: number; // 0–100
  /**
   * When the sensor was installed at the site and entered the customer's
   * compliance record. Null means not in service: readings are stored, but they
   * raise no alerts and never appear in a report. See
   * `supabase/migrations/20260902_sensor_commissioning.sql`.
   */
  commissionedAt?: string | null;
  /**
   * The device's permanent DevEUI (`sensors.hardware_id`). Its last four
   * characters are the sensor ID shown to the office and the customer; see
   * `networkName` in `@senso/status`. Undefined when the caller did not load
   * the column; null when the row has none.
   */
  hardwareId?: string | null;
}

export interface AlertConfig {
  id: string;
  sensorId: string;
  minTemp: number;
  maxTemp: number;
  emailRecipients: string[];
}

export interface Alert {
  id: string;
  sensorId: string;
  type: AlertType;
  temperature: number;
  triggeredAt: string;
  resolvedAt?: string;
}
