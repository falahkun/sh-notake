import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const client = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  idle_timeout: 15,
  connect_timeout: 10,
  max: 10
});

export const db = drizzle(client);
