import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { getTurso, asRows, type TursoRow } from "./turso.js";
import { upsertUser, getUserById } from "./db.js";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { isConfiguredAdminEmail } from "./_core/env.js";
import { sendVerificationEmail } from "./email.js";

const scrypt = promisify(scryptCallback);
const sessionKey = () => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("JWT_SECRET must be configured with at least 32 characters");
  return new TextEncoder().encode(secret);
};
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export async function registerWithEmail(input: { email: string; password: string; name: string }) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const email = input.email.trim().toLowerCase();
  const existing = asRows<TursoRow>(await db.execute({ sql: "SELECT id FROM users WHERE lower(email) = ? LIMIT 1", args: [email] }))[0];
  if (existing) throw new Error("An account with this email already exists");
  const passwordHash = await hashPassword(input.password);
  const openId = `email_${hashToken(email).slice(0, 40)}`;
  await upsertUser({ openId, email, name: input.name.trim(), loginMethod: "email", role: isConfiguredAdminEmail(email) ? "admin" : "user" });
  const user = await db.execute({ sql: "SELECT id FROM users WHERE openId = ? LIMIT 1", args: [openId] });
  const userId = Number(asRows<TursoRow>(user)[0]?.id);
  await db.execute({ sql: "UPDATE users SET passwordHash = ?, emailVerified = 0 WHERE id = ?", args: [passwordHash, userId] });
  const rawToken = randomBytes(32).toString("base64url");
  await db.execute({ sql: "INSERT INTO emailVerificationTokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)", args: [userId, hashToken(rawToken), new Date(Date.now() + 30 * 60 * 1000).toISOString()] });
  // Verification remains available, but it must not block account access.
  // Email delivery is best-effort so a missing email provider does not make
  // registration fail after the user has already been created.
  let verificationSent = false;
  try { await sendVerificationEmail(email, rawToken); verificationSent = true; } catch { /* account creation remains successful; the user can retry from the login screen */ }
  return { email, requiresVerification: true, verificationSent, verificationAvailable: true };
}

export async function resendVerificationEmail(emailInput: string) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const email = emailInput.trim().toLowerCase();
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT id, emailVerified FROM users WHERE lower(email) = ? LIMIT 1", args: [email] }))[0];
  if (!row) throw new Error("No account was found for this email");
  if (Boolean(row.emailVerified)) throw new Error("This email is already verified. You can sign in.");
  const rawToken = randomBytes(32).toString("base64url");
  await db.execute({ sql: "INSERT INTO emailVerificationTokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)", args: [Number(row.id), hashToken(rawToken), new Date(Date.now() + 30 * 60 * 1000).toISOString()] });
  await sendVerificationEmail(email, rawToken);
  return { sent: true };
}

export async function verifyEmail(token: string) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM emailVerificationTokens WHERE tokenHash = ? AND usedAt IS NULL AND expiresAt > ? LIMIT 1", args: [hashToken(token), new Date().toISOString()] }))[0];
  if (!row) throw new Error("Verification link is invalid or expired");
  await db.batch([{ sql: "UPDATE emailVerificationTokens SET usedAt = ? WHERE id = ?", args: [new Date().toISOString(), Number(row.id)] }, { sql: "UPDATE users SET emailVerified = 1, updatedAt = ? WHERE id = ?", args: [new Date().toISOString(), Number(row.userId)] }], "write");
  return { verified: true };
}

export async function loginWithEmail(email: string, password: string) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE lower(email) = ? LIMIT 1", args: [email.trim().toLowerCase()] }))[0];
  if (!row || !row.passwordHash || !(await verifyPassword(password, String(row.passwordHash)))) throw new Error("Invalid email or password");
  if (Boolean(row.isSuspended)) throw new Error("This account is suspended");
  await db.execute({ sql: "UPDATE users SET lastSignedIn = ?, updatedAt = ? WHERE id = ?", args: [new Date().toISOString(), new Date().toISOString(), Number(row.id)] });
  return createSession(Number(row.id));
}

export async function changePassword(userId: number, currentPassword: string, newPassword: string) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT passwordHash FROM users WHERE id = ? LIMIT 1", args: [userId] }))[0];
  if (!row?.passwordHash || !(await verifyPassword(currentPassword, String(row.passwordHash)))) throw new Error("Current password is incorrect");
  await db.execute({ sql: "UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?", args: [await hashPassword(newPassword), new Date().toISOString(), userId] });
  return { success: true };
}

export async function createSession(userId: number) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("1y").sign(sessionKey());
}

export async function authenticateEmailRequest(req: Request) {
  const bearer = typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME] || bearer;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] }); return typeof payload.userId === "number" ? getUserById(payload.userId) : null; } catch { return null; }
}

export function setSessionCookie(req: Request, res: Response, token: string) { res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS }); }
export function clearSessionCookie(req: Request, res: Response) { res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 }); }
