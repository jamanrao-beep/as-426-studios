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

export function approvedEmail(p: { ownerName: string; restaurantName: string; loginEmail: string; trialEnds: string; plan?: string }) {
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
<div style="color:#7b6d64;font-size:12px;margin-top:8px">PASSWORD</div>
<div>The one you chose when you registered</div></div>
<p>Open the Table Secret app and sign in. Your <b>7-day free trial</b> is running and ends on <b>${esc(ends)}</b>.${
        p.plan ? ` We noted that you are interested in the <b>${esc(p.plan)}</b> plan, and we will be in touch before your trial ends.` : ""
      }</p>
<p>Add your dishes, invite your waiters and print your table QR code. Tabi, our little robot, will guide you on your first sign-in.</p>`
    ),
    text: `Hi ${p.ownerName}, ${p.restaurantName} is approved on Table Secret. Login ID: ${p.loginEmail}. Use the password you chose when you registered. Your 7-day free trial ends on ${ends}.`,
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
<p>When you are ready for your own restaurant, tap <b>Register my restaurant</b> in the app. Approved restaurants get a 7-day free trial.</p>`
    ),
    text: `Your ${p.days}-day Table Secret guest week has started. Register your restaurant in the app when you are ready.`,
  };
}

export function supportEmail(p: { name?: string; email: string; role?: string; restaurant?: string; question: string }) {
  const who = [p.name, p.role, p.restaurant].filter(Boolean).join(" · ");
  return {
    subject: `Question from the app: ${p.question.slice(0, 60)}`,
    html: shell(
      "A question from the app",
      `<p style="white-space:pre-wrap;font-size:16px;background:#fff1e8;border-radius:12px;padding:14px 16px">${esc(p.question)}</p>
<p><b>From:</b> ${esc(p.email)}${who ? `<br><b>Details:</b> ${esc(who)}` : ""}</p>
<p style="color:#7b6d64">Just reply to this email and it goes straight to them.</p>`
    ),
    text: `${p.question}

From: ${p.email}${who ? `
Details: ${who}` : ""}`,
  };
}
