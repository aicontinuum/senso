import { ShellClient } from "@/components/layout/ShellClient";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellClient>{children}</ShellClient>;
}
