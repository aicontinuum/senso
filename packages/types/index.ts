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
