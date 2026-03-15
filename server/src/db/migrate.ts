import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

const dbFile = process.env.DB_FILE_NAME || "prediction_market.db";
const sqlite = new Database(dbFile);
const db = drizzle(sqlite, { schema });

console.log("Running migrations...");
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("✅ Migrations completed");
