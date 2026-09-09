import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, getOverviewData, insertApiKey, insertTransaction } from "./db";
import { mpesaConfigs, payouts, wallets } from "../drizzle/schema";
import { createSecurityCredential, encryptSecret, generateApiKey, generatePrefixedReference, hashApiKey } from "./security";
import { encryptedConfigToDaraja, triggerB2cPayout, triggerStkPush } from "./mpesa";
import { eq } from "drizzle-orm";

const phoneSchema = z.string().regex(/^254\d{9}$/, "Use a Kenyan phone number in 254XXXXXXXXX format");
const amountSchema = z.number().positive().max(1500000);

async function getStoredConfig(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(mpesaConfigs).where(eq(mpesaConfigs.userId, userId)).limit(1);
  return rows[0] ?? null;
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  engine: router({
    overview: protectedProcedure.query(({ ctx }) => getOverviewData(ctx.user.id)),
    createApiKey: protectedProcedure.input(z.object({ name: z.string().min(2).max(100) })).mutation(async ({ ctx, input }) => {
      const rawKey = generateApiKey();
      await insertApiKey({ userId: ctx.user.id, name: input.name, keyHash: hashApiKey(rawKey) });
      return { key: rawKey, keyPrefix: "sk_live_", revealedOnce: true };
    }),
    saveMpesaConfig: protectedProcedure.input(z.object({ shortcode: z.string().min(4).max(32).default("4208798"), consumerKey: z.string().min(1), consumerSecret: z.string().min(1), passkey: z.string().min(1), b2cInitiatorName: z.string().optional(), b2cInitiatorPassword: z.string().optional(), environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Database is not configured" });
      await db.insert(mpesaConfigs).values({ userId: ctx.user.id, shortcode: input.shortcode, consumerKeyEncrypted: encryptSecret(input.consumerKey), consumerSecretEncrypted: encryptSecret(input.consumerSecret), passkeyEncrypted: encryptSecret(input.passkey), b2cInitiatorName: input.b2cInitiatorName, b2cInitiatorPasswordEncrypted: input.b2cInitiatorPassword ? encryptSecret(input.b2cInitiatorPassword) : null, environment: input.environment }).onDuplicateKeyUpdate({ set: { shortcode: input.shortcode, consumerKeyEncrypted: encryptSecret(input.consumerKey), consumerSecretEncrypted: encryptSecret(input.consumerSecret), passkeyEncrypted: encryptSecret(input.passkey), b2cInitiatorName: input.b2cInitiatorName, b2cInitiatorPasswordEncrypted: input.b2cInitiatorPassword ? encryptSecret(input.b2cInitiatorPassword) : null, environment: input.environment } });
      return { success: true, environment: input.environment };
    }),
    stkPush: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, accountReference: z.string().regex(/^1/, "Reference must start with 1").max(64).optional(), transactionDesc: z.string().max(100).default("LeeTec collection") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const config = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const accountReference = input.accountReference ?? generatePrefixedReference();
      const result = await triggerStkPush(config, { phoneNumber: input.phoneNumber, amount: input.amount, accountReference, transactionDesc: input.transactionDesc, callbackUrl: process.env.STK_CALLBACK_URL ?? "https://leetec.online/api/v1/callbacks/stk" });
      await insertTransaction({ userId: ctx.user.id, checkoutRequestId: result.CheckoutRequestID ?? result.checkoutRequestId, merchantRequestId: result.MerchantRequestID ?? result.merchantRequestId, accountReference, phoneNumber: input.phoneNumber, amount: input.amount, status: "PENDING" });
      return { ...result, accountReference };
    }),
    payout: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, commandId: z.enum(["BusinessPayment", "SalaryPayment"]).default("BusinessPayment") })).mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const wallet = db ? (await db.select().from(wallets).where(eq(wallets.userId, ctx.user.id)).limit(1))[0] : null;
      const available = Number(wallet?.balance ?? 128450);
      if (available < input.amount) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient wallet balance" });
      const stored = await getStoredConfig(ctx.user.id);
      const config = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const result = await triggerB2cPayout(config, { phoneNumber: input.phoneNumber, amount: input.amount, commandId: input.commandId, queueTimeoutUrl: process.env.B2C_TIMEOUT_URL ?? "https://leetec.online/api/v1/callbacks/b2c/timeout", resultUrl: process.env.B2C_RESULT_URL ?? "https://leetec.online/api/v1/callbacks/b2c/result" });
      if (db) await db.insert(payouts).values({ userId: ctx.user.id, recipientPhone: input.phoneNumber, amount: input.amount.toFixed(2), commandId: input.commandId, originatorConversationId: result.OriginatorConversationID ?? result.originatorConversationId, conversationId: result.ConversationID ?? result.conversationId, status: "PENDING" });
      return result;
    }),
  }),
  admin: router({
    health: adminProcedure.query(() => ({ status: "operational", shortcode: "4208798", liveRequestsEnabled: process.env.MPESA_LIVE_ENABLED === "true" })),
  }),
});

export type AppRouter = typeof appRouter;
