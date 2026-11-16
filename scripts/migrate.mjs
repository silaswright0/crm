import { existsSync, readFileSync } from "node:fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && existsSync(".env")) {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    if (!process.env[key]) {
      process.env[key] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

await sql`create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())`;

const applied = await sql`select id from schema_migrations where id = '0000_init'`;

if (applied.length === 0) {
  const file = readFileSync(new URL("../drizzle/0000_init.sql", import.meta.url), "utf8");
  await sql.unsafe(file);
  await sql`insert into schema_migrations (id) values ('0000_init')`;
  console.log("Applied 0000_init");
} else {
  console.log("Schema already current");
}

await sql.end();
