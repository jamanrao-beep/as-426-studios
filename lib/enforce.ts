import { headers } from "next/headers";
import type { Access } from "@/db/store";
import { readGlobalControls, readRestaurantControls } from "@/lib/app-controls";
import { getSubscription, isGuestEmail } from "@/lib/saas";

const isMobile = async () => (await headers()).get("x-client") === "mobile";

// One server-side gate for every staff request. The apps hide what is switched off, but hiding is not security:
// this is where it is actually refused.
export async function gate(a: Access): Promise<Access> {
  if (a.owner || !a.role) return a;
  if (a.mustChangePassword) {
    return { ...a, allowed: false, blocked: { code: "must_change_password", message: "Choose your own password first. Open Change password." } };
  }
  if (!a.restaurantId || !(await isMobile())) return a;
  try {
    const g = await readGlobalControls();
    if (g.maintenance.on) {
      return { ...a, allowed: false, blocked: { code: "maintenance", message: g.maintenance.message || "Table Secret is being updated. Please try again soon." } };
    }
    const rc = await readRestaurantControls(a.restaurantId);
    if (!rc.appEnabled) {
      return { ...a, allowed: false, blocked: { code: "app_disabled", message: "The app is switched off for your restaurant. Please contact Table Secret." } };
    }
    if (!(await isGuestEmail(a.email))) {
      const sub = await getSubscription(a.restaurantId);
      if (sub.status === "expired") {
        return { ...a, allowed: false, blocked: { code: "plan_expired", message: "Your plan has ended. Choose a plan to continue." } };
      }
    }
  } catch (e) {
    console.error("gate check failed", e);
  }
  return a;
}

export type FeatureKey =
  | "waiter.cancelOrders"
  | "waiter.orderHistory"
  | "manager.menuEditing"
  | "manager.waiterManagement"
  | "manager.restaurantSettings"
  | "manager.sales"
  | "manager.reviews"
  | "manager.dishPerformance"
  | "manager.dishInsights";

// Returns a 403 response when the Super Admin has switched this feature off for the caller's restaurant, else null.
export async function featureOff(a: Access, key: FeatureKey): Promise<Response | null> {
  if (a.owner || !a.restaurantId || !(await isMobile())) return null;
  const [group, name] = key.split(".");
  if (group === "waiter" && a.role !== "waiter") return null;
  if (group === "manager" && a.role !== "admin") return null;
  const rc = await readRestaurantControls(a.restaurantId);
  const on = (rc as any)[group]?.[name];
  if (on === false) {
    return Response.json({ error: "This feature is switched off for your restaurant by Table Secret.", code: "feature_off" }, { status: 403 });
  }
  return null;
}
