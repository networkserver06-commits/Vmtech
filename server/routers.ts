import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { adjustWallet, createCollection, createPayout, createPayoutRecord, createWebhook, deleteCollection, deletePayout, deleteWebhook, getOverviewData, getStoredMpesaConfig, getSystemSettings, getWalletBalance, insertApiKey, insertTransaction, listAdminUsers, listAuditLogs, listCollections, listPayouts, listWebhooks, saveMpesaConfig, setUserSuspended, updateCollection, updatePayout, writeAuditLog } from "./db";
import { createSecurityCredential, encryptSecret, generateApiKey, generatePrefixedReference, hashApiKey } from "./security";
import { encryptedConfigToDaraja, registerC2bUrls, triggerB2cPayout, triggerStkPush } from "./mpesa";

const phoneSchema = z.string().regex(/^254\d{9}$/, "Use a Kenyan phone number in 254XXXXXXXXX format");
const amountSchema = z.number().positive().max(1500000);

async function getStoredConfig(userId: number) { return getStoredMpesaConfig(userId) as any; }

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role.toUpperCase() !== "ADMIN") throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
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
    listCollections: protectedProcedure.query(({ ctx }) => listCollections(ctx.user.id)),
    createCollection: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, accountReference: z.string().regex(/^1/, "Reference must start with 1").max(64) })).mutation(({ ctx, input }) => createCollection({ userId: ctx.user.id, checkoutRequestId: `manual_${Date.now()}`, accountReference: input.accountReference, phoneNumber: input.phoneNumber, amount: input.amount })),
    updateCollection: protectedProcedure.input(z.object({ id: z.number().int().positive(), phoneNumber: phoneSchema, amount: amountSchema, accountReference: z.string().regex(/^1/).max(64) })).mutation(({ ctx, input }) => updateCollection(ctx.user.id, input.id, input)),
    deleteCollection: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteCollection(ctx.user.id, input.id)),
    listPayouts: protectedProcedure.query(({ ctx }) => listPayouts(ctx.user.id)),
    createPayout: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, commandId: z.enum(["BusinessPayment", "SalaryPayment"]).default("BusinessPayment") })).mutation(({ ctx, input }) => createPayout({ userId: ctx.user.id, recipientPhone: input.phoneNumber, amount: input.amount, commandId: input.commandId })),
    updatePayout: protectedProcedure.input(z.object({ id: z.number().int().positive(), phoneNumber: phoneSchema, amount: amountSchema, commandId: z.enum(["BusinessPayment", "SalaryPayment"]) })).mutation(({ ctx, input }) => updatePayout(ctx.user.id, input.id, { recipientPhone: input.phoneNumber, amount: input.amount, commandId: input.commandId })),
    deletePayout: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deletePayout(ctx.user.id, input.id)),
    createApiKey: protectedProcedure.input(z.object({ name: z.string().min(2).max(100) })).mutation(async ({ ctx, input }) => {
      const rawKey = generateApiKey();
      await insertApiKey({ userId: ctx.user.id, name: input.name, keyHash: hashApiKey(rawKey) });
      return { key: rawKey, keyPrefix: "sk_live_", revealedOnce: true };
    }),
    saveMpesaConfig: protectedProcedure.input(z.object({ shortcode: z.string().min(4).max(32).default("4208798"), consumerKey: z.string().min(1), consumerSecret: z.string().min(1), passkey: z.string().min(1), b2cInitiatorName: z.string().optional(), b2cInitiatorPassword: z.string().optional(), environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX") })).mutation(async ({ ctx, input }) => {
      await saveMpesaConfig({ userId: ctx.user.id, shortcode: input.shortcode, consumerKeyEncrypted: encryptSecret(input.consumerKey), consumerSecretEncrypted: encryptSecret(input.consumerSecret), passkeyEncrypted: encryptSecret(input.passkey), b2cInitiatorName: input.b2cInitiatorName, b2cInitiatorPasswordEncrypted: input.b2cInitiatorPassword ? encryptSecret(input.b2cInitiatorPassword) : null, environment: input.environment });
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
      const available = await getWalletBalance(ctx.user.id);
      if (available < input.amount) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient wallet balance" });
      const stored = await getStoredConfig(ctx.user.id);
      const config = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const result = await triggerB2cPayout(config, { phoneNumber: input.phoneNumber, amount: input.amount, commandId: input.commandId, queueTimeoutUrl: process.env.B2C_TIMEOUT_URL ?? "https://leetec.online/api/v1/callbacks/b2c/timeout", resultUrl: process.env.B2C_RESULT_URL ?? "https://leetec.online/api/v1/callbacks/b2c/result" });
      await createPayoutRecord({ userId: ctx.user.id, phoneNumber: input.phoneNumber, amount: input.amount, commandId: input.commandId, originatorConversationId: result.OriginatorConversationID ?? result.originatorConversationId, conversationId: result.ConversationID ?? result.conversationId });
      return result;
    }),
    registerC2b: protectedProcedure.input(z.object({ confirmationUrl: z.string().url(), validationUrl: z.string().url(), responseType: z.enum(["Completed", "Cancelled"]).default("Completed") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const config = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      return registerC2bUrls(config, input);
    }),
    listWebhooks: protectedProcedure.query(({ ctx }) => listWebhooks(ctx.user.id)),
    createWebhook: protectedProcedure.input(z.object({ url: z.string().url(), secret: z.string().min(16).max(200) })).mutation(({ ctx, input }) => createWebhook({ userId: ctx.user.id, url: input.url, secretEncrypted: encryptSecret(input.secret) })),
    deleteWebhook: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteWebhook(ctx.user.id, input.id)),
  }),
  admin: router({
    health: adminProcedure.query(() => ({ status: "operational", shortcode: "4208798", liveRequestsEnabled: process.env.MPESA_LIVE_ENABLED === "true" })),
    users: adminProcedure.query(() => listAdminUsers()),
    auditLogs: adminProcedure.query(() => listAuditLogs()),
    settings: adminProcedure.query(() => getSystemSettings()),
    setSuspended: adminProcedure.input(z.object({ userId: z.number().int().positive(), isSuspended: z.boolean() })).mutation(async ({ ctx, input }) => { const result = await setUserSuspended(input.userId, input.isSuspended); await writeAuditLog({ userId: ctx.user.id, action: input.isSuspended ? "SUSPEND_USER" : "RESTORE_USER", details: { targetUserId: input.userId } }); return result; }),
    adjustWallet: adminProcedure.input(z.object({ userId: z.number().int().positive(), amount: amountSchema, type: z.enum(["CREDIT", "DEBIT"]), reason: z.string().min(3).max(250) })).mutation(async ({ ctx, input }) => { const result = await adjustWallet(input); await writeAuditLog({ userId: ctx.user.id, action: "MANUAL_WALLET_ADJUSTMENT", details: input }); return result; }),
  }),
});

export type AppRouter = typeof appRouter;
