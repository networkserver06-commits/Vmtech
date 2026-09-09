import type { Express, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { apiKeys, transactions, users } from "../drizzle/schema";
import { getDb, getUserById } from "./db";
import { appRouter } from "./routers";
import { hashApiKey } from "./security";

async function authenticate(req: Request, res: Response) {
  const raw = req.header("x-api-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!raw) { res.status(401).json({ error: "Missing API key" }); return null; }
  const db = await getDb();
  if (!db) { res.status(503).json({ error: "Database unavailable" }); return null; }
  const key = (await db.select().from(apiKeys).where(and(eq(apiKeys.keyHash, hashApiKey(raw)), eq(apiKeys.isActive, true))).limit(1))[0];
  if (!key) { res.status(401).json({ error: "Invalid API key" }); return null; }
  const user = await getUserById(key.userId);
  if (!user || user.isSuspended) { res.status(403).json({ error: "Account is unavailable" }); return null; }
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));
  return user;
}

export function registerRestRoutes(app: Express) {
  app.post("/api/v1/stkpush", async (req, res) => {
    try {
      const user = await authenticate(req, res); if (!user) return;
      const caller = appRouter.createCaller({ user, req: req as never, res: res as never });
      const result = await caller.engine.stkPush({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), accountReference: req.body.accountReference, transactionDesc: req.body.transactionDesc });
      res.json(result);
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "STK Push failed" }); }
  });

  app.post("/api/v1/payout", async (req, res) => {
    try {
      const user = await authenticate(req, res); if (!user) return;
      const caller = appRouter.createCaller({ user, req: req as never, res: res as never });
      const result = await caller.engine.payout({ phoneNumber: req.body.phoneNumber, amount: Number(req.body.amount), commandId: req.body.commandId ?? "BusinessPayment" });
      res.json(result);
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Payout failed" }); }
  });

  app.post("/api/v1/callbacks/stk", async (req, res) => {
    try {
      const db = await getDb();
      const callback = req.body?.Body?.stkCallback;
      if (db && callback?.CheckoutRequestID) await db.update(transactions).set({ status: callback.ResultCode === 0 ? "SUCCESS" : "FAILED", failureReason: callback.ResultCode === 0 ? null : callback.ResultDesc, mpesaReceipt: callback.CallbackMetadata?.Item?.find((item: { Name: string }) => item.Name === "MpesaReceiptNumber")?.Value?.toString() }).where(eq(transactions.checkoutRequestId, callback.CheckoutRequestID));
      res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch { res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" }); }
  });

  app.post("/api/v1/callbacks/b2c/result", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/b2c/timeout", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/c2b/confirmation", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
  app.post("/api/v1/callbacks/c2b/validation", async (_req, res) => res.json({ ResultCode: 0, ResultDesc: "Accepted" }));
}
