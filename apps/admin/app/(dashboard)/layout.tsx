import { ShellClient } from "@/components/layout/ShellClient";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShellClient>{children}</ShellClient>;
}
