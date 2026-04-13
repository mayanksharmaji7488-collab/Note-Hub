/* eslint-disable no-console */
const dotenv = require("dotenv");
const pg = require("pg");

dotenv.config();

async function main() {
  const databaseUrl = (process.env.DATABASE_URL || "").trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Set it in .env before running this script.");
  }

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await pool.query('alter table "users" add column if not exists "email" text;');
    await pool.query('alter table "users" add column if not exists "phone" text;');

    const { rows } = await pool.query(
      "select column_name from information_schema.columns where table_schema='public' and table_name='users' order by ordinal_position;",
    );
    console.log("users columns:", rows.map((r) => r.column_name).join(", "));
    console.log("OK: ensured users.email and users.phone exist.");
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

