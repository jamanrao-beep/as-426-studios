import { TRIAL_BASE_DAYS, TRIAL_BONUS_DAYS, TRIAL_DAYS } from "@/lib/saas";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function shell(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#fdf6ec;font-family:Arial,Helvetica,sans-serif;color:#251913">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#df4d03;border-radius:18px 18px 0 0;padding:22px 26px;color:#fff">
<div style="font-size:12px;letter-spacing:2px;opacity:.85">BY AS 426 STUDIOS</div>
<div style="font-size:26px;font-weight:700;margin-top:2px">Table Secret</div></div>
<div style="background:#fff;border:1px solid #e9dccd;border-top:0;border-radius:0 0 18px 18px;padding:26px">
<h1 style="font-size:21px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}
<p style="color:#7b6d64;font-size:12px;margin-top:26px">This email was sent by Table Secret. If you did not expect it, you can ignore it.</p>
</div></div></body></html>`;
}

export function otpEmail(code: string) {
  return {
    subject: `Your Table Secret code: ${code}`,
    html: shell(
      "Your verification code",
      `<p>Enter this code in the app to continue:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:8px;background:#fde4d2;border-radius:12px;padding:14px 18px;display:inline-block;margin:6px 0">${esc(code)}</p>
<p style="color:#7b6d64">It works for 10 minutes. Never share it with anyone.</p>`
    ),
    text: `Your Table Secret verification code is ${code}. It works for 10 minutes.`,
  };
}

export function approvedEmail(p: { ownerName: string; restaurantName: string; loginEmail: string; restaurantCode: string; trialEnds: string; plan?: string }) {
  const ends = new Date(p.trialEnds).toLocaleDateString("en-IN", { dateStyle: "long" });
  return {
    subject: `${p.restaurantName} is approved on Table Secret`,
    html: shell(
      "You're approved! 🎉",
      `<p>Hi ${esc(p.ownerName)},</p>
<p>Great news. <b>${esc(p.restaurantName)}</b> has been verified and is now live on Table Secret.</p>
<div style="background:#fde4d2;border-radius:12px;padding:14px 18px;margin:14px 0">
<div style="color:#7b6d64;font-size:12px">YOUR LOGIN ID</div>
<div style="font-size:20px;font-weight:700">${esc(p.loginEmail)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">RESTAURANT CODE</div>
<div style="font-size:18px;font-weight:700">${esc(p.restaurantCode)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">PASSWORD</div>
<div>The one you chose when you registered</div></div>
<p style="color:#7b6d64;font-size:13px">To sign in, type your login ID, or your restaurant code and username. Your waiters use the same restaurant code.</p>
<p>Open the Table Secret app and sign in. Your <b>${TRIAL_DAYS}-day free trial</b> (${TRIAL_BASE_DAYS} days plus a ${TRIAL_BONUS_DAYS}-day welcome bonus) is running and ends on <b>${esc(ends)}</b>.${
        p.plan ? ` We noted that you are interested in the <b>${esc(p.plan)}</b> plan, and we will be in touch before your trial ends.` : ""
      }</p>
<p>Add your dishes, invite your waiters and print your table QR code. Mira, our little robot, will guide you on your first sign-in.</p>`
    ),
    text: `Hi ${p.ownerName}, ${p.restaurantName} is approved on Table Secret. Login ID: ${p.loginEmail}. Restaurant code: ${p.restaurantCode}. Use the password you chose when you registered. Your ${TRIAL_DAYS}-day free trial ends on ${ends}.`,
  };
}

export function rejectedEmail(p: { ownerName: string; restaurantName: string; note?: string }) {
  return {
    subject: `About your Table Secret request for ${p.restaurantName}`,
    html: shell(
      "We could not approve your request",
      `<p>Hi ${esc(p.ownerName)},</p>
<p>Thank you for your interest in Table Secret. We were not able to approve the request for <b>${esc(p.restaurantName)}</b> right now.</p>
${p.note ? `<p style="background:#fde4d2;border-radius:12px;padding:12px 16px"><b>Note from our team:</b> ${esc(p.note)}</p>` : ""}
<p>You are welcome to register again with corrected details, or reply to this email and we will help.</p>`
    ),
    text: `Hi ${p.ownerName}, we could not approve the Table Secret request for ${p.restaurantName}.${p.note ? " Note: " + p.note : ""}`,
  };
}

export function guestWelcomeEmail(p: { days: number }) {
  return {
    subject: "Your Table Secret guest week has started",
    html: shell(
      "Welcome! Your guest week has started",
      `<p>You can explore Table Secret for <b>${p.days} days</b> as a guest, with a sample restaurant to play with.</p>
<p>When you are ready for your own restaurant, tap <b>Register my restaurant</b> in the app. Approved restaurants get a ${TRIAL_DAYS}-day free trial: ${TRIAL_BASE_DAYS} days plus a ${TRIAL_BONUS_DAYS}-day welcome bonus.</p>`
    ),
    text: `Your ${p.days}-day Table Secret guest week has started. Register your restaurant in the app when you are ready.`,
  };
}

export function supportEmail(p: { name?: string; email: string; phone?: string; role?: string; restaurant?: string; question: string }) {
  const who = [p.name, p.role, p.restaurant].filter(Boolean).join(" · ");
  return {
    subject: `Question from the app: ${p.question.slice(0, 60)}`,
    html: shell(
      "A question from the app",
      `<p style="white-space:pre-wrap;font-size:16px;background:#fff1e8;border-radius:12px;padding:14px 16px">${esc(p.question)}</p>
<p><b>From:</b> ${esc(p.email)}${p.phone ? ` · ${esc(p.phone)}` : ""}${who ? `<br><b>Details:</b> ${esc(who)}` : ""}</p>
<p style="color:#7b6d64">Just reply to this email and it goes straight to them.</p>`
    ),
    text: `${p.question}

From: ${p.email}${who ? `
Details: ${who}` : ""}`,
  };
}

export function replyEmail(p: { name?: string; question: string; reply: string }) {
  return {
    subject: "Our reply to your Table Secret question",
    html: shell(
      `Hi${p.name ? " " + p.name.split(" ")[0] : ""}, here is our reply`,
      `<p style="white-space:pre-wrap;font-size:16px;background:#fff1e8;border-radius:12px;padding:14px 16px">${esc(p.reply)}</p>
<p style="color:#7b6d64;font-size:13px">You asked: “${esc(p.question)}”</p>
<p style="color:#7b6d64">You can reply to this email if you need more help. The same answer is waiting for you in the app, in your chat with Mira.</p>`
    ),
    text: `${p.reply}\n\nYou asked: ${p.question}`,
  };
}

export function managerApprovedEmail(p: { name: string; restaurantName: string; loginEmail: string; restaurantCode: string; tempPassword: string; proposedBy: string }) {
  return {
    subject: `You are now a manager at ${p.restaurantName} on Table Secret`,
    html: shell(
      "Your manager account is ready",
      `<p>Hi ${esc(p.name)},</p>
<p>${esc(p.proposedBy)} asked for you to manage <b>${esc(p.restaurantName)}</b> on Table Secret, and the request was approved.</p>
<div style="background:#fde4d2;border-radius:12px;padding:14px 18px;margin:14px 0">
<div style="color:#7b6d64;font-size:12px">YOUR LOGIN ID</div>
<div style="font-size:20px;font-weight:700">${esc(p.loginEmail)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">RESTAURANT CODE</div>
<div style="font-size:18px;font-weight:700">${esc(p.restaurantCode)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">TEMPORARY PASSWORD</div>
<div style="font-size:20px;font-weight:700">${esc(p.tempPassword)}</div></div>
<p>Sign in on the website or in the app. You will be asked to choose your own password straight away.</p>`
    ),
    text: `Hi ${p.name}, your manager account for ${p.restaurantName} on Table Secret is ready. Login ID: ${p.loginEmail}. Restaurant code: ${p.restaurantCode}. Temporary password: ${p.tempPassword}. You will choose your own password when you sign in.`,
  };
}

export function managerRejectedEmail(p: { name: string; restaurantName: string; note?: string }) {
  return {
    subject: `Manager request for ${p.restaurantName}`,
    html: shell(
      "Your manager request was not approved",
      `<p>The request to add <b>${esc(p.name)}</b> as a manager at <b>${esc(p.restaurantName)}</b> was not approved.${p.note ? ` Note from the team: ${esc(p.note)}` : ""}</p><p>You can write to us from the Help chat if you would like to talk about it.</p>`
    ),
    text: `The request to add ${p.name} as a manager at ${p.restaurantName} was not approved.${p.note ? ` Note: ${p.note}` : ""}`,
  };
}

// Sent when the Super Admin sets a restaurant up by hand: the login, the restaurant code, a temporary password and
// what they are on (a free trial that ends on a date, or a plan that has been paid for).
export function onboardedEmail(p: { ownerName: string; restaurantName: string; loginEmail: string; restaurantCode: string; tempPassword: string; paidPlan?: string; endsAt: string; mustChange?: boolean }) {
  const change = p.mustChange !== false;
  const ends = new Date(p.endsAt).toLocaleDateString("en-IN", { dateStyle: "long" });
  const what = p.paidPlan ? `Your <b>${esc(p.paidPlan)}</b> plan is active until <b>${esc(ends)}</b>.` : `Your <b>${TRIAL_DAYS}-day free trial</b> is running and ends on <b>${esc(ends)}</b>.`;
  return {
    subject: `${p.restaurantName} is set up on Table Secret`,
    html: shell(
      "Your restaurant is ready",
      `<p>Hi ${esc(p.ownerName)},</p>
<p><b>${esc(p.restaurantName)}</b> has been set up on Table Secret. ${what}</p>
<div style="background:#fde4d2;border-radius:12px;padding:14px 18px;margin:14px 0">
<div style="color:#7b6d64;font-size:12px">YOUR LOGIN ID</div>
<div style="font-size:20px;font-weight:700">${esc(p.loginEmail)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">RESTAURANT CODE</div>
<div style="font-size:18px;font-weight:700">${esc(p.restaurantCode)}</div>
<div style="color:#7b6d64;font-size:12px;margin-top:8px">${change ? "TEMPORARY PASSWORD" : "PASSWORD"}</div>
<div style="font-size:20px;font-weight:700">${esc(p.tempPassword)}</div></div>
<p>Sign in on the website or in the app with your login ID, or with your restaurant code and username. ${change ? "You will choose your own password straight away." : "You can change it any time from the Password button."} Your waiters use the same restaurant code.</p>`
    ),
    text: `Hi ${p.ownerName}, ${p.restaurantName} is set up on Table Secret. ${p.paidPlan ? `Your ${p.paidPlan} plan is active until ${ends}.` : `Your ${TRIAL_DAYS}-day free trial ends on ${ends}.`} Login ID: ${p.loginEmail}. Restaurant code: ${p.restaurantCode}. ${change ? `Temporary password: ${p.tempPassword}. You will choose your own password when you sign in.` : `Password: ${p.tempPassword}. You can change it any time.`}`,
  };
}

// A security notice: their password was just changed. If it was not them, they need to know straight away.
export function passwordChangedEmail(p: { name?: string; loginEmail: string; when: Date }) {
  const when = p.when.toLocaleString("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });
  return {
    subject: "Your Table Secret password was changed",
    html: shell(
      "Your password was changed",
      `<p>Hi ${esc(p.name || "there")},</p>
<p>The password for <b>${esc(p.loginEmail)}</b> was changed on <b>${esc(when)}</b> (India time). You were signed out of your other devices.</p>
<p style="background:#fde4d2;border-radius:12px;padding:12px 16px">If this was you, there is nothing to do. If it was <b>not</b> you, reply to this email or write to us from the Help chat right away so we can lock the account.</p>`
    ),
    text: `Hi ${p.name || "there"}, the password for ${p.loginEmail} was changed on ${when} (India time). You were signed out of your other devices. If this was not you, write to us right away.`,
  };
}

// The Super Admin reset someone's password. The new temporary password goes to the inbox they gave us.
export function passwordResetEmail(p: { name?: string; loginEmail: string; restaurantCode?: string; tempPassword: string }) {
  return {
    subject: "Your Table Secret password was reset",
    html: shell(
      "Your password was reset",
      `<p>Hi ${esc(p.name || "there")},</p>
<p>The Table Secret team reset the password for <b>${esc(p.loginEmail)}</b>. Use this temporary password to sign in. You will be asked to choose your own straight away.</p>
<div style="background:#fde4d2;border-radius:12px;padding:14px 18px;margin:14px 0">
<div style="color:#7b6d64;font-size:12px">LOGIN ID</div>
<div style="font-size:18px;font-weight:700">${esc(p.loginEmail)}</div>${
        p.restaurantCode ? `
<div style="color:#7b6d64;font-size:12px;margin-top:8px">RESTAURANT CODE</div>
<div style="font-size:18px;font-weight:700">${esc(p.restaurantCode)}</div>` : ""
      }
<div style="color:#7b6d64;font-size:12px;margin-top:8px">TEMPORARY PASSWORD</div>
<div style="font-size:20px;font-weight:700">${esc(p.tempPassword)}</div></div>
<p style="color:#7b6d64;font-size:13px">You were signed out of all devices. If you did not ask for this, write to us from the Help chat.</p>`
    ),
    text: `Hi ${p.name || "there"}, the Table Secret team reset the password for ${p.loginEmail}. Temporary password: ${p.tempPassword}.${p.restaurantCode ? ` Restaurant code: ${p.restaurantCode}.` : ""} You will choose your own when you sign in. You were signed out of all devices.`,
  };
}

// The 6-digit code for "Forgot password".
export function resetCodeEmail(p: { name?: string; loginEmail: string; code: string }) {
  return {
    subject: `Your Table Secret password reset code: ${p.code}`,
    html: shell(
      "Reset your password",
      `<p>Hi ${esc(p.name || "there")},</p>
<p>Someone asked to reset the password for <b>${esc(p.loginEmail)}</b>. Enter this code to choose a new one:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:8px;background:#fde4d2;border-radius:12px;padding:14px 18px;display:inline-block;margin:6px 0">${esc(p.code)}</p>
<p style="color:#7b6d64">It works for 10 minutes. If this was not you, ignore this email: your password stays the same. Never share this code with anyone.</p>`
    ),
    text: `Your Table Secret password reset code for ${p.loginEmail} is ${p.code}. It works for 10 minutes. If this was not you, ignore this email.`,
  };
}
