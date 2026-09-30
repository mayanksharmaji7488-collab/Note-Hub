require("dotenv/config");

const { defineConfig } = require("drizzle-kit");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

module.exports = defineConfig({
  out: "./migrations",
  // Use precompiled CJS schema so drizzle-kit doesn't need to transpile TS.
  schema: "./.drizzle/schema.cjs",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});

