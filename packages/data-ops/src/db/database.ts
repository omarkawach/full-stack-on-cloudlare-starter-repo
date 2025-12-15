// Always start a monorepo with a getter/setter for an initialized DB
import { drizzle } from "drizzle-orm/d1";

let db: ReturnType<typeof drizzle>;

// Booted up by consuming app immediately from request
// To be used by worker/index.ts
export function initDatabase(bindingDb: D1Database) {
  db = drizzle(bindingDb);
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
