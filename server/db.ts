import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a pool instead of a single connection for better compatibility
const pool = mysql.createPool(process.env.DATABASE_URL);

export const connection = pool;
export const db = drizzle(pool, { schema, mode: 'default' });