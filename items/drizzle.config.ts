import "dotenv/config";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function resolveDrizzleSsl():
  | boolean
  | "require"
  | "allow"
  | "prefer"
  | "verify-full"
  | undefined {
  const raw = process.env.PG_SSL?.trim();
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (["0", "false", "disable", "disabled", "off"].includes(normalized)) {
    return undefined;
  }

  if (
    normalized === "require" ||
    normalized === "allow" ||
    normalized === "prefer" ||
    normalized === "verify-full"
  ) {
    return normalized;
  }

  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  return true;
}

function databaseUrlHasSslOptions(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
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

function drizzleCredentialsFromDatabaseUrl(databaseUrl: string) {
  // If the URL already contains SSL options (common for hosted Postgres providers),
  // keep it intact and let drizzle-kit/node-postgres parse them.
  if (databaseUrlHasSslOptions(databaseUrl)) {
    return { url: databaseUrl };
  }

  const ssl = resolveDrizzleSsl();

  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
      return { url: databaseUrl };
    }

    const database = url.pathname.replace(/^\//, "");
    if (!database) return { url: databaseUrl };

    const port = url.port ? Number(url.port) : undefined;
    const user = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;

    return {
      host: url.hostname,
      ...(port ? { port } : {}),
      ...(user ? { user } : {}),
      ...(password ? { password } : {}),
      database,
      ...(ssl !== undefined ? { ssl } : {}),
    };
  } catch {
    return { url: databaseUrl };
  }
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    ...drizzleCredentialsFromDatabaseUrl(process.env.DATABASE_URL),
  },
});
