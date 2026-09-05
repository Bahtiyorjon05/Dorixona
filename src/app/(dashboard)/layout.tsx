import { auth } from "@/auth";
import { MobileNav, Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FilialSwitcher } from "@/components/FilialSwitcher";
import { logout } from "@/lib/actions/auth";
import { currentFilial } from "@/lib/filial-server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, filial] = await Promise.all([auth(), currentFilial()]);
  const name = session?.user?.name ?? "Foydalanuvchi";
  const role = session?.user?.role;
  const permissions = session?.user?.permissions ?? [];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-edge bg-card px-4 py-3 sm:px-6">
          <MobileNav role={role} permissions={permissions} />
          <div className="flex items-center gap-1 font-semibold text-primary md:hidden">
            <span>💊</span> Dorixona
          </div>
          <div className="ml-auto flex items-center gap-3">
            <FilialSwitcher current={filial} />
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-light text-xs font-medium text-primary">
                {initials}
              </div>
              <span className="hidden text-sm font-medium sm:inline">{name}</span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-edge px-3 py-1.5 text-xs text-muted transition hover:bg-surface"
              >
                Chiqish
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-surface p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
