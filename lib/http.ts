// Small helpers so every route fails the same safe way: a clean 400 for bad input, a size cap before parsing,
// and a generic message for server faults, with the real error only in the server log.

export async function readJson(req: Request, maxBytes = 200_000): Promise<{ ok: true; data: any } | { ok: false; res: Response }> {
  let text = "";
  try {
    text = await req.text();
  } catch {
    return { ok: false, res: Response.json({ error: "Could not read the request." }, { status: 400 }) };
  }
  if (text.length > maxBytes) return { ok: false, res: Response.json({ error: "That request is too large." }, { status: 413 }) };
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, res: Response.json({ error: "That request could not be understood." }, { status: 400 }) };
  }
}

export function fail(err: unknown, where: string, message: string, status = 503) {
  console.error(`[${where}]`, err);
  return Response.json({ error: message }, { status });
}

// A unique-constraint collision from a race between two identical requests.
export const isDuplicate = (e: unknown) => /unique|duplicate|constraint|ER_DUP/i.test(String((e as any)?.message || e));

const COMMON = new Set(["123456", "1234567", "12345678", "123456789", "password", "password1", "qwerty", "qwerty123", "111111", "000000", "abc123", "iloveyou", "admin123", "letmein", "welcome1", "tablesecret"]);
export function weakPassword(pw: string, email = ""): string | null {
  if (pw.length < 6) return "New password must be at least 6 characters long.";
  if (COMMON.has(pw.toLowerCase())) return "That password is too common. Choose something harder to guess.";
  if (email && pw.toLowerCase() === email.toLowerCase()) return "Your password cannot be your email.";
  if (/^(.)\1+$/.test(pw)) return "Your password cannot be one repeated character.";
  return null;
}
