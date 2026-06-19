import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, hashHex] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = (await scryptAsync(password, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashIp(ip: string, secret: string): string {
  return createHash("sha256").update(`${secret}:${ip}`).digest("hex");
}

export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  if (phone.length < 7) return "****";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function redactSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
