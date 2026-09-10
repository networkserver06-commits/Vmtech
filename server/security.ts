import { createCipheriv, createDecipheriv, createHash, createHmac, publicEncrypt, randomBytes, constants } from "node:crypto";

const keyMaterial = process.env.LEETEC_CREDENTIAL_KEY || "leetec-build-key-change-before-production";
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
  return createHmac("sha256", process.env.JWT_SECRET || "change-this-session-secret").update("leetec-stk-callback-v1").digest("hex");
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
