"use client";

import { useEffect, useMemo, useState } from "react";

type MiniAppResponse = {
  ok: boolean;
  error?: string;
  user?: { id: string; name?: string; first_name?: string; username?: string };
  access?: { source: string; role: string; permissions: string[]; editPermissions: string[] };
  generatedAt?: string;
  data?: DashboardData;
};

type DashboardData = {
  finance: {
    todaySales: number;
    todayTrend: number;
    monthlyProfit: number;
    profitTrend: number;
    cashTotal: number;
    cash: number;
    card: number;
    mixed: number;
    inventoryValue: number;
    weekSales: { label: string; value: number }[];
    categories: { name: string; revenue: number; percent: number }[];
    sixMonths: { label: string; savdo: number; xarajat: number }[];
  };
  sales: {
    todayTotal: number;
    todayCount: number;
    recent: {
      id: string;
      receiptNo: string;
      total: number;
      paymentMethod: string;
      createdAt: string;
      customer: string;
      employee: string;
      itemCount: number;
    }[];
  };
  inventory: {
    totalCount: number;
    inventoryValue: number;
    lowStockCount: number;
    expiringCount: number;
    lowStock: { id: string; name: string; stock: number; minStock: number; category: string }[];
    expiring: { id: string; name: string; expiryDate: string | null }[];
  };
  expenses: {
    total: number;
    categories: { category: string; amount: number }[];
    recent: { id: string; title: string; category: string; amount: number; spentAt: string; isRecurring: boolean }[];
  };
  customers: {
    total: number;
    viaTelegram: number;
    totalPoints: number;
    tiers: { bronze: number; silver: number; gold: number };
    top: { id: string; name: string; phone: string; tier: string; points: number; totalSpent: number }[];
    recent: { id: string; name: string; phone: string; createdAt: string }[];
  };
  employees: {
    total: number;
    active: number;
    onLeave: number;
    inactive: number;
    list: {
      id: string;
      fullName: string;
      position: string;
      branch: string;
      status: string;
      baseSalary: number;
      kpi: number | null;
    }[];
  };
  kpi: {
    month: number;
    year: number;
    avg: number;
    bonusFund: number;
    over90: number;
    under60: number;
    ranking: {
      id: string;
      employee: string;
      position: string;
      totalScore: number;
      bonusPercent: number;
      bonusAmount: number;
      scores: { sales: number; margin: number; attendance: number; discipline: number; customer: number };
    }[];
  };
  attendance: {
    records: {
      employeeId: string;
      name: string;
      status: string | null;
      checkIn: string | null;
      lateMinutes: number;
      penalty: number;
    }[];
    presentCount: number;
    totalEmployees: number;
    lateThisMonth: number;
    totalPenalty: number;
    perfect: number;
    avgCheckIn: string | null;
  };
  reports: {
    correlation: { employee: string; label: string; margin: number; marginMln: number; kpi: number }[];
    critical: { id: string; name: string; stock: number; minStock: number } | null;
  };
  options: {
    products: { id: string; name: string; stock: number; salePrice: number; category: string }[];
    employees: { id: string; name: string; position: string }[];
    customers: { id: string; name: string; phone: string; points: number }[];
  };
};

type ActionResponse = { ok: boolean; message?: string; error?: string };
type LoginResponse = {
  ok: boolean;
  token?: string;
  error?: string;
  user?: { name: string; role: string; permissions: string[]; editPermissions: string[] };
};
type AdminAction =
  | "createEmployee"
  | "createProduct"
  | "createExpense"
  | "createCustomer"
  | "createSale"
  | "markAttendance"
  | "saveKpi";

