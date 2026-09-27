import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";

function shouldRelaxTls(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  return (
    process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "false" ||
    sslMode === "require" ||
    sslMode === "prefer" ||
    sslMode === "no-verify"
  );
}

function withoutSslMode(connectionString: string) {
  const url = new URL(connectionString);
  url.searchParams.delete("sslmode");
  return url.toString();
}

export function createPrismaPgAdapter() {
  const connectionString = process.env.DATABASE_URL;
  const relaxTls = connectionString ? shouldRelaxTls(connectionString) : false;
  const config: PoolConfig = {
    connectionString: connectionString && relaxTls ? withoutSslMode(connectionString) : connectionString,
    // Bitta ulanishda sahifaning Promise.all so'rovlari ham navbatga tizilib
    // qolardi (bosh sahifada 7 ta so'rov ketma-ket). 4 ta — so'rovlar parallel
    // ketadi, pooler limiti esa baribir oshib ketmaydi.
    max: Number(process.env.POSTGRES_POOL_MAX ?? 4),
    idleTimeoutMillis: 10_000,
  };
  if (relaxTls) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new PrismaPg(config);
}
