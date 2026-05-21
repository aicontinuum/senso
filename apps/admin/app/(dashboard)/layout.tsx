export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <aside className="flex h-full w-56 flex-col border-r">
        <div className="flex h-14 items-center border-b px-6">
          <span className="text-lg font-bold">Senso Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 text-sm text-muted-foreground">
          {/* Sidebar nav — coming soon */}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b px-6" />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
