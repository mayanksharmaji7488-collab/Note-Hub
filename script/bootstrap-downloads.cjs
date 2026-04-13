require("dotenv/config");

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(`
    create table if not exists downloads (
      id serial primary key,
      user_id integer not null,
      note_id integer not null,
      created_at timestamp default now()
    );
  `);

  await pool.query(`
    create unique index if not exists downloads_user_note_uniq
    on downloads (user_id, note_id);
  `);

  console.log("downloads table ready");
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err?.message || err);
    await pool.end();
    process.exit(1);
  });