type TelegramWebApp = {
  initData: string;
  colorScheme?: "light" | "dark";
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const telegramWebAppScript = "https://telegram.org/js/telegram-web-app.js";
let telegramScriptPromise: Promise<void> | null = null;

function loadTelegramWebAppScript() {
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (telegramScriptPromise) return telegramScriptPromise;

  telegramScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${telegramWebAppScript}"]`);
    const script = existing ?? document.createElement("script");
    const timeout = window.setTimeout(() => {
      reject(new Error("Telegram WebApp script yuklanmadi"));
    }, 8000);

    script.addEventListener(
      "load",
      () => {
        window.clearTimeout(timeout);
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        window.clearTimeout(timeout);
        reject(new Error("Telegram WebApp script yuklanmadi"));
      },
      { once: true },
    );

    if (!existing) {
      script.src = telegramWebAppScript;
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return telegramScriptPromise;
}

const tabs = [
  ["overview", "Asosiy", "📊"],
  ["finance", "Moliya", "📈"],
  ["sales", "Savdo", "🛒"],
  ["inventory", "Ombor", "📦"],
  ["expenses", "Xarajat", "🧾"],
  ["customers", "Mijoz", "🪪"],
  ["employees", "Xodim", "👥"],
  ["kpi", "KPI", "🎯"],
  ["attendance", "Davomat", "🕐"],
  ["reports", "Hisobot", "📑"],
  ["settings", "Sozlamalar", "⚙️"],
] as const;
type TabKey = (typeof tabs)[number][0];

const tabPermission: Partial<Record<TabKey, string>> = {
  finance: "moliya",
  sales: "pos",
  inventory: "ombor",
  expenses: "harajatlar",
  customers: "mijozlar",
  employees: "xodimlar",
  kpi: "kpi",
  attendance: "davomat",
  reports: "hisobotlar",
  settings: "sozlamalar",
};

const pageMeta: Record<TabKey, { title: string; subtitle: string }> = {
  overview: { title: "Dorixona Admin", subtitle: "Umumiy holat va tezkor ko'rsatkichlar" },
  finance: { title: "Moliyaviy ko'rsatkichlar", subtitle: "Savdo, foyda va pul oqimi tahlili" },
  sales: { title: "Kassa va savdo", subtitle: "Yangi savdo, oxirgi cheklar va POS nazorati" },
  inventory: { title: "Ombor holati", subtitle: "Mahsulotlar, qoldiq va muddat nazorati" },
  expenses: { title: "Harajatlar boshqaruvi", subtitle: "Oylik xarajatlar va kategoriyalar" },
  customers: { title: "Mijozlar", subtitle: "Sodiqlik kartalari, ballar va darajalar" },
  employees: { title: "Xodimlar boshqaruvi", subtitle: "Xodimlar ro'yxati va ma'lumotlari" },
  kpi: { title: "KPI", subtitle: "Xodimlar reytingi va bonus hisoblari" },
  attendance: { title: "Davomat", subtitle: "Kelish vaqti, kechikish va penalti nazorati" },
  reports: { title: "Hisobotlar va tahlil", subtitle: "KPI va moliya integratsiyasi" },
  settings: { title: "Sozlamalar", subtitle: "Xodim loginlari va ruxsatlar holati" },
};

const paymentLabel: Record<string, string> = {
  CASH: "Naqd",
  CARD: "Terminal",
  MIXED: "Aralash",
};
const expenseLabel: Record<string, string> = {
  RENT: "Ijara",
  UTILITIES: "Kommunal",
  GOODS: "Tovar",
  SALARY: "Maosh",
  LICENSE: "Litsenziya",
  OTHER: "Boshqa",
};
const tierLabel: Record<string, string> = {
  BRONZE: "Bronza",
  SILVER: "Kumush",
  GOLD: "Oltin",
};
const employeeStatus: Record<string, string> = {
  ACTIVE: "Aktiv",
  ON_LEAVE: "Ta'tilda",
  INACTIVE: "Ishdan bo'shagan",
};
const attendanceStatus: Record<string, string> = {
  PRESENT: "Keldi",
  LATE: "Kechikdi",
  ABSENT: "Kelmadi",
  ON_LEAVE: "Ta'tilda",
};

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("ru-RU").replace(/,/g, " ");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} so'm`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function trend(value: number) {
  const up = value >= 0;
  return <span className={up ? "text-primary" : "text-danger"}>{up ? "+" : "-"}{Math.abs(value).toFixed(1)}%</span>;
}

async function fetchDashboard(authHeader: string) {
  const res = await fetch("/api/telegram/admin/dashboard", {
    headers: { Authorization: authHeader },
  });
  const body = (await res.json()) as MiniAppResponse;
  if (!res.ok || !body.ok) throw new Error(body.error || "Ma'lumot yuklanmadi");
  return body;
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-edge bg-card p-3 shadow-sm">
      {title ? <h2 className="mb-2 text-sm font-semibold text-fg">{title}</h2> : null}
      {children}
    </section>
  );
}

function ActionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-primary/30 bg-card p-3 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function ReadOnlyCard() {
  return (
    <Card title="Faqat ko'rish">
      <p className="text-sm text-muted">Bu bo'lim bo'yicha o'zgartirish ruxsati berilmagan.</p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

const controlClass = "w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-fg outline-none focus:border-primary";

function Metric({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-edge bg-card p-3">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold leading-tight text-fg">{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

function Row({ left, right, sub }: { left: React.ReactNode; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="border-b border-edge py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div className="font-medium text-fg">{left}</div>
        {right ? <div className="shrink-0 text-right text-sm font-semibold text-fg">{right}</div> : null}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((item) => item.value), 0.01);
  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.label} className="grid grid-cols-[44px_1fr_52px] items-center gap-2 text-xs">
          <span className="text-muted">{item.label}</span>
          <div className="h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }} />
          </div>
          <span className="text-right text-muted">{item.value.toFixed(2)}M</span>
        </div>
      ))}
    </div>
  );
}

export function TelegramAdminClient() {
  const [payload, setPayload] = useState<MiniAppResponse | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<AdminAction | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [authHeader, setAuthHeader] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        await loadTelegramWebAppScript();
        if (cancelled) return;

        const webApp = window.Telegram?.WebApp;
        webApp?.ready();
        webApp?.expand();
        const initData = webApp?.initData ?? "";
        const savedToken = window.localStorage.getItem("dorixonaMiniToken");

        if (initData) {
          try {
            const header = `tma ${initData}`;
            const body = await fetchDashboard(header);
            if (!cancelled) {
              setAuthHeader(header);
              setPayload(body);
            }
            return;
          } catch {
            // Admin ID bo'lmasa, xodim loginiga o'tamiz.
          }
        }

        if (savedToken) {
          try {
            const header = `mini ${savedToken}`;
            const body = await fetchDashboard(header);
            if (!cancelled) {
              setAuthHeader(header);
              setPayload(body);
            }
            return;
          } catch {
            window.localStorage.removeItem("dorixonaMiniToken");
          }
        }

        if (!cancelled) setNeedsLogin(true);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  async function login(form: HTMLFormElement) {
    const fd = new FormData(form);
    setSaving(null);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/telegram/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(fd.get("email") ?? ""),
          password: String(fd.get("password") ?? ""),
        }),
      });
      const body = (await res.json()) as LoginResponse;
      if (!res.ok || !body.ok || !body.token) throw new Error(body.error || "Login xato");
      window.localStorage.setItem("dorixonaMiniToken", body.token);
      const header = `mini ${body.token}`;
      setAuthHeader(header);
      setPayload(await fetchDashboard(header));
      setNeedsLogin(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login xato");
    }
  }

  async function submitAction(action: AdminAction, payload: Record<string, unknown>, form?: HTMLFormElement) {
    if (!authHeader) {
      setNotice("Avval login qiling yoki /panel orqali qayta oching.");
      return;
    }

    setSaving(action);
    setNotice("");
    try {
      const res = await fetch("/api/telegram/admin/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ action, payload }),
      });
      const body = (await res.json()) as ActionResponse;
      if (!res.ok || !body.ok) throw new Error(body.error || "Saqlanmadi");
      setNotice(body.message ?? "Saqlandi");
      form?.reset();
      setPayload(await fetchDashboard(authHeader));
    } catch (e: unknown) {
      setNotice(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setSaving(null);
    }
  }

  const data = payload?.data;
  const generatedAt = useMemo(() => {
    return payload?.generatedAt ? new Date(payload.generatedAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }) : "";
  }, [payload?.generatedAt]);

  if (loading) {
    return (
      <main className="min-h-screen bg-surface p-4 text-fg">
        <div className="mx-auto max-w-md rounded-lg border border-edge bg-card p-4 text-sm text-muted">Admin panel yuklanmoqda...</div>
      </main>
    );
  }

  if (needsLogin) {
    return (
      <main className="min-h-screen bg-surface p-4 text-fg">
        <form
          className="mx-auto mt-8 max-w-md space-y-3 rounded-lg border border-edge bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void login(event.currentTarget);
          }}
        >
          <div>
            <h1 className="text-base font-semibold text-fg">Xodim login</h1>
            <p className="mt-1 text-sm text-muted">Email va parol bilan Mini Appga kiring.</p>
          </div>
          {error ? <div className="rounded-lg border border-danger bg-danger-light px-3 py-2 text-sm text-danger">{error}</div> : null}
          <Field label="Email">
            <input name="email" type="email" required className={controlClass} placeholder="xodim@dorixona.uz" />
          </Field>
          <Field label="Parol">
            <input name="password" type="password" required className={controlClass} placeholder="••••••••" />
          </Field>
          <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white">
            Kirish
          </button>
        </form>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-surface p-4 text-fg">
        <div className="mx-auto max-w-md rounded-lg border border-danger bg-danger-light p-4">
          <h1 className="text-base font-semibold text-danger">Kirish mumkin emas</h1>
          <p className="mt-2 text-sm text-fg">{error || "Ma'lumot topilmadi"}</p>
        </div>
      </main>
    );
  }

  const topReport = data.reports.correlation[0];
  const access = payload.access;
  const canViewSection = (permission?: string) => {
    return !permission || access?.role === "OWNER" || Boolean(access?.permissions.includes(permission));
  };
  const canEditSection = (permission: string) => {
    return access?.role === "OWNER" || Boolean(access?.editPermissions.includes(permission));
  };
  const canSeeSales = canViewSection("pos") || canViewSection("moliya");
  const canSeeInventory = canViewSection("ombor") || canViewSection("moliya");
  const canSeeEmployees = canViewSection("xodimlar") || canViewSection("kpi");
  const canSeeReports = canViewSection("hisobotlar");
  const availableTabs = tabs.filter(([key]) => canViewSection(tabPermission[key]));
  const activeTab = availableTabs.some(([key]) => key === tab) ? tab : "overview";
  const activeMeta = pageMeta[activeTab];
  const tips = [
    topReport ? `${topReport.employee.split(" ")[0]} bu oyda eng ko'p foyda keltirdi` : "Savdo ma'lumotlari to'planmoqda",
    data.reports.critical ? `${data.reports.critical.name} ombori kritik darajada` : "Ombor qoldiqlari normal",
    `Bugungi savdo: ${formatMoney(data.sales.todayTotal)}`,
  ];

  return (
    <main className="min-h-screen bg-surface text-fg">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl overflow-hidden bg-surface">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-edge bg-card py-4 md:flex">
          <div className="flex items-center gap-2 px-5 pb-5 text-base font-semibold text-primary">
            <span className="text-xl">💊</span> Dorixona
          </div>
          <nav className="space-y-0.5">
            {availableTabs.map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex w-full items-center gap-3 border-l-2 px-5 py-2.5 text-left text-sm transition ${
                  activeTab === key
                    ? "border-primary bg-primary-light font-medium text-primary"
                    : "border-transparent text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                <span className="w-5 text-base">{icon}</span>
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-edge bg-card/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-base font-semibold md:text-lg">{activeMeta.title}</h1>
                <p className="truncate text-xs text-muted">
                  {activeMeta.subtitle} · {payload.user?.name ?? payload.user?.first_name ?? payload.user?.username ?? "Admin"} · {generatedAt}
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-primary-light px-3 py-1 text-xs font-medium text-primary">Mini App</div>
            </div>
          </header>

          <nav className="flex gap-2 overflow-x-auto border-b border-edge bg-card px-3 py-2 md:hidden">
            {availableTabs.map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === key ? "bg-primary text-white" : "border border-edge bg-card text-muted"
                }`}
              >
                <span className="mr-1">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto p-3 md:p-5">
            <div className="mx-auto max-w-6xl space-y-4">
              <div className="rounded-lg border border-edge bg-card p-3 text-xs text-muted">
                Adminlar Telegram ID orqali aniqlanadi. Xodimlar Mini App ichida email/parol bilan kiradi. Oddiy mijozlar /start, /balans, /tarix orqali alohida ishlaydi.
              </div>

              {notice ? (
                <div className="rounded-lg border border-primary bg-primary-light px-3 py-2 text-sm text-fg">
                  {notice}
                </div>
              ) : null}

              {canSeeSales || canViewSection("moliya") || canSeeInventory ? (
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  {canSeeSales ? (
                    <Metric label="Bugungi savdo" value={formatMoney(data.sales.todayTotal)} sub={`${data.sales.todayCount} ta chek`} />
                  ) : null}
                  {canViewSection("moliya") ? (
                    <Metric label="Oylik foyda" value={formatMoney(data.finance.monthlyProfit)} sub={trend(data.finance.profitTrend)} />
                  ) : null}
                  {canViewSection("moliya") ? (
                    <Metric label="Oylik tushum" value={formatMoney(data.finance.cashTotal)} sub={`Naqd ${formatNumber(data.finance.cash)}`} />
                  ) : null}
                  {canSeeInventory ? (
                    <Metric
                      label="Ombor qiymati"
                      value={formatMoney(data.inventory.inventoryValue || data.finance.inventoryValue)}
                      sub={`${data.inventory.lowStockCount} kam qoldiq`}
                    />
                  ) : null}
                </div>
              ) : (
                <Card title="Ruxsatlar">
                  <p className="text-sm text-muted">Sizga biriktirilgan bo'limlar menyuda ko'rinadi.</p>
                </Card>
              )}

        {activeTab === "overview" && (
          <div className="space-y-3">
            <Card title="Umumiy Holat">
              {canSeeSales ? <Row left="Cheklar bugun" right={`${data.sales.todayCount} ta`} sub={formatMoney(data.sales.todayTotal)} /> : null}
              {canViewSection("mijozlar") ? (
                <Row left="Mijozlar" right={`${data.customers.total} ta`} sub={`Telegram: ${data.customers.viaTelegram} · Ball: ${formatNumber(data.customers.totalPoints)}`} />
              ) : null}
              {canSeeEmployees ? <Row left="Xodimlar" right={`${data.employees.active}/${data.employees.total}`} sub={`KPI o'rtacha: ${data.kpi.avg}%`} /> : null}
              {canViewSection("davomat") ? (
                <Row left="Davomat" right={`${data.attendance.presentCount}/${data.attendance.totalEmployees}`} sub={`Kechikishlar oyda: ${data.attendance.lateThisMonth}`} />
              ) : null}
            </Card>
            {canSeeReports || canSeeSales ? (
              <Card title="AI Tavsiyalar">
                {tips.map((tip) => <Row key={tip} left={tip} />)}
              </Card>
            ) : null}
          </div>
        )}

        {activeTab === "finance" && (
          <div className="space-y-3">
            <Card title="7 Kunlik Savdo"><Bars data={data.finance.weekSales} /></Card>
            <Card title="Toifalar Ulushi">
              {data.finance.categories.map((category) => (
                <Row key={category.name} left={category.name} right={`${category.percent}%`} sub={formatMoney(category.revenue)} />
              ))}
            </Card>
            <Card title="6 Oylik Tahlil">
              {data.finance.sixMonths.map((month) => (
                <Row key={month.label} left={month.label} right={`${month.savdo}M`} sub={`Xarajat: ${month.xarajat}M`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "sales" && (
          <div className="space-y-3">
            {canEditSection("pos") ? (
            <ActionCard title="Yangi Savdo">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "createSale",
                    {
                      productId: String(fd.get("productId") ?? ""),
                      quantity: Number(fd.get("quantity") ?? 1),
                      customerId: String(fd.get("customerId") ?? "") || undefined,
                      employeeId: String(fd.get("employeeId") ?? "") || undefined,
                      paymentMethod: String(fd.get("paymentMethod") ?? "CASH"),
                    },
                    form,
                  );
                }}
              >
                <Field label="Mahsulot">
                  <select name="productId" required className={controlClass}>
                    <option value="">Tanlang</option>
                    {data.options.products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} · {product.stock} dona · {formatMoney(product.salePrice)}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Soni">
                    <input name="quantity" type="number" min="1" defaultValue="1" required className={controlClass} />
                  </Field>
                  <Field label="To'lov">
                    <select name="paymentMethod" defaultValue="CASH" className={controlClass}>
                      <option value="CASH">Naqd</option>
                      <option value="CARD">Terminal</option>
                      <option value="MIXED">Aralash</option>
                    </select>
                  </Field>
                </div>
                <Field label="Mijoz">
                  <select name="customerId" className={controlClass}>
                    <option value="">Mijozsiz</option>
                    {data.options.customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.phone}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Xodim">
                  <select name="employeeId" className={controlClass}>
                    <option value="">Belgilanmagan</option>
                    {data.options.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} · {employee.position}
                      </option>
                    ))}
                  </select>
                </Field>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "createSale"}>
                  {saving === "createSale" ? "Saqlanmoqda..." : "Savdo qo'shish"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Oxirgi Cheklar">
              {data.sales.recent.map((sale) => (
                <Row
                  key={sale.id}
                  left={sale.receiptNo}
                  right={formatMoney(sale.total)}
                  sub={`${formatDate(sale.createdAt)} ${formatTime(sale.createdAt)} · ${paymentLabel[sale.paymentMethod] ?? sale.paymentMethod} · ${sale.customer} · ${sale.itemCount} pozitsiya`}
                />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="space-y-3">
            {canEditSection("ombor") ? (
            <ActionCard title="Yangi Mahsulot">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "createProduct",
                    {
                      name: String(fd.get("name") ?? ""),
                      category: String(fd.get("category") ?? ""),
                      sku: String(fd.get("sku") ?? "") || undefined,
                      costPrice: Number(fd.get("costPrice") ?? 0),
                      salePrice: Number(fd.get("salePrice") ?? 0),
                      stock: Number(fd.get("stock") ?? 0),
                      minStock: Number(fd.get("minStock") ?? 0),
                      expiryDate: String(fd.get("expiryDate") ?? "") || undefined,
                    },
                    form,
                  );
                }}
              >
                <Field label="Nomi">
                  <input name="name" required placeholder="Paracetamol 500mg" className={controlClass} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kategoriya">
                    <input name="category" required placeholder="Vitaminlar" className={controlClass} />
                  </Field>
                  <Field label="SKU">
                    <input name="sku" placeholder="PR-001" className={controlClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Tan narxi">
                    <input name="costPrice" type="number" min="0" required className={controlClass} />
                  </Field>
                  <Field label="Sotuv narxi">
                    <input name="salePrice" type="number" min="1" required className={controlClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Qoldiq">
                    <input name="stock" type="number" min="0" defaultValue="0" required className={controlClass} />
                  </Field>
                  <Field label="Minimum">
                    <input name="minStock" type="number" min="0" defaultValue="0" required className={controlClass} />
                  </Field>
                  <Field label="Muddat">
                    <input name="expiryDate" type="date" className={controlClass} />
                  </Field>
                </div>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "createProduct"}>
                  {saving === "createProduct" ? "Saqlanmoqda..." : "Mahsulot qo'shish"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Kam Qoldiq">
              {data.inventory.lowStock.length ? data.inventory.lowStock.map((product) => (
                <Row key={product.id} left={product.name} right={`${product.stock} dona`} sub={`Minimum: ${product.minStock} · ${product.category}`} />
              )) : <p className="text-sm text-muted">Kam qoldiq yo'q.</p>}
            </Card>
            <Card title="Muddati Yaqin">
              {data.inventory.expiring.length ? data.inventory.expiring.map((product) => (
                <Row key={product.id} left={product.name} right={formatDate(product.expiryDate)} />
              )) : <p className="text-sm text-muted">30 kun ichida muddati yaqin dori yo'q.</p>}
            </Card>
          </div>
        )}

        {activeTab === "expenses" && (
          <div className="space-y-3">
            {canEditSection("harajatlar") ? (
            <ActionCard title="Yangi Xarajat">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "createExpense",
                    {
                      title: String(fd.get("title") ?? ""),
                      category: String(fd.get("category") ?? "OTHER"),
                      amount: Number(fd.get("amount") ?? 0),
                      spentAt: String(fd.get("spentAt") ?? "") || undefined,
                      isRecurring: fd.get("isRecurring") === "on",
                    },
                    form,
                  );
                }}
              >
                <Field label="Nomi">
                  <input name="title" required placeholder="Ijara, yetkazib berish..." className={controlClass} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kategoriya">
                    <select name="category" defaultValue="OTHER" className={controlClass}>
                      <option value="RENT">Ijara</option>
                      <option value="UTILITIES">Kommunal</option>
                      <option value="GOODS">Tovar</option>
                      <option value="SALARY">Maosh</option>
                      <option value="LICENSE">Litsenziya</option>
                      <option value="OTHER">Boshqa</option>
                    </select>
                  </Field>
                  <Field label="Summa">
                    <input name="amount" type="number" min="1" required className={controlClass} />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                  <Field label="Sana">
                    <input name="spentAt" type="date" className={controlClass} />
                  </Field>
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-edge bg-surface px-3 text-xs text-muted">
                    <input name="isRecurring" type="checkbox" /> Doimiy
                  </label>
                </div>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "createExpense"}>
                  {saving === "createExpense" ? "Saqlanmoqda..." : "Xarajat qo'shish"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Kategoriya Bo'yicha">
              {data.expenses.categories.map((row) => (
                <Row key={row.category} left={expenseLabel[row.category] ?? row.category} right={formatMoney(row.amount)} />
              ))}
            </Card>
            <Card title="Oxirgi Xarajatlar">
              {data.expenses.recent.map((expense) => (
                <Row key={expense.id} left={expense.title} right={formatMoney(expense.amount)} sub={`${formatDate(expense.spentAt)} · ${expenseLabel[expense.category] ?? expense.category}${expense.isRecurring ? " · doimiy" : ""}`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "customers" && (
          <div className="space-y-3">
            {canEditSection("mijozlar") ? (
            <ActionCard title="Yangi Mijoz">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "createCustomer",
                    {
                      fullName: String(fd.get("fullName") ?? ""),
                      phone: String(fd.get("phone") ?? ""),
                      birthday: String(fd.get("birthday") ?? "") || undefined,
                    },
                    form,
                  );
                }}
              >
                <Field label="Ism familiya">
                  <input name="fullName" required placeholder="Gulshoda Aliyeva" className={controlClass} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Telefon">
                    <input name="phone" required placeholder="+998..." className={controlClass} />
                  </Field>
                  <Field label="Tug'ilgan sana">
                    <input name="birthday" type="date" className={controlClass} />
                  </Field>
                </div>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "createCustomer"}>
                  {saving === "createCustomer" ? "Saqlanmoqda..." : "Mijoz qo'shish"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Darajalar">
              <Row left="Bronza" right={`${data.customers.tiers.bronze} ta`} />
              <Row left="Kumush" right={`${data.customers.tiers.silver} ta`} />
              <Row left="Oltin" right={`${data.customers.tiers.gold} ta`} />
            </Card>
            <Card title="Top Mijozlar">
              {data.customers.top.map((customer) => (
                <Row key={customer.id} left={customer.name} right={formatMoney(customer.totalSpent)} sub={`${tierLabel[customer.tier]} · ${customer.points} ball · ${customer.phone}`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "employees" && (
          <div className="space-y-3">
            {canEditSection("xodimlar") ? (
            <ActionCard title="Yangi Xodim">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "createEmployee",
                    {
                      fullName: String(fd.get("fullName") ?? ""),
                      position: String(fd.get("position") ?? ""),
                      phone: String(fd.get("phone") ?? "") || undefined,
                      baseSalary: Number(fd.get("baseSalary") ?? 0),
                    },
                    form,
                  );
                }}
              >
                <Field label="Ism familiya">
                  <input name="fullName" required placeholder="Dilshod Karimov" className={controlClass} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Lavozim">
                    <input name="position" required placeholder="farmasevt" className={controlClass} />
                  </Field>
                  <Field label="Telefon">
                    <input name="phone" placeholder="+998..." className={controlClass} />
                  </Field>
                </div>
                <Field label="Maosh">
                  <input name="baseSalary" type="number" min="0" required className={controlClass} />
                </Field>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "createEmployee"}>
                  {saving === "createEmployee" ? "Saqlanmoqda..." : "Xodim qo'shish"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Xodimlar">
              {data.employees.list.map((employee) => (
                <Row key={employee.id} left={employee.fullName} right={employee.kpi === null ? "-" : `${employee.kpi}`} sub={`${employee.position} · ${employeeStatus[employee.status]} · ${formatMoney(employee.baseSalary)}`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "kpi" && (
          <div className="space-y-3">
            {canEditSection("kpi") ? (
            <ActionCard title="KPI Kiritish">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "saveKpi",
                    {
                      employeeId: String(fd.get("employeeId") ?? ""),
                      salesScore: Number(fd.get("salesScore") ?? 0),
                      marginScore: Number(fd.get("marginScore") ?? 0),
                      attendanceScore: Number(fd.get("attendanceScore") ?? 0),
                      disciplineScore: Number(fd.get("disciplineScore") ?? 0),
                      customerScore: Number(fd.get("customerScore") ?? 0),
                    },
                    form,
                  );
                }}
              >
                <Field label="Xodim">
                  <select name="employeeId" required className={controlClass}>
                    <option value="">Tanlang</option>
                    {data.options.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-5 gap-1">
                  {["salesScore", "marginScore", "attendanceScore", "disciplineScore", "customerScore"].map((name) => (
                    <input key={name} name={name} type="number" min="0" max="100" defaultValue="80" required className={controlClass} />
                  ))}
                </div>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "saveKpi"}>
                  {saving === "saveKpi" ? "Saqlanmoqda..." : "KPI saqlash"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="KPI Xulosa">
              <Row left="O'rtacha KPI" right={`${data.kpi.avg}%`} />
              <Row left="Bonus fondi" right={formatMoney(data.kpi.bonusFund)} />
              <Row left="90%+ xodimlar" right={`${data.kpi.over90}/${data.kpi.ranking.length}`} />
            </Card>
            <Card title="Reyting">
              {data.kpi.ranking.map((row, index) => (
                <Row key={row.id} left={`${index + 1}. ${row.employee}`} right={`${row.totalScore}`} sub={`+${row.bonusPercent}% · ${formatMoney(row.bonusAmount)} · S:${row.scores.sales} M:${row.scores.margin} D:${row.scores.attendance}`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="space-y-3">
            {canEditSection("davomat") ? (
            <ActionCard title="Davomat Belgilash">
              <form
                className="space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const fd = new FormData(form);
                  void submitAction(
                    "markAttendance",
                    {
                      employeeId: String(fd.get("employeeId") ?? ""),
                      status: String(fd.get("status") ?? "PRESENT"),
                      checkInTime: String(fd.get("checkInTime") ?? "") || undefined,
                    },
                    form,
                  );
                }}
              >
                <Field label="Xodim">
                  <select name="employeeId" required className={controlClass}>
                    <option value="">Tanlang</option>
                    {data.options.employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Holat">
                    <select name="status" defaultValue="PRESENT" className={controlClass}>
                      <option value="PRESENT">Keldi</option>
                      <option value="ABSENT">Kelmadi</option>
                      <option value="ON_LEAVE">Ta'tilda</option>
                    </select>
                  </Field>
                  <Field label="Kelish vaqti">
                    <input name="checkInTime" type="time" className={controlClass} />
                  </Field>
                </div>
                <button className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving === "markAttendance"}>
                  {saving === "markAttendance" ? "Saqlanmoqda..." : "Davomat saqlash"}
                </button>
              </form>
            </ActionCard>
            ) : (
              <ReadOnlyCard />
            )}
            <Card title="Bugungi Davomat">
              {data.attendance.records.map((record) => (
                <Row key={record.employeeId} left={record.name} right={record.status ? attendanceStatus[record.status] : "Belgilanmagan"} sub={`Kelish: ${formatTime(record.checkIn)} · ${record.lateMinutes} daq · penalti ${record.penalty}`} />
              ))}
            </Card>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-3">
            <Card title="Xodim va Foyda">
              {data.reports.correlation.length ? data.reports.correlation.map((row) => (
                <Row key={row.employee} left={row.label} right={`${row.marginMln}M`} sub={`KPI: ${row.kpi} · foyda ${formatMoney(row.margin)}`} />
              )) : <p className="text-sm text-muted">Savdo ma'lumotlari to'planmoqda.</p>}
            </Card>
            <Card title="Tavsiyalar">
              <Row left={topReport ? `${topReport.employee.split(" ")[0]} bu oyda eng ko'p foyda keltirdi` : "Savdo ma'lumotlari to'planmoqda"} />
              <Row left={data.reports.critical ? `${data.reports.critical.name} ombori kritik darajada` : "Ombor qoldiqlari normal"} />
              <Row left="KPI va moliya birlashgan tahlil yangi insight beradi" />
            </Card>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="grid gap-3 lg:grid-cols-2">
            <Card title="Kirish turi">
              <Row left="Sizning kirish usulingiz" right={access?.source === "telegram-admin" ? "Telegram admin" : "Xodim login"} />
              <Row left="Rol" right={access?.role ?? "-"} />
              <Row
                left="Oddiy mijozlar"
                sub="/start orqali telefon raqamini ulaydi, /balans va /tarixdan foydalanadi. Admin/xodim ma'lumotlarini ko'rmaydi."
              />
              <Row
                left="Xodimlar"
                sub="Mini App ichida email/parol bilan kiradi. Shundan keyin faqat ruxsat berilgan bo'limlarni ko'radi va o'zgartiradi."
              />
            </Card>
            <Card title="Ruxsatlaringiz">
              <Row left="Ko'rish mumkin" sub={access?.permissions.length ? access.permissions.join(", ") : "Ruxsat yo'q"} />
              <Row left="O'zgartirish mumkin" sub={access?.editPermissions.length ? access.editPermissions.join(", ") : "Faqat ko'rish"} />
              <a
                href="/sozlamalar"
                className="mt-3 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Web sozlamalarni ochish
              </a>
            </Card>
          </div>
        )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
