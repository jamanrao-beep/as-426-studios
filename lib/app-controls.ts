import { db } from "@/db/store";

// Controls the Super Admin manages from the website and the mobile app obeys.
export type ManagerFeatures = {
  menuEditing: boolean;
  waiterManagement: boolean;
  sales: boolean;
  reviews: boolean;
  dishPerformance: boolean;
  dishInsights: boolean;
  restaurantSettings: boolean;
  qrCode: boolean;
};

export type WaiterFeatures = {
  cancelOrders: boolean;
  orderHistory: boolean;
};

export type RestaurantControls = {
  appEnabled: boolean;
  pushEnabled: boolean;
  manager: ManagerFeatures;
  waiter: WaiterFeatures;
};

export type GlobalControls = {
  maintenance: { on: boolean; message: string };
  announcement: { on: boolean; title: string; text: string; id: string };
  minVersion: string;
};

export const defaultRestaurantControls: RestaurantControls = {
  appEnabled: true,
  pushEnabled: true,
  manager: {
    menuEditing: true,
    waiterManagement: true,
    sales: true,
    reviews: true,
    dishPerformance: true,
    dishInsights: true,
    restaurantSettings: true,
    qrCode: true,
  },
  waiter: { cancelOrders: true, orderHistory: true },
};

export const defaultGlobalControls: GlobalControls = {
  maintenance: { on: false, message: "" },
  announcement: { on: false, title: "", text: "", id: "" },
  minVersion: "",
};

import { cached } from "@/lib/ttl-cache";

let ready: Promise<void> | null = null;
export function ensureControlsTables() {
  ready ??= (async () => {
    await db()
      .prepare(
        `CREATE TABLE IF NOT EXISTS app_controls (
          scope VARCHAR(80) PRIMARY KEY NOT NULL,
          data TEXT NOT NULL,
          updated_at VARCHAR(40) NOT NULL,
          updated_by VARCHAR(120)
        )`
      )
      .run();
    await db()
      .prepare(
        `CREATE TABLE IF NOT EXISTS push_tokens (
          token VARCHAR(190) PRIMARY KEY NOT NULL,
          user_email VARCHAR(190) NOT NULL,
          role VARCHAR(20) NOT NULL,
          restaurant_id VARCHAR(80),
          platform VARCHAR(16),
          updated_at VARCHAR(40) NOT NULL
        )`
      )
      .run();
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}

function merge<T extends Record<string, any>>(base: T, patch: any): T {
  const out: any = Array.isArray(base) ? [...base] : { ...base };
  if (!patch || typeof patch !== "object") return out;
  for (const k of Object.keys(base)) {
    const b = (base as any)[k];
    const p = patch[k];
    if (p === undefined) continue;
    if (b && typeof b === "object" && !Array.isArray(b)) out[k] = merge(b, p);
    else if (typeof p === typeof b) out[k] = p;
  }
  return out;
}

function readScope(scope: string): Promise<any | null> {
  return cached(`ctl:${scope}`, 8000, () => readScopeNow(scope));
}

async function readScopeNow(scope: string): Promise<any | null> {
  await ensureControlsTables();
  const row = await db().prepare("SELECT data FROM app_controls WHERE scope = ?").bind(scope).first<{ data: string }>();
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export async function readGlobalControls(): Promise<GlobalControls> {
  return merge(defaultGlobalControls, await readScope("global"));
}

export async function readRestaurantControls(restaurantId: string): Promise<RestaurantControls> {
  return merge(defaultRestaurantControls, await readScope(`restaurant:${restaurantId}`));
}

export async function writeScope(scope: string, data: unknown, by: string) {
  await ensureControlsTables();
  const json = JSON.stringify(data);
  const now = new Date().toISOString();
  const existing = await db().prepare("SELECT scope FROM app_controls WHERE scope = ?").bind(scope).first();
  if (existing) {
    await db().prepare("UPDATE app_controls SET data = ?, updated_at = ?, updated_by = ? WHERE scope = ?").bind(json, now, by, scope).run();
  } else {
    await db().prepare("INSERT INTO app_controls (scope, data, updated_at, updated_by) VALUES (?, ?, ?, ?)").bind(scope, json, now, by).run();
  }
}

export function mergeGlobal(patch: unknown) {
  return merge(defaultGlobalControls, patch);
}
export function mergeRestaurant(patch: unknown) {
  return merge(defaultRestaurantControls, patch);
}
