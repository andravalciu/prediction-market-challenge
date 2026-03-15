import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (!db) {
    const dbFile = process.env.DB_FILE_NAME || "prediction_market.db";
    const sqlite = new Database(dbFile);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export default getDb();
