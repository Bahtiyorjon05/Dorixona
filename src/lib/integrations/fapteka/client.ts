import { XMLParser } from "fast-xml-parser";
import { FAPTEKA_REPORTS, type FaptekaReportKey } from "./mapping";

export type FaptekaRow = Record<string, string>;

export type FaptekaConfig = {
  endpoint: string;
  filialId: string;
  token?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

export function parseCharset(contentType?: string) {
  if (!contentType) return null;
  const match = contentType.match(/charset=\s*(["']?)([^;"']+)\1/i);
  return match ? match[2].trim().toLowerCase() : null;
}

function parseXmlDeclarationCharset(text: string) {
  const match = text.match(/<\?xml[^>]*encoding=(["'])([^"']+)\1/i);
  return match ? match[2].trim().toLowerCase() : null;
}

function decodeWithEncoding(buffer: ArrayBuffer, encoding: string) {
  try {
    const decoded = new TextDecoder(encoding, { fatal: true }).decode(buffer);
    return decoded.includes("�") ? null : decoded;
  } catch {
    return null;
  }
}

export function decodeXmlBuffer(buffer: ArrayBuffer, contentType?: string) {
  const preferred = parseCharset(contentType);
  const encodings = [preferred, "utf-8", "windows-1251", "windows-1252"].filter(
    (value): value is string => Boolean(value),
  );

  for (const encoding of encodings) {
    const decoded = decodeWithEncoding(buffer, encoding);
    if (decoded !== null) return decoded;
  }

  const utf8Decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const fallback = parseXmlDeclarationCharset(utf8Decoded);
  if (fallback && fallback !== "utf-8") {
    const xmlDecoded = decodeWithEncoding(buffer, fallback);
    if (xmlDecoded !== null) return xmlDecoded;
  }

  return utf8Decoded;
}

function flattenXmlValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => flattenXmlValue(item))
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("#text" in obj) return flattenXmlValue(obj["#text"]);
    if ("text" in obj) return flattenXmlValue(obj["text"]);
  }

  return null;
}

function toPrimitiveString(value: unknown): string | null {
  return flattenXmlValue(value);
}

function parseFaptekaDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;

  const iso = new Date(text);
  if (!Number.isNaN(iso.getTime())) return iso;

  const normalized = text.replace(/\s+/g, " ");
  const dmY = normalized.match(/^(\d{1,2})[\.\-/](\d{1,2})[\.\-/](\d{2,4})(?:[ T](.*))?$/);
  if (dmY) {
    const day = Number(dmY[1]);
    const month = Number(dmY[2]);
    let year = Number(dmY[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    const time = dmY[4] ? dmY[4].trim() : "";
    const [hours = 0, minutes = 0, seconds = 0] = time
      ? time.split(/[:\s]+/).map((part) => Number(part))
      : [];
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }
  }

  const ymd = normalized.match(/^(\d{4})[\.\-/](\d{1,2})[\.\-/](\d{1,2})(?:[ T](.*))?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const time = ymd[4] ? ymd[4].trim() : "";
    const [hours = 0, minutes = 0, seconds = 0] = time
      ? time.split(/[:\s]+/).map((part) => Number(part))
      : [];
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date;
    }
  }

  return null;
}

function formatFaptekaDate(value: Date | string) {
  const date = parseFaptekaDate(value);
  if (!date) throw new Error("F-Apteka sana formati noto'g'ri");
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getFullYear()}`;
}

function reportEndpoint() {
  const explicit = process.env.FAPTEKA_REPORT_URL?.trim();
  if (explicit) return explicit;

  const base = process.env.FAPTEKA_REPORT_BASE_URL?.trim();
  if (!base) return "";
  return new URL("/P_GetReport_XML", base.endsWith("/") ? base : `${base}/`).toString();
}

function publicAppBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL;
  if (!raw) return "";

  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? trimmed
    : `https://${trimmed}`;
}

export function getFaptekaSitePushUrl() {
  const baseUrl = publicAppBaseUrl();
  return baseUrl ? `${baseUrl}/api/integrations/fapteka/site` : "/api/integrations/fapteka/site";
}

export function getFaptekaConfig(): FaptekaConfig {
  const endpoint = reportEndpoint();
  const filialId = process.env.FAPTEKA_FILIAL_ID?.trim() || "1";
  const token = process.env.FAPTEKA_REPORT_TOKEN?.trim() || undefined;
  if (!endpoint) {
    throw new Error("FAPTEKA_REPORT_URL yoki FAPTEKA_REPORT_BASE_URL .env da sozlanmagan");
  }
  return { endpoint, filialId, token };
}

export function getFaptekaEnvStatus() {
  const endpoint = reportEndpoint();
  return {
    configured: Boolean(endpoint),
    endpoint: endpoint || "sozlanmagan",
    filialId: process.env.FAPTEKA_FILIAL_ID?.trim() || "1",
    hasToken: Boolean(process.env.FAPTEKA_REPORT_TOKEN?.trim()),
    hasSiteToken: Boolean(process.env.FAPTEKA_SITE_TOKEN?.trim()),
    sitePushUrl: getFaptekaSitePushUrl(),
  };
}

function collectRows(value: unknown, rows: FaptekaRow[] = []): FaptekaRow[] {
  if (Array.isArray(value)) {
    for (const item of value) collectRows(item, rows);
    return rows;
  }

  if (!value || typeof value !== "object") return rows;
  const obj = value as Record<string, unknown>;
  const row: FaptekaRow = {};
  let nested = false;

  for (const [key, val] of Object.entries(obj)) {
    const primitive = toPrimitiveString(val);
    if (primitive !== null) {
      row[key] = primitive;
    } else {
      nested = true;
    }
  }

  const hasReportShape = ["ID", "I", "G", "N", "Q", "P", "SP", "SN", "D"].some((key) => key in row);
  if (hasReportShape) rows.push(row);

  if (nested) {
    for (const val of Object.values(obj)) {
      if (val && typeof val === "object") collectRows(val, rows);
    }
  }

  return rows;
}

export function parseFaptekaXml(xml: string): FaptekaRow[] {
  const parsed = parser.parse(xml);
  return collectRows(parsed).filter((row) => Object.keys(row).length > 0);
}

export async function fetchFaptekaReport(input: {
  report: FaptekaReportKey;
  dateFrom: Date | string;
  dateTo: Date | string;
  config?: FaptekaConfig;
}) {
  const config = input.config ?? getFaptekaConfig();
  const report = FAPTEKA_REPORTS[input.report];
  const url = new URL(config.endpoint);
  url.searchParams.set("pDateFrom", formatFaptekaDate(input.dateFrom));
  url.searchParams.set("pDateTo", formatFaptekaDate(input.dateTo));
  url.searchParams.set("pFilial_id", config.filialId);
  url.searchParams.set("pReport_id", String(report.id));

  const response = await fetch(url, {
    cache: "no-store",
    headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined,
  });
  if (!response.ok) {
    throw new Error(`F-Apteka ${report.title} javobi xato: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const xml = decodeXmlBuffer(buffer, response.headers.get("content-type") ?? undefined);
  return {
    report,
    url: url.toString(),
    rows: parseFaptekaXml(xml),
  };
}

export function numberValue(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function dateValue(value: unknown) {
  return parseFaptekaDate(value);
}

export function startOfMonthString(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export function todayString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
