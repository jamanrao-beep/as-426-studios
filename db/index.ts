import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getSqliteD1 } from "./sqlite";
import { getMysqlDb, isMysqlConfigured } from "./mysql";

export function getDb() {
  const d1 = (globalThis as any).DB || (isMysqlConfigured() ? getMysqlDb() : getSqliteD1());
  return drizzle(d1, { schema });
}
