import { createCipheriv, createDecipheriv, createHash, createHmac, publicEncrypt, randomBytes, constants } from "node:crypto";

const keyMaterial = process.env.LEETEC_CREDENTIAL_KEY ?? (process.env.NODE_ENV === "production" ? (() => { throw new Error("LEETEC_CREDENTIAL_KEY is required in production"); })() : "development-only-leetec-key");
const encryptionKey = createHash("sha256").update(keyMaterial).digest();

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

export function hashApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function getStkCallbackToken() {
  const secret = process.env.STK_CALLBACK_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("STK_CALLBACK_SECRET must be configured with at least 32 characters");
  return createHmac("sha256", secret).update("leetec-stk-callback-v1").digest("hex");
}

export function getC2bCallbackToken() {
  const secret = process.env.C2B_CALLBACK_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("C2B_CALLBACK_SECRET must be configured with at least 32 characters");
  return createHmac("sha256", secret).update("leetec-c2b-callback-v1").digest("hex");
}

export function safeWebhookUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") throw new Error("Webhook URL must use HTTPS");
  if (url.username || url.password || url.port && !["443", ""].includes(url.port)) throw new Error("Webhook URL must not contain credentials or a non-HTTPS port");
  if (["localhost", "localhost.localdomain", "metadata.google.internal"].includes(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) throw new Error("Webhook URL cannot target a local or internal hostname");
  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[0-1])\.)/.test(hostname) || hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd")) throw new Error("Webhook URL cannot target a private network address");
  return url.toString();
}

export function generateApiKey() {
  return `sk_live_${randomBytes(24).toString("hex")}`;
}

export function generatePrefixedReference() {
  return `1${Date.now().toString().slice(-7)}${randomBytes(2).toString("hex")}`.slice(0, 16);
}

export function signWebhook(payload: string, secret: string) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function createSecurityCredential(initiatorPassword: string, certificate?: string) {
  if (!certificate) throw new Error("A Safaricom production certificate is required for live B2C payouts");
  return publicEncrypt({ key: certificate, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(initiatorPassword)).toString("base64");
}
