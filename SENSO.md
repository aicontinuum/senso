# Senso — Project Bible

## What is Senso?

Senso is an IoT-based temperature monitoring SaaS platform targeting the Qatar market. It replaces manual pen-and-paper temperature logging for regulated industries like restaurants, pharmacies, flower shops, and laboratories.

Hardware logs temperatures automatically → cloud stores and processes readings → customers view live data, receive alerts, and generate printable Monitoring Reports via a web dashboard.

---

## Business Model

- **Pricing currency:** QAR (Qatari Riyal)
- **Billing:** Manual invoicing only — no payment gateway integrated. Admin portal tracks billing status only.
- **Billing statuses:** Active / Overdue / Suspended
- **Onboarding:** White-glove only. A Senso technician physically visits the customer site, installs the gateway and sensors, logs into senso.com using the customer's credentials (no separate technician role), links the gateway, names sensors, sets alert thresholds and email recipients, then hands credentials to the customer.
- **Notification channel:** Email only (no SMS, no push notifications)

---

## Hardware Stack

```
ESP32 + DS18B20 temperature sensor (LoRa)
        ↓
Raspberry Pi Zero 2W (gateway — one per customer site)
        ↓
Cloud (backend API)
        ↓
senso.com (customer dashboard)
```

- **Sensor type:** Temperature only for now
- **Architecture:** Designed to be sensor-agnostic for future expansion (humidity, door sensors, etc.) — but do NOT build for this yet. Keep it temperature-only.
- **One gateway per customer location**

---

## Two Sites

### 1. senso.com — Customer-Facing

Read-mostly. Customers view their data, configure alerts, and generate reports.

**Pages:**

| Page | Purpose |
|------|---------|
| Dashboard | Live temperature readings across all sensors, with status indicators |
| Alerts | Configure temperature thresholds and email recipients per sensor |
| Reports | Generate and print Monitoring Reports (date range selector, sensor selector) |
| Settings | Sensor names, gateway status, account info |

**Key rules:**
- Customers do NOT add or delete sensors — that's done by the technician during onboarding
- Customers CAN rename sensors, set alert thresholds, and manage email recipients
- All data shown reflects the customer's own sensors only (scoped per account)

---

### 2. senso.admin.com — Internal Operations (Admin)

Write-heavy. Senso staff manage customers, devices, and billing.

**Pages:**

| Page | Purpose |
|------|---------|
| Dashboard | Overview of all customers, device health, alerts firing |
| Customers | List of all customer accounts; create/edit/suspend |
| Devices | All gateways and sensors across all customers; assign to customers |
| Billing | Track invoice status per customer (Active / Overdue / Suspended) |
| Settings | Internal platform settings |

**Key rules:**
- Admin creates a customer account → customer can then log in to senso.com
- Admin assigns a gateway and sensors to a customer
- Changes made on the admin side reflect immediately on the customer side
- Admin does NOT interact with senso.com directly

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Package manager | npm |

**Rules:**
- Use shadcn/ui components wherever possible before building custom ones
- App Router only — no Pages Router patterns
- Keep components in `/components`, pages in `/app`
- Do not add new dependencies without asking first

---

## Data Model (Simplified)

```
Customer
  └── Gateway (one per site)
        └── Sensor[] (one or more per gateway)
              └── Reading[] (timestamped temperature values)

AlertConfig (per Sensor)
  ├── min_temp
  ├── max_temp
  └── email_recipients[]
```

---

## Design Language

- Clean, professional, utilitarian — not flashy
- Primary audience: restaurant managers, pharmacy staff, operations teams
- Must feel trustworthy and easy to scan at a glance
- Sensor status (online/offline) and temperature out-of-range should be visually obvious
- Reports must be print-friendly

---

## Current State

- Product architecture and page structures are finalized
- Tech stack is locked in
- No backend exists yet — all pages should use **hardcoded mock data** until the API is ready
- Building UI first, wire up to real data later

---

## Out of Scope (Do Not Build Yet)

- Payment processing or billing automation
- SMS or push notifications
- Multi-location support per customer account
- Mobile app
- Additional sensor types beyond temperature
- Customer self-signup (onboarding is always manual)
- Separate technician role/login

---

## Vocabulary

Use these terms consistently:

| Term | Meaning |
|------|---------|
| **Sensor** | The physical temperature probe (ESP32 + DS18B20) |
| **Gateway** | The Raspberry Pi hub at the customer site |
| **Reading** | A single timestamped temperature data point |
| **Monitoring Report** | The printable compliance-style log report |
| **Alert** | A notification triggered when temp goes out of range |
| **Threshold** | The min/max temperature values that trigger an alert |
