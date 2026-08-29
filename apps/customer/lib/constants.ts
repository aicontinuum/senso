export const APP_NAME = "Senso";

export const TEMP_UNIT = "°C";

// Every temperature renders to a fixed 2 decimal places — including whole
// numbers, which show as "3.00". Readings sit in columns and update in place, so
// a varying decimal count makes them jump and misalign; a compliance record also
// reads as more precise when the precision is stated consistently.
export const TEMP_DECIMALS = 1;

export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Alerts", href: "/alerts" },
  { label: "Reports", href: "/reports" },
  { label: "Settings", href: "/settings" },
] as const;
