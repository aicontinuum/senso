import type { ComponentType } from "react";

/** A sidebar destination. The icon is supplied by the app so this package does
 *  not need to depend on an icon library. */
export interface NavItem {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
}
