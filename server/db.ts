import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_PATH ?? "./data/lightning.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "../drizzle") });
db.insert(schema.screenState).values({ id: 1 }).onConflictDoNothing().run();
