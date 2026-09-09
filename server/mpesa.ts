type DarajaConfig = { consumerKey: string; consumerSecret: string; passkey: string; shortcode: string; environment?: "SANDBOX" | "PRODUCTION"; initiatorName?: string; initiatorPassword?: string };
type StoredMpesaConfig = { consumerKeyEncrypted: string; consumerSecretEncrypted: string; passkeyEncrypted: string; shortcode: string; environment?: string; b2cInitiatorName?: string | null; b2cInitiatorPasswordEncrypted?: string | null };

import { decryptSecret, createSecurityCredential } from "./security";

function getBaseUrl(config: DarajaConfig) {
  return config.environment === "PRODUCTION" && process.env.MPESA_ENVIRONMENT === "PRODUCTION"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export async function getDarajaToken(config: DarajaConfig) {
  const basic = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString("base64");
  const response = await fetch(`${getBaseUrl(config)}/oauth/v1/generate?grant_type=client_credentials`, { headers: { Authorization: `Basic ${basic}` } });
  if (!response.ok) throw new Error(`Daraja OAuth failed (${response.status})`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error("Daraja OAuth returned no access token");
  return body.access_token;
}

export async function triggerStkPush(config: DarajaConfig, input: { phoneNumber: string; amount: number; accountReference: string; transactionDesc: string; callbackUrl: string }) {
  if (process.env.MPESA_LIVE_ENABLED !== "true") return { sandbox: true, CheckoutRequestID: `ws_CO_${Date.now()}`, MerchantRequestID: "sandbox-merchant", ResponseDescription: "Sandbox mode — request accepted" };
  const token = await getDarajaToken(config);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString("base64");
  const response = await fetch(`${getBaseUrl(config)}/mpesa/stkpush/v1/processrequest`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ BusinessShortCode: config.shortcode, Password: password, Timestamp: timestamp, TransactionType: "CustomerPayBillOnline", Amount: Math.round(input.amount), PartyA: input.phoneNumber, PartyB: config.shortcode, PhoneNumber: input.phoneNumber, CallBackURL: input.callbackUrl, AccountReference: input.accountReference, TransactionDesc: input.transactionDesc }) });
  const body = await response.json();
  if (!response.ok || body.ResponseCode !== "0") throw new Error(body.errorMessage || body.ResponseDescription || "Daraja STK Push failed");
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
