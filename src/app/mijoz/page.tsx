import { MijozClient } from "./MijozClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Evomed apteka — mening kartam" };

/** Mijozlar uchun Telegram Mini App (xodimlar paneli — /tg-admin) */
export default function MijozPage() {
  return <MijozClient />;
}
