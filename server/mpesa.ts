type DarajaConfig = { consumerKey: string; consumerSecret: string; passkey: string; shortcode: string; environment?: "SANDBOX" | "PRODUCTION"; initiatorName?: string; initiatorPassword?: string };
type StoredMpesaConfig = { consumerKeyEncrypted: string; consumerSecretEncrypted: string; passkeyEncrypted: string; shortcode: string; environment?: string; b2cInitiatorName?: string | null; b2cInitiatorPasswordEncrypted?: string | null };

import { decryptSecret, createSecurityCredential } from "./security.js";

function getBaseUrl(config: DarajaConfig) {
  return config.environment === "PRODUCTION"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function darajaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export async function getDarajaToken(config: DarajaConfig) {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${getBaseUrl(config)}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } });
  const rawBody = await response.text();
  let body: { access_token?: string; error_description?: string; errorMessage?: string } = {};
  try { body = JSON.parse(rawBody) as typeof body; } catch { /* handled below */ }
  if (!response.ok) throw new Error(`Daraja OAuth failed (${response.status}): ${body.error_description ?? body.errorMessage ?? (rawBody || "Check live consumer key and secret")}`);
  if (!body.access_token) throw new Error("Daraja OAuth returned no access token");
  return body.access_token;
}

export function explainDarajaStkError(status: number, body: Record<string, unknown>) {
  const detail = String(body.errorMessage ?? body.ResponseDescription ?? body.error_description ?? body.ResponseCode ?? "").trim();
  const code = String(body.errorCode ?? body.ErrorCode ?? body.ResponseCode ?? "").trim();
  const requestId = String(body.requestId ?? body.RequestId ?? body.requestID ?? "").trim();
  const diagnostic = [code && `error code ${code}`, requestId && `request ID ${requestId}`].filter(Boolean).join(", ");
  if (/not found|resource|endpoint|product|service/i.test(detail) || status === 404) return "Live STK Push is not enabled for this Daraja app. Enable the Lipa na M-PESA Online / STK Push product for the app, then use its live shortcode and passkey.";
  if (/invalid access token|unauthorized|authentication/i.test(detail) || status === 401) return "Daraja rejected the live access token. Verify the live consumer key and consumer secret belong to the same production app.";
  if (/shortcode|business.*short|party b/i.test(detail)) return "Daraja rejected the shortcode. Use the live PayBill shortcode approved for Lipa na M-PESA Online, not a till number or sandbox shortcode.";
  if (/passkey|password|credential/i.test(detail)) return "Daraja rejected the STK password. Use the live Lipa na M-PESA Online passkey for this exact shortcode.";
  if (detail) return `Daraja rejected the live STK request (HTTP ${status})${diagnostic ? `, ${diagnostic}` : ""}: ${detail}`;
  const raw = JSON.stringify(body);
  return `Daraja rejected the live STK request (HTTP ${status})${diagnostic ? `, ${diagnostic}` : ""}. Response: ${raw === "{}" ? "empty response" : raw}`;
}

export async function triggerStkPush(config: DarajaConfig, input: { phoneNumber: string; amount: number; accountReference: string; transactionDesc: string; callbackUrl: string; partyB?: string }) {
  const live = config.environment === "PRODUCTION" || (config.environment === undefined && process.env.MPESA_LIVE_ENABLED === "true");
  if (live && (!config.consumerKey || !config.consumerSecret || !config.passkey || config.consumerKey === "sandbox" || config.consumerSecret === "sandbox" || config.passkey === "sandbox")) throw new Error("Live Daraja credentials are missing or invalid");
  if (!live) return { sandbox: true, CheckoutRequestID: `ws_CO_${Date.now()}`, MerchantRequestID: "sandbox-merchant", ResponseDescription: "Sandbox mode — request accepted" };
  const token = await getDarajaToken(config);
  const timestamp = darajaTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const response = await fetch(`${getBaseUrl(config)}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: config.shortcode, Password: password, Timestamp: timestamp, TransactionType: "CustomerBuyGoodsOnline", Amount: Math.round(input.amount), PartyA: input.phoneNumber, PartyB: input.partyB ?? config.shortcode, PhoneNumber: input.phoneNumber, CallBackURL: input.callbackUrl, AccountReference: input.accountReference, TransactionDesc: input.transactionDesc }) });
  const rawBody = await response.text();
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { body = { raw: rawBody }; }
  if (!response.ok || body.ResponseCode !== "0") {
    throw new Error(`Daraja STK Push failed: ${explainDarajaStkError(response.status, body)}`);
  }
  return body;
}

export async function triggerB2cPayout(config: DarajaConfig, input: { phoneNumber: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment"; queueTimeoutUrl: string; resultUrl: string }) {
  if (process.env.MPESA_LIVE_ENABLED !== "true") return { sandbox: true, OriginatorConversationID: `sandbox-${Date.now()}`, ConversationID: `sandbox-${Date.now()}`, ResponseDescription: "Sandbox mode — payout queued" };
  if (!config.initiatorName || !config.initiatorPassword) throw new Error("B2C initiator credentials are required");
  const token = await getDarajaToken(config);
  const securityCredential = createSecurityCredential(config.initiatorPassword);
  const response = await fetch(`${getBaseUrl(config)}/mpesa/b2c/v1/paymentrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ InitiatorName: config.initiatorName, SecurityCredential: securityCredential, CommandID: input.commandId, Amount: Math.round(input.amount), PartyA: config.shortcode, PartyB: input.phoneNumber, Remarks: "LeeTec Engine payout", QueueTimeOutURL: input.queueTimeoutUrl, ResultURL: input.resultUrl, Occasion: "" }) });
  const body = await response.json();
  if (!response.ok || body.ResponseCode !== "0") throw new Error(body.errorMessage || body.ResponseDescription || "Daraja B2C request failed");
  return body;
}

export async function registerC2bUrls(config: DarajaConfig, input: { confirmationUrl: string; validationUrl: string; responseType?: "Completed" | "Cancelled" }) {
  if (process.env.MPESA_LIVE_ENABLED !== "true") return { sandbox: true, ResponseDescription: "Sandbox mode — C2B URLs accepted" };
  const token = await getDarajaToken(config);
  const response = await fetch(`${getBaseUrl(config)}/mpesa/c2b/v1/registerurl`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ShortCode: config.shortcode, ResponseType: input.responseType ?? "Completed", ConfirmationURL: input.confirmationUrl, ValidationURL: input.validationUrl }) });
  const body = await response.json();
  if (!response.ok || body.ResponseCode !== "0") throw new Error(body.errorMessage || body.ResponseDescription || "Daraja C2B registration failed");
  return body;
}

export function encryptedConfigToDaraja(config: StoredMpesaConfig): DarajaConfig {
  return { consumerKey: decryptSecret(config.consumerKeyEncrypted), consumerSecret: decryptSecret(config.consumerSecretEncrypted), passkey: decryptSecret(config.passkeyEncrypted), shortcode: config.shortcode, environment: config.environment === "PRODUCTION" ? "PRODUCTION" : "SANDBOX", initiatorName: config.b2cInitiatorName ?? undefined, initiatorPassword: config.b2cInitiatorPasswordEncrypted ? decryptSecret(config.b2cInitiatorPasswordEncrypted) : undefined };
}
