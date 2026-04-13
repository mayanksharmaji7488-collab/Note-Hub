
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import fs from "node:fs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function databaseUrlHasSslOptions(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    // node-postgres parses these from the connection string and may override `ssl` in config.
    return (
      url.searchParams.has("sslmode") ||
      url.searchParams.has("sslrootcert") ||
      url.searchParams.has("sslcert") ||
      url.searchParams.has("sslkey")
    );
  } catch {
    return false;
  }
}

function resolvePgSsl():
  | boolean
  | {
      rejectUnauthorized?: boolean;
      ca?: string;
    }
  | undefined {
  const raw = process.env.PG_SSL?.trim();
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (["0", "false", "disable", "disabled", "off"].includes(normalized)) {
    return undefined;
  }

  // Keep behavior explicit: only enable SSL when PG_SSL is set.
  // Modes align with common Postgres tooling and drizzle-kit conventions.
  let rejectUnauthorized: boolean | undefined =
    normalized === "require" || normalized === "allow" || normalized === "prefer"
      ? false
      : normalized === "verify-full" || normalized === "verify-ca"
        ? true
        : true;

  const overrideRejectUnauthorized = parseBoolean(
    process.env.PG_SSL_REJECT_UNAUTHORIZED,
  );
  if (overrideRejectUnauthorized !== undefined) {
    rejectUnauthorized = overrideRejectUnauthorized;
  }

  let ca: string | undefined;
  const caFromEnv = process.env.PG_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (caFromEnv) ca = caFromEnv;

  const caFile = process.env.PG_SSL_CA_FILE?.trim();
  if (caFile) {
    ca = fs.readFileSync(caFile, "utf8");
  }

  return { rejectUnauthorized, ...(ca ? { ca } : {}) };
}

const databaseUrl = process.env.DATABASE_URL;
const sslFromUrl = databaseUrlHasSslOptions(databaseUrl);

export const pool = new Pool({
  connectionString: databaseUrl,
  // If SSL is configured in DATABASE_URL (common for Neon/Supabase), don't pass `ssl` here.
  // node-postgres can override the `ssl` object when parsing connection string options.
  ssl: sslFromUrl ? undefined : resolvePgSsl(),
  max: Number.parseInt(process.env.PG_POOL_MAX || "10", 10),
  idleTimeoutMillis: Number.parseInt(process.env.PG_POOL_IDLE_MS || "30000", 10),
  connectionTimeoutMillis: Number.parseInt(
    process.env.PG_POOL_CONNECT_TIMEOUT_MS || "5000",
    10,
  ),
});
export const db = drizzle(pool, { schema });
