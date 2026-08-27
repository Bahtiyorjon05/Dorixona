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
    // Serverless: har bir Vercel instance uchun bitta ulanish (Supabase pooler limitini saqlash uchun).
    max: Number(process.env.POSTGRES_POOL_MAX ?? 1),
    idleTimeoutMillis: 10_000,
  };
  if (relaxTls) {
    config.ssl = { rejectUnauthorized: false };
  }

  return new PrismaPg(config);
}
