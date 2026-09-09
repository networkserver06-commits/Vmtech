import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { adjustWallet, calculatePlatformFee, createCollection, createPayout, createPayoutRecord, createTill, createWebhook, deleteCollection, deletePayout, deleteTill, deleteWebhook, getOverviewData, getStoredMpesaConfig, getSystemSettings, getTill, getWalletBalance, insertApiKey, insertTransaction, insertWalletDeposit, listAdminUsers, listApiKeys, listAuditLogs, listCollections, listPayouts, listTills, listWalletDeposits, listWebhooks, revokeApiKey, saveMpesaConfig, setUserSuspended, updateCollection, updatePayout, updateTill, writeAuditLog } from "./db.js";
import { createSecurityCredential, encryptSecret, generateApiKey, generatePrefixedReference, hashApiKey } from "./security.js";
import { encryptedConfigToDaraja, registerC2bUrls, triggerB2cPayout, triggerStkPush } from "./mpesa.js";

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
    walletBalance: protectedProcedure.query(({ ctx }) => getWalletBalance(ctx.user.id)),
    listWalletDeposits: protectedProcedure.query(({ ctx }) => listWalletDeposits(ctx.user.id)),
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
    listApiKeys: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    revokeApiKey: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => revokeApiKey(ctx.user.id, input.id)),
    listTills: protectedProcedure.query(({ ctx }) => listTills(ctx.user.id)),
    createTill: protectedProcedure.input(z.object({ tillNumber: z.string().regex(/^\d{5,8}$/, "Enter a valid M-PESA till number"), name: z.string().min(2).max(80), location: z.string().max(120).optional() })).mutation(({ ctx, input }) => createTill({ userId: ctx.user.id, ...input })),
    updateTill: protectedProcedure.input(z.object({ id: z.number().int().positive(), tillNumber: z.string().regex(/^\d{5,8}$/), name: z.string().min(2).max(80), location: z.string().max(120).optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => updateTill(ctx.user.id, input.id, input)),
    deleteTill: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteTill(ctx.user.id, input.id)),
    saveMpesaConfig: protectedProcedure.input(z.object({ shortcode: z.string().min(4).max(32).default("4208798"), consumerKey: z.string().min(1), consumerSecret: z.string().min(1), passkey: z.string().min(1), b2cInitiatorName: z.string().optional(), b2cInitiatorPassword: z.string().optional(), environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX") })).mutation(async ({ ctx, input }) => {
      await saveMpesaConfig({ userId: ctx.user.id, shortcode: input.shortcode, consumerKeyEncrypted: encryptSecret(input.consumerKey), consumerSecretEncrypted: encryptSecret(input.consumerSecret), passkeyEncrypted: encryptSecret(input.passkey), b2cInitiatorName: input.b2cInitiatorName, b2cInitiatorPasswordEncrypted: input.b2cInitiatorPassword ? encryptSecret(input.b2cInitiatorPassword) : null, environment: input.environment });
      return { success: true, environment: input.environment };
    }),
    stkPush: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, tillId: z.number().int().positive().optional(), accountReference: z.string().regex(/^1/, "Reference must start with 1").max(64).optional(), transactionDesc: z.string().max(100).default("LeeTec collection") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const baseConfig = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const till = input.tillId ? await getTill(ctx.user.id, input.tillId) : undefined;
      if (input.tillId && (!till || !Boolean(till.isActive))) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected till is not active or does not belong to this account" });
      const config = till ? { ...baseConfig, shortcode: String(till.tillNumber) } : baseConfig;
      const accountReference = input.accountReference ?? generatePrefixedReference();
      const result = await triggerStkPush(config, { phoneNumber: input.phoneNumber, amount: input.amount, accountReference, transactionDesc: input.transactionDesc, callbackUrl: process.env.STK_CALLBACK_URL ?? "https://leetec.online/api/v1/callbacks/stk" });
      await insertTransaction({ userId: ctx.user.id, checkoutRequestId: result.CheckoutRequestID ?? result.checkoutRequestId, merchantRequestId: result.MerchantRequestID ?? result.merchantRequestId, tillId: till ? Number(till.id) : null, accountReference, phoneNumber: input.phoneNumber, amount: input.amount, status: "PENDING" });
      return { ...result, accountReference, till: till ? { id: Number(till.id), number: String(till.tillNumber), name: String(till.name) } : null, estimatedPlatformFee: calculatePlatformFee(input.amount), estimatedNetAmount: Math.max(0, input.amount - calculatePlatformFee(input.amount)) };
    }),
    depositWallet: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: z.number().positive().max(1500000) })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const config = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const accountReference = `1WALLET${Date.now().toString().slice(-10)}`;
      const result = await triggerStkPush(config, { phoneNumber: input.phoneNumber, amount: input.amount, accountReference, transactionDesc: "LeeTec wallet deposit", callbackUrl: process.env.STK_CALLBACK_URL ?? "https://leetec.online/api/v1/callbacks/stk" });
      await insertWalletDeposit({ userId: ctx.user.id, checkoutRequestId: result.CheckoutRequestID ?? result.checkoutRequestId, merchantRequestId: result.MerchantRequestID ?? result.merchantRequestId, phoneNumber: input.phoneNumber, amount: input.amount });
      return { ...result, accountReference, status: "PENDING" };
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
    registerC2b: protectedProcedure.input(z.object({ tillId: z.number().int().positive().optional(), confirmationUrl: z.string().url(), validationUrl: z.string().url(), responseType: z.enum(["Completed", "Cancelled"]).default("Completed") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const baseConfig = stored ? encryptedConfigToDaraja(stored) : { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: "4208798", environment: "SANDBOX" as const };
      const till = input.tillId ? await getTill(ctx.user.id, input.tillId) : undefined;
      if (input.tillId && (!till || !Boolean(till.isActive))) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected till is not active or does not belong to this account" });
      const config = till ? { ...baseConfig, shortcode: String(till.tillNumber) } : baseConfig;
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
