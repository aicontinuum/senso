// Components shared by both apps.
//
// These were duplicated file-for-file and had already drifted: the two apps'
// globals.css differed by 224 lines and their sidebars by 91 before this.
// Anything identical in both belongs here; anything genuinely app-specific —
// nav items, the header's right-hand slot, sign-out — is passed in as a prop.
export { cn } from "./cn";
export { Spinner } from "./spinner";
export { Skeleton } from "./skeleton";
export { Logo } from "./logo";
export { Sidebar } from "./sidebar";
export { Header } from "./header";
export { AppShell } from "./app-shell";
export type { NavItem } from "./nav";
