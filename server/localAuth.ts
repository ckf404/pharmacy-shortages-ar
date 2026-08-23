import { parse as parseCookie } from "cookie";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ENV } from "./_core/env";
import { getLocalUserById } from "./db";
import type { User } from "../drizzle/schema";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

function secretKey() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [algorithm, salt, expected] = storedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(expected, "hex"));
}

export async function createLocalSession(user: User) {
  return new SignJWT({ kind: "local", username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + ONE_YEAR_MS) / 1000))
    .sign(secretKey());
}

export async function getLocalSessionUser(cookieHeader?: string) {
  const token = parseCookie(cookieHeader ?? "")[COOKIE_NAME];
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(verified.payload.sub);
    if (verified.payload.kind !== "local" || !Number.isInteger(userId) || userId <= 0) return null;
    const user = await getLocalUserById(userId);
    return user?.active ? user : null;
  } catch {
    return null;
  }
}
