import { existsSync, readdirSync, readFileSync } from "node:fs";
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

const applied = await sql`select id from schema_migrations`;
const seen = new Set(applied.map((row) => row.id));
const dir = new URL("../drizzle/", import.meta.url);
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const name of files) {
  const id = name.replace(/\.sql$/, "");
  if (seen.has(id)) continue;
  await sql.unsafe(readFileSync(new URL(name, dir), "utf8"));
  await sql`insert into schema_migrations (id) values (${id})`;
  console.log(`Applied ${id}`);
}

if (files.every((name) => seen.has(name.replace(/\.sql$/, "")))) {
  console.log("Schema already current");
}

await sql.end();
