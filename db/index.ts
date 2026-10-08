import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getSqliteD1 } from "./sqlite";

export function getDb() {
  const d1 = (globalThis as any).DB || getSqliteD1();
  return drizzle(d1, { schema });
}
