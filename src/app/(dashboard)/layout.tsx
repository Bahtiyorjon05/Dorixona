import { auth } from "@/auth";
import { Sidebar } from "@/components/Sidebar";
import { logout } from "@/lib/actions/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const name = session?.user?.name ?? "Foydalanuvchi";
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-3 border-b border-edge bg-card px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">
              {initials}
            </div>
            <span className="text-sm font-medium">{name}</span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface"
            >
              Chiqish
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-auto bg-surface p-6">{children}</main>
      </div>
    </div>
  );
}
