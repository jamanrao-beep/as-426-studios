import crypto from "node:crypto";

/**
 * Hash a plain password using Node.js built-in scrypt.
 * Output format: scrypt$salt$hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verify a plain password against a stored hash or legacy plaintext string.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return false;

  // Support scrypt hashed format
  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    const [, salt, hash] = parts;

    return new Promise((resolve) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) return resolve(false);
        try {
          const keyBuffer = Buffer.from(hash, "hex");
          resolve(crypto.timingSafeEqual(derivedKey, keyBuffer));
        } catch {
          resolve(false);
        }
      });
    });
  }

  // Fallback for legacy seeded passwords during migration
  return password === storedHash;
}

/**
 * Generate a cryptographically random, human-friendly temporary password.
 * Format: 3 lowercase words or word+number combination
 */
export function generateTemporaryPassword(): string {
  const words = ["amber", "spice", "table", "secret", "chef", "crisp", "flame", "roast", "savor", "bistro", "clove", "basil", "zest", "honey", "olive"];
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word1}-${word2}-${num}`;
}
