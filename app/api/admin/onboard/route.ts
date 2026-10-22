import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { access, db, denied, sameOrigin } from "@/db/store";
import { hashPassword, generateTemporaryPassword } from "@/lib/password";
import { logAudit } from "@/lib/audit";
import { fail, readJson, weakPassword } from "@/lib/http";
import { activatePlan, createRestaurantWithOwner, deleteRestaurantData, ensureSaasTables, getPlan, getSubscription, startTrial } from "@/lib/saas";
import { checkUsernameShape } from "@/lib/usernames";
import { checkEmailProof, EMAIL_PROOF_MESSAGE } from "@/lib/email-proof";
import { sendMail } from "@/lib/mailer";
import { onboardedEmail } from "@/lib/mail-templates";

export const dynamic = "force-dynamic";

const schema = z.object({
  restaurantName: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  city: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  contactEmail: z.string().trim().toLowerCase().email().max(190),
  emailProof: z.string().max(400).optional(),
  username: z.string().trim().toLowerCase().max(30),
  // What they get: a free trial, or a plan that has already been paid for (cash, bank transfer, UPI to you...).
  start: z.enum(["trial", "paid"]),
  plan: z.string().trim().max(16).optional(),
  // Leave the password empty to have one made. Set one to give it to them later. Either way, by default they must
  // choose their own at first sign-in. Sending the email is optional too.
  password: z.string().max(100).optional(),
  mustChange: z.boolean().default(true),
  sendEmail: z.boolean().default(true),
});

// Super Admin: set a restaurant up by hand, the same way a sign-up would be approved. It makes the restaurant and its
// first manager, puts them on a free trial or on a plan that is already paid for, and emails the login details. The
// temporary password is also returned once, so it can be given over the phone.
export async function POST(req: Request) {
  let restaurantId = "";
  try {
    if (!sameOrigin(req)) return NextResponse.json({ error: "Request rejected." }, { status: 403 });
    const a = await access();
    if (!a.owner) return denied(a, "Super Admin access required.");
    const body = await readJson(req);
    if (!body.ok) return body.res;
    const p = schema.safeParse(body.data);
    if (!p.success) {
      const field = String(p.error.issues[0]?.path?.[0] || "details");
      return NextResponse.json({ error: `Please check ${field}.` }, { status: 400 });
    }
    const d = p.data;
    if (!checkEmailProof(d.contactEmail, d.emailProof)) return NextResponse.json({ error: EMAIL_PROOF_MESSAGE, needEmailCode: true }, { status: 400 });
    const shape = checkUsernameShape(d.username);
    if (!shape.ok) return NextResponse.json({ error: shape.reason }, { status: 400 });
    await ensureSaasTables();

    const plan = d.plan && d.plan !== "trial" ? await getPlan(d.plan) : null;
    if (d.plan && d.plan !== "trial" && !plan) return NextResponse.json({ error: "That plan does not exist." }, { status: 400 });
    if (d.start === "paid" && !plan) return NextResponse.json({ error: "Choose the plan they paid for." }, { status: 400 });

    const chosen = (d.password || "").trim();
    if (chosen) {
      const weak = weakPassword(chosen, d.contactEmail);
      if (weak) return NextResponse.json({ error: weak.replace("New password", "The password") }, { status: 400 });
    }
    const temp = chosen || generateTemporaryPassword();
    // A password we made up is always temporary. One you typed can be kept as it is if you turn the switch off.
    const mustChange = chosen ? d.mustChange : true;
    const created = await createRestaurantWithOwner({
      restaurantName: d.restaurantName,
      address: d.address,
      city: d.city,
      phone: d.phone,
      contactEmail: d.contactEmail,
      ownerName: d.ownerName,
      username: d.username,
      passwordHash: await hashPassword(temp),
      mustChange,
      by: a.email,
    });
    restaurantId = created.restaurantId;

    const now = new Date().toISOString();
    if (d.start === "paid" && plan) {
      await activatePlan(restaurantId, plan.key, a.email);
      // A record of the payment you took yourself, so it shows in the payments list and the totals.
      await db()
        .prepare("INSERT INTO payments (id, restaurant_id, plan_key, amount, status, kind, provider_ref, provider_payment, paid_by, created_at, paid_at) VALUES (?, ?, ?, ?, 'paid', 'manual', ?, ?, ?, ?, ?)")
        .bind("pay_" + crypto.randomBytes(8).toString("hex"), restaurantId, plan.key, Math.round(plan.price * 100), "manual_" + crypto.randomBytes(6).toString("hex"), "manual", a.email.toLowerCase(), now, now)
        .run();
    } else {
      await startTrial(restaurantId, a.email);
      if (plan) await db().prepare("UPDATE subscriptions SET requested_plan = ?, requested_at = ? WHERE restaurant_id = ?").bind(plan.key, now, restaurantId).run();
    }
    const sub = await getSubscription(restaurantId);

    await logAudit({
      action: "registration_decided",
      actorEmail: a.email,
      actorRole: a.role,
      targetType: "restaurant",
      targetId: restaurantId,
      details: { decision: "onboarded_by_hand", start: d.start, plan: plan?.key || null, login: created.loginEmail },
    });

    const m = onboardedEmail({
      ownerName: d.ownerName,
      restaurantName: d.restaurantName,
      loginEmail: created.loginEmail,
      restaurantCode: restaurantId,
      tempPassword: temp,
      paidPlan: d.start === "paid" ? plan?.label : undefined,
      endsAt: sub.endsAt || now,
      mustChange,
    });
    const mail = d.sendEmail ? await sendMail(d.contactEmail, m.subject, m.html, m.text) : { sent: false, reason: "Not sent: you chose to give the details yourself." };

    return NextResponse.json({
      ok: true,
      restaurantId,
      restaurantCode: restaurantId,
      loginEmail: created.loginEmail,
      temporaryPassword: temp,
      mustChange,
      subscription: sub,
      mail,
    });
  } catch (err) {
    if (restaurantId) await deleteRestaurantData(restaurantId).catch(() => {});
    return fail(err, "POST /api/admin/onboard", "Could not set up the restaurant.");
  }
}
