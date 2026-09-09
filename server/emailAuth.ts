import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, jwtVerify } from "jose";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { getTurso, asRows, type TursoRow } from "./turso.js";
import { upsertUser, getUserById } from "./db.js";
import type { Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";

const scrypt = promisify(scryptCallback);
const sessionKey = () => new TextEncoder().encode(process.env.JWT_SECRET || "change-this-session-secret");
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

async function sendVerificationEmail(email: string, token: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Email verification is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.");
  const appUrl = process.env.APP_URL || "https://www.leetec.online";
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [email], subject: "Verify your LeeTec Engine email", html: `<p>Welcome to LeeTec Engine.</p><p><a href="${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}">Verify your email address</a></p><p>This link expires in 30 minutes.</p>` }) });
  if (!response.ok) throw new Error("Unable to send verification email");
}

export async function registerWithEmail(input: { email: string; password: string; name: string }) {
  const db = await getTurso(); if (!db) throw new Error("Turso is not configured");
  const email = input.email.trim().toLowerCase();
  const existing = asRows<TursoRow>(await db.execute({ sql: "SELECT id FROM users WHERE lower(email) = ? LIMIT 1", args: [email] }))[0];
  if (existing) throw new Error("An account with this email already exists");
  const passwordHash = await hashPassword(input.password);
  const count = Number(asRows<TursoRow>(await db.execute("SELECT COUNT(*) AS count FROM users"))[0]?.count ?? 0);
  const openId = `email_${hashToken(email).slice(0, 40)}`;
  await upsertUser({ openId, email, name: input.name.trim(), loginMethod: "email", role: count === 0 ? "admin" : "user" });
  const user = await db.execute({ sql: "SELECT id FROM users WHERE openId = ? LIMIT 1", args: [openId] });
  const userId = Number(asRows<TursoRow>(user)[0]?.id);
  await db.execute({ sql: "UPDATE users SET passwordHash = ?, emailVerified = 0 WHERE id = ?", args: [passwordHash, userId] });
  const rawToken = randomBytes(32).toString("base64url");
  await db.execute({ sql: "INSERT INTO emailVerificationTokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)", args: [userId, hashToken(rawToken), new Date(Date.now() + 30 * 60 * 1000).toISOString()] });
  await sendVerificationEmail(email, rawToken);
  return { email, requiresVerification: true };
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
  if (!Boolean(row.emailVerified)) throw new Error("Please verify your email before signing in");
  if (Boolean(row.isSuspended)) throw new Error("This account is suspended");
  await db.execute({ sql: "UPDATE users SET lastSignedIn = ?, updatedAt = ? WHERE id = ?", args: [new Date().toISOString(), new Date().toISOString(), Number(row.id)] });
  return createSession(Number(row.id));
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
