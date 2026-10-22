import crypto from "node:crypto";

// Proof that someone really owns an email address. They ask for a code, read it from their inbox and type it in; the
// server then hands back this short-lived signed token. Forms that take an email address (restaurant sign-up, a new
// manager, a restaurant set up by hand) send the token along, and the server checks it before using the address.
const SECRET = () => process.env.SESSION_SECRET || "";
const LIFETIME_MS = 30 * 60 * 1000;

const sign = (payload: string) => crypto.createHmac("sha256", SECRET() + ":email-proof").update(payload).digest("base64url");

export function makeEmailProof(email: string) {
  if (!SECRET()) throw new Error("SESSION_SECRET is not configured on the server.");
  const payload = Buffer.from(JSON.stringify({ e: email.trim().toLowerCase(), x: Date.now() + LIFETIME_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function checkEmailProof(email: string, proof: unknown): boolean {
  if (typeof proof !== "string" || !SECRET()) return false;
  const [payload, sig] = proof.split(".");
  if (!payload || !sig) return false;
  const good = Buffer.from(sign(payload));
  const got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return false;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: string; x?: number };
    return d.e === email.trim().toLowerCase() && typeof d.x === "number" && d.x > Date.now();
  } catch {
    return false;
  }
}

export const EMAIL_PROOF_MESSAGE = "Please verify the email address first. We email a 6-digit code to it.";
