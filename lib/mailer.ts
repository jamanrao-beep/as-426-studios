import net from "node:net";
import tls from "node:tls";

// Sends email from the Table Secret Gmail account over SMTP, with no extra packages.
// Set MAIL_USER (the Gmail address) and MAIL_PASS (a Gmail "App password", not the normal password).
// Values pasted into a host dashboard often arrive with spaces, quotes or a trailing newline. Gmail shows an App password
// as four groups of four letters with spaces, so those are removed too.
const cleanUser = () => (process.env.MAIL_USER || "").trim().replace(/^["']|["']$/g, "");
const cleanPass = () => (process.env.MAIL_PASS || "").replace(/\s+/g, "").replace(/^["']|["']$/g, "");

export function mailConfigured() {
  return !!cleanUser() && !!cleanPass();
}

// What the Super Admin sees when checking the email setup. It never includes the password.
export function mailStatus() {
  return { configured: mailConfigured(), user: cleanUser(), passLength: cleanPass().length, host: process.env.MAIL_HOST || "smtp.gmail.com" };
}

type Result = { sent: boolean; reason?: string };

const b64 = (s: string) => Buffer.from(s, "utf-8").toString("base64");
const header = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap = (s: string) => s.replace(/(.{76})/g, "$1\r\n");

function buildMessage(from: string, fromName: string, to: string, subject: string, html: string, text: string, replyTo?: string) {
  const boundary = "ts_" + Math.random().toString(36).slice(2);
  return [
    `From: ${header(fromName)} <${from}>`,
    `To: ${to}`,
    ...(replyTo && /^\S+@\S+\.\S+$/.test(replyTo) ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    wrap(b64(html)),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

async function sendRaw(to: string, subject: string, html: string, text: string, replyTo?: string): Promise<Result> {
  if (!mailConfigured()) {
    console.warn(`[mail] not configured, would have sent "${subject}" to ${to}`);
    return { sent: false, reason: "Email is not set up on the server yet." };
  }
  if (!/^\S+@\S+\.\S+$/.test(to)) return { sent: false, reason: "That email address is not valid." };

  const user = cleanUser();
  const pass = cleanPass();
  const host = process.env.MAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.MAIL_PORT || 465);
  const secure = process.env.MAIL_SECURE !== "false";
  const fromName = process.env.MAIL_FROM_NAME || "Table Secret";

  return new Promise<Result>((resolve) => {
    let buffer = "";
    let step = 0;
    let done = false;
    let socket: net.Socket;
    const finish = (r: Result) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {}
      resolve(r);
    };

    const message = buildMessage(user, fromName, to, subject, html, text, replyTo).replace(/^\./gm, "..");
    const plan: Array<{ send?: string; expect: number }> = [
      { expect: 220 },
      { send: "EHLO tablesecret.app", expect: 250 },
      { send: "AUTH LOGIN", expect: 334 },
      { send: b64(user), expect: 334 },
      { send: b64(pass), expect: 235 },
      { send: `MAIL FROM:<${user}>`, expect: 250 },
      { send: `RCPT TO:<${to}>`, expect: 250 },
      { send: "DATA", expect: 354 },
      { send: message + "\r\n.", expect: 250 },
      { send: "QUIT", expect: 221 },
    ];
    // Local test servers can skip the login steps.
    const steps = pass ? plan : plan.filter((p) => !["AUTH LOGIN", b64(user), b64(pass)].includes(p.send || ""));

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf-8");
      let idx: number;
      while ((idx = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const m = /^(\d{3})([ -])/.exec(line);
        if (!m || m[2] === "-") continue; // keep reading a multi-line reply
        const code = Number(m[1]);
        const current = steps[step];
        if (code !== current.expect) {
          const detail = line.slice(4).trim();
          let reason = `Mail server said ${code}: ${detail}`;
          if (code === 534 || code === 535) {
            reason = /application-specific|5\.7\.9/i.test(detail)
              ? "Gmail wants an App password. Turn on 2-Step Verification for the sending Gmail account, create an App password, and put those 16 letters in MAIL_PASS."
              : "Gmail rejected the username or password. MAIL_USER must be the exact Gmail address and MAIL_PASS a 16-letter App password, not the normal password.";
          } else if (code === 550 || code === 553) {
            reason = `The mail server did not accept the recipient address (${detail}).`;
          }
          return finish({ sent: false, reason });
        }
        step++;
        if (step >= steps.length) return finish({ sent: true });
        const next = steps[step];
        if (next.send !== undefined) socket.write(next.send + "\r\n");
      }
    };

    const timer = setTimeout(() => finish({ sent: false, reason: "The mail server took too long to answer." }), 15000);
    const onError = () => {
      clearTimeout(timer);
      finish({ sent: false, reason: "Could not reach the mail server." });
    };

    socket = secure ? tls.connect({ host, port, servername: host }, () => {}) : net.connect({ host, port });
    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", () => clearTimeout(timer));
  });
}

// Every email the server tries to send, with the result, so a missing email can be explained: it is either in the list
// with the reason it failed, or it was never tried at all. Shown to the Super Admin under Mobile app > Recent emails.
let logReady: Promise<void> | null = null;
// Some subjects carry a one-time code ("Your code: 123456"). A code must never be kept in a log.
const maskCodes = (subject: string) => subject.replace(/[0-9]{6}/g, "******");
async function logMail(to: string, subject: string, r: Result) {
  const { db } = await import("@/db/store");
  logReady ??= db()
    .prepare("CREATE TABLE IF NOT EXISTS mail_log (id VARCHAR(40) PRIMARY KEY NOT NULL, to_email VARCHAR(190) NOT NULL, subject VARCHAR(200) NOT NULL, sent INT NOT NULL, reason VARCHAR(300), created_at VARCHAR(40) NOT NULL)")
    .run()
    .then(() => undefined);
  await logReady;
  const now = new Date().toISOString();
  await db()
    .prepare("INSERT INTO mail_log (id, to_email, subject, sent, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind("m_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), to.slice(0, 190), maskCodes(subject).slice(0, 200), r.sent ? 1 : 0, r.sent ? null : String(r.reason || "").slice(0, 300), now)
    .run();
  // Keep a month of history.
  if (Math.random() < 0.05) await db().prepare("DELETE FROM mail_log WHERE created_at < ?").bind(new Date(Date.now() - 30 * 86400000).toISOString()).run();
}

export async function sendMail(to: string, subject: string, html: string, text: string, replyTo?: string): Promise<Result> {
  const r = await sendRaw(to, subject, html, text, replyTo);
  try {
    await logMail(to, subject, r);
  } catch {
    // The log is a convenience. It must never stop an email, or turn a sent email into a failure.
  }
  return r;
}
