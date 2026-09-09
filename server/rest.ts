import type { Express, Request, Response } from "express";
import { appRouter } from "./routers.js";
import { authenticateApiKey, getUserById, markApiKeyUsed, recordC2bConfirmation, updateStkCallback } from "./db.js";
import { hashApiKey } from "./security.js";

async function authenticate(req: Request, res: Response) {
  const raw = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) { res.status(401).json({ error: "Missing API key" }); return null; }
  const result = await authenticateApiKey(hashApiKey(raw));
  if (!result || result.user.isSuspended) { res.status(403).json({ error: "Invalid or unavailable API key" }); return null; }
  await markApiKeyUsed(result.keyId);
  return result.user;
}

export function registerRestRoutes(app: Express) {
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
      const callback = req.body?.Body?.stkCallback;
      if (callback?.CheckoutRequestID) {
        const success = Number(callback.ResultCode) === 0;
        const rawReason = callback.ResultDesc ?? callback.ResultDescription ?? callback.errorMessage;
        const failureReason = success ? null : typeof rawReason === "string" && rawReason.trim() ? rawReason.trim() : "Safaricom declined the STK request without providing a reason.";
        await updateStkCallback({ checkoutRequestId: String(callback.CheckoutRequestID), success, failureReason, receipt: callback.CallbackMetadata?.Item?.find((item: { Name: string }) => item.Name === "MpesaReceiptNumber")?.Value?.toString() });
      }
    } finally { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); }
  });
  app.post("/api/v1/callbacks/b2c/result", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/b2c/timeout", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/c2b/confirmation", async (req, res) => { try { const body = req.body ?? {}; await recordC2bConfirmation({ tillNumber: String(body.BusinessShortCode ?? body.ShortCode ?? ""), transactionId: String(body.TransID ?? ""), amount: Number(body.TransAmount ?? 0), phoneNumber: String(body.MSISDN ?? ""), accountReference: String(body.BillRefNumber ?? body.InvoiceNumber ?? "") }); } finally { res.json({ ResultCode: 0, ResultDesc: "Accepted" }); } });
  app.post("/api/v1/callbacks/c2b/validation", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
}
