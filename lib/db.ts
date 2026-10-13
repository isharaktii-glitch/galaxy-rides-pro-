
import { neon } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;

export const sql = connectionString ? neon(connectionString) : null;

export function getDatabase() {
  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return sql;
}
