import type { Express, Request, Response } from "express";
import { appRouter } from "./routers.js";
import { authenticateApiKey, getUserByPaymentSlug, listTransactionHistory, markApiKeyUsed, recordC2bConfirmation, updateStkCallback } from "./db.js";
import { hashApiKey } from "./security.js";
import { getStkCallbackToken } from "./security.js";

async function authenticate(req: Request, res: Response) {
  const raw = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) { res.status(401).json({ error: "Missing API key" }); return null; }
  const result = await authenticateApiKey(hashApiKey(raw));
  if (!result || result.user.isSuspended) { res.status(403).json({ error: "Invalid or unavailable API key" }); return null; }
  void markApiKeyUsed(result.keyId).catch((error) => console.error("API key usage update failed", error));
  return result.user;
}

export function explainStkResult(resultCode: unknown, resultDescription: unknown) {
  const code = Number(resultCode);
  const description = typeof resultDescription === "string" ? resultDescription.trim() : "";
  if (code === 0) return null;
  const known: Record<number, string> = {
    1: "The M-PESA account has insufficient funds for this transaction.",
    1032: "The M-PESA request was cancelled on the phone.",
    1037: "The M-PESA prompt timed out. Unlock the phone and retry when the prompt appears.",
    2001: "The M-PESA PIN was incorrect or the request was rejected by the M-PESA account.",
  };
  return known[code] ? `Safaricom error ${code}: ${known[code]}` : description || `Safaricom returned error code ${String(resultCode)}.`;
}

export function registerRestRoutes(app: Express) {
  const sendTransactionHistory = async (req: Request, res: Response) => {
    try { const user = await authenticate(req, res); if (!user) return; const data = await listTransactionHistory(user.id); const completeData = data.map((row) => ({ ...row, resourceType: String(row.kind), requestId: row.checkoutRequestId ?? row.conversationId ?? row.id, final: ["SUCCESS", "FAILED", "CANCELLED", "MANUAL_REVIEW"].includes(String(row.status).toUpperCase()) })); res.setHeader("Cache-Control", "no-store"); res.json({ data: completeData, count: completeData.length, meta: { resource: "transactions", complete: true, ordering: "createdAt_desc", includes: ["collections", "payouts", "wallet_deposits"], endpoints: ["/api/v1/transactions", "/api/v1/stkpush/history", "/api/v1/collections"] } }); }
    catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load transaction history" }); }
  };
  app.get("/api/v1/transactions", sendTransactionHistory);
  app.get("/api/v1/stkpush/history", sendTransactionHistory);
  app.get("/api/v1/collections", sendTransactionHistory);
  app.post("/api/v1/payment-links/stkpush", async (req, res) => {
    try {
      const slug = String(req.query.slug ?? "").trim().toLowerCase();
      if (!slug) return res.status(400).json({ error: "A username payment link is required" });
      const user = await getUserByPaymentSlug(slug);
      if (!user || user.isSuspended) return res.status(404).json({ error: "Payment link is unavailable" });
      const caller = appRouter.createCaller({ user, req: req as never, res: res as never });
      const accountReference = typeof req.body.accountReference === "string" && req.body.accountReference.trim() ? req.body.accountReference.trim() : `1LINK${Date.now().toString().slice(-10)}`;
      res.setHeader("Cache-Control", "no-store");
      res.json(await caller.engine.stkPush({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), tillId: req.body.tillId ? Number(req.body.tillId) : undefined, accountReference, transactionDesc: "LeeTec payment link" }));
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Payment request failed", status: "ERROR", final: true, webhookRequired: false }); }
  });
  app.post("/api/v1/stkpush", async (req, res) => {
    try { const user = await authenticate(req, res); if (!user) return; const caller = appRouter.createCaller({ user, req: req as never, res: res as never }); const accountReference = typeof req.body.accountReference === "string" && req.body.accountReference.trim() ? req.body.accountReference.trim() : `1API${user.accountId ?? user.id}${Date.now().toString().slice(-8)}`; res.setHeader("Cache-Control", "no-store"); res.json(await caller.engine.stkPush({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), tillId: req.body.tillId ? Number(req.body.tillId) : undefined, accountReference, transactionDesc: req.body.transactionDesc })); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "STK Push failed", status: "ERROR", final: true, webhookRequired: false, message: "The STK request was not accepted and no payment record was created. Correct the error and retry." }); }
  });
  app.post("/api/v1/callbacks/stk", async (req, res) => {
    if (req.query.callbackToken !== getStkCallbackToken()) return res.status(401).json({ ResultCode: 1, ResultDesc: "Unauthorized callback" });
    const callback = req.body?.Body?.stkCallback;
    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    if (!callback?.CheckoutRequestID) return;
    void (async () => {
      const success = Number(callback.ResultCode) === 0;
      const rawReason = callback.ResultDesc ?? callback.ResultDescription ?? callback.errorMessage;
      const metadataItems = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item as Array<{ Name?: unknown; Value?: unknown }> : [];
      const metadata = (name: string) => metadataItems.find((item) => item.Name === name)?.Value;
      const receipt = metadata("MpesaReceiptNumber");
      const paidAmount = Number(metadata("Amount"));
      const paidPhoneNumber = metadata("PhoneNumber");
      const callbackSummary = `Safaricom callback ResultCode=${String(callback.ResultCode)}${callback.ResultDesc ? ` ResultDesc=${String(callback.ResultDesc)}` : ""}`;
      const failureReason = success ? null : rawReason ? explainStkResult(callback.ResultCode, rawReason) : `${callbackSummary}; raw callback=${JSON.stringify(callback)}`;
      const callbackStatus = success ? "SUCCESS" : Number(callback.ResultCode) === 1032 ? "CANCELLED" : "FAILED";
      await updateStkCallback({ checkoutRequestId: String(callback.CheckoutRequestID), success, status: callbackStatus, failureReason, receipt: typeof receipt === "string" || typeof receipt === "number" ? String(receipt) : null, paidAmount: Number.isFinite(paidAmount) ? paidAmount : null, paidPhoneNumber: paidPhoneNumber == null ? null : String(paidPhoneNumber) });
    })().catch((error) => console.error("STK callback processing failed", error));
  });
  app.post("/api/v1/callbacks/c2b/confirmation", async (req, res) => { const body = req.body ?? {}; res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" }); void recordC2bConfirmation({ tillNumber: String(body.BusinessShortCode ?? body.ShortCode ?? ""), transactionId: String(body.TransID ?? ""), amount: Number(body.TransAmount ?? 0), phoneNumber: String(body.MSISDN ?? ""), accountReference: String(body.BillRefNumber ?? body.InvoiceNumber ?? "") }).catch((error) => console.error("C2B confirmation processing failed", error)); });
  app.post("/api/v1/callbacks/c2b/validation", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
}
