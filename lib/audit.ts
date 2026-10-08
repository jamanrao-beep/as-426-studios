import { db } from "@/db/store";
import crypto from "node:crypto";

export type AuditAction =
  | "account_created"
  | "account_updated"
  | "account_suspended"
  | "account_reactivated"
  | "account_removed"
  | "password_reset"
  | "password_changed"
  | "sessions_revoked"
  | "restaurant_created"
  | "restaurant_updated"
  | "restaurant_paused"
  | "restaurant_resumed"
  | "restaurant_archived"
  | "order_status_changed"
  | "menu_updated";

export interface AuditEntry {
  action: AuditAction;
  actorId?: string;
  actorEmail?: string;
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    const id = "aud_" + crypto.randomBytes(8).toString("hex");
    const now = new Date().toISOString();
    await db()
      .prepare(
        `INSERT INTO audit_logs (id, action, actor_id, actor_email, actor_role, target_type, target_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        entry.action,
        entry.actorId || "",
        entry.actorEmail || "",
        entry.actorRole || "",
        entry.targetType || "",
        entry.targetId || "",
        JSON.stringify(entry.details || {}),
        now
      )
      .run();
  } catch (err) {
    // Non-blocking error logging
    console.error("[Audit Error]", err);
  }
}
