import type { Express, Request, Response } from "express";
import { appRouter } from "./routers.js";
import { authenticateApiKey, getUserById, listCollections, markApiKeyUsed, recordC2bConfirmation, updateStkCallback } from "./db.js";
import { hashApiKey } from "./security.js";
import { getStkCallbackToken } from "./security.js";

async function authenticate(req: Request, res: Response) {
  const raw = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) { res.status(401).json({ error: "Missing API key" }); return null; }
  const result = await authenticateApiKey(hashApiKey(raw));
  if (!result || result.user.isSuspended) { res.status(403).json({ error: "Invalid or unavailable API key" }); return null; }
  await markApiKeyUsed(result.keyId);
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
  app.get("/api/v1/transactions", async (req, res) => {
    try { const user = await authenticate(req, res); if (!user) return; res.json({ data: await listCollections(user.id) }); }
    catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load transaction history" }); }
  });
  app.post("/api/v1/stkpush", async (req, res) => {
    try { const user = await authenticate(req, res); if (!user) return; const caller = appRouter.createCaller({ user, req: req as never, res: res as never }); res.json(await caller.engine.stkPush({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), tillId: req.body.tillId ? Number(req.body.tillId) : undefined, accountReference: req.body.accountReference, transactionDesc: req.body.transactionDesc })); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "STK Push failed" }); }
  });
  app.post("/api/v1/payout", async (req, res) => {
    try { const user = await authenticate(req, res); if (!user) return; const caller = appRouter.createCaller({ user, req: req as never, res: res as never }); res.json(await caller.engine.payout({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), commandId: req.body.commandId ?? "BusinessPayment" })); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Payout failed" }); }
  });
  app.post("/api/v1/callbacks/stk", async (req, res) => {
    try {
      if (req.query.callbackToken !== getStkCallbackToken()) return res.status(401).json({ ResultCode: 1, ResultDesc: "Unauthorized callback" });
      const callback = req.body?.Body?.stkCallback;
      if (callback?.CheckoutRequestID) {
        const success = Number(callback.ResultCode) === 0;
        const rawReason = callback.ResultDesc ?? callback.ResultDescription ?? callback.errorMessage;
        const metadataItems = Array.isArray(callback.CallbackMetadata?.Item) ? callback.CallbackMetadata.Item as Array<{ Name?: unknown; Value?: unknown }> : [];
        const metadata = (name: string) => metadataItems.find((item) => item.Name === name)?.Value;
        const receipt = metadata("MpesaReceiptNumber");
        const paidAmount = Number(metadata("Amount"));
        const paidPhoneNumber = metadata("PhoneNumber");
        const callbackSummary = `Safaricom callback ResultCode=${String(callback.ResultCode)}${callback.ResultDesc ? ` ResultDesc=${String(callback.ResultDesc)}` : ""}`;
        const failureReason = success ? null : rawReason ? explainStkResult(callback.ResultCode, rawReason) : `${callbackSummary}; raw callback=${JSON.stringify(callback)}`;
        await updateStkCallback({ checkoutRequestId: String(callback.CheckoutRequestID), success, failureReason, receipt: typeof receipt === "string" || typeof receipt === "number" ? String(receipt) : null, paidAmount: Number.isFinite(paidAmount) ? paidAmount : null, paidPhoneNumber: paidPhoneNumber == null ? null : String(paidPhoneNumber) });
      }
    } finally { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); }
  });
  app.post("/api/v1/callbacks/b2c/result", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/b2c/timeout", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/c2b/confirmation", async (req, res) => { try { const body = req.body ?? {}; await recordC2bConfirmation({ tillNumber: String(body.BusinessShortCode ?? body.ShortCode ?? ""), transactionId: String(body.TransID ?? ""), amount: Number(body.TransAmount ?? 0), phoneNumber: String(body.MSISDN ?? ""), accountReference: String(body.BillRefNumber ?? body.InvoiceNumber ?? "") }); } finally { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); } });
  app.post("/api/v1/callbacks/c2b/validation", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
}
