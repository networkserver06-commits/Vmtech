import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import { isConfiguredAdminEmail } from "./_core/env.js";
import { adjustWallet, calculatePlatformFee, createCollection, createPayout, createReservedPayout, createTill, createWebhook, deleteCollection, deletePayout, deleteTill, deleteWebhook, getAdminOverview, getOverviewData, getStoredMpesaConfig, getSystemSettings, getTill, getWalletBalance, insertApiKey, insertTransaction, insertWalletDeposit, listAdminUsers, listApiKeys, listAuditLogs, listCollections, listPayouts, listTills, listWalletDeposits, listWalletLedger, listWebhooks, revokeApiKey, saveMpesaConfig, setUserSuspended, updateCollection, updatePayout, updateTill, updateUserProfile, writeAuditLog } from "./db.js";
import { createSecurityCredential, encryptSecret, generateApiKey, generatePrefixedReference, getStkCallbackToken, hashApiKey } from "./security.js";
import { encryptedConfigToDaraja, registerC2bUrls, triggerStkPush } from "./mpesa.js";

/** Convert common Kenyan mobile formats to the Daraja-required 254XXXXXXXXX format. */
export function normalizeKenyanPhone(value: string): string {
  const digits = value.trim().replace(/[\s()-]/g, "").replace(/^\+/, "");
  const normalized = digits.startsWith("254")
    ? digits
    : /^(?:07|01)\d{8}$/.test(digits)
      ? `254${digits.slice(1)}`
      : "";

  if (!/^254\d{9}$/.test(normalized)) {
    throw new Error("Use a valid Kenyan phone number: 254XXXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX");
  }
  return normalized;
}

const phoneSchema = z.string().trim().transform(normalizeKenyanPhone);
const amountSchema = z.number().positive().max(1500000);

async function getStoredConfig(userId: number) { return getStoredMpesaConfig(userId) as any; }

function stkCallbackUrl() {
  const url = new URL(process.env.STK_CALLBACK_URL ?? "https://leetec.online/api/v1/callbacks/stk");
  url.searchParams.set("callbackToken", getStkCallbackToken());
  return url.toString();
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isConfiguredAdminEmail(ctx.user.email)) throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  return next();
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    updateProfile: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(80) })).mutation(async ({ ctx, input }) => { await updateUserProfile(ctx.user.id, input.name); return { success: true, name: input.name }; }),
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
      await insertApiKey({ userId: ctx.user.id, name: input.name, keyHash: hashApiKey(rawKey), keyEncrypted: encryptSecret(rawKey) });
      return { key: rawKey, keyPrefix: "sk_live_", revealedOnce: true, recoverable: true };
    }),
    listApiKeys: protectedProcedure.query(({ ctx }) => listApiKeys(ctx.user.id)),
    revokeApiKey: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => revokeApiKey(ctx.user.id, input.id)),
    listTills: protectedProcedure.query(({ ctx }) => listTills(ctx.user.id)),
    createTill: protectedProcedure.input(z.object({ tillNumber: z.string().regex(/^\d{5,8}$/, "Enter a valid M-PESA till or PayBill number"), name: z.string().min(2).max(80), location: z.string().max(120).optional(), paymentType: z.enum(["BUY_GOODS", "PAYBILL"]).default("BUY_GOODS"), businessShortcode: z.string().regex(/^\d{5,8}$/, "Enter a valid shortcode").optional() })).mutation(async ({ ctx, input }) => {
      const liveEnabled = process.env.MPESA_LIVE_ENABLED === "true" || process.env.MPESA_ENVIRONMENT === "PRODUCTION";
      if (liveEnabled && input.tillNumber !== String(process.env.MPESA_PARTY_B ?? "").trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Only the approved production Buy Goods Till can be added while live payments are enabled." });
      return createTill({ userId: ctx.user.id, ...input });
    }),
    updateTill: protectedProcedure.input(z.object({ id: z.number().int().positive(), tillNumber: z.string().regex(/^\d{5,8}$/), name: z.string().min(2).max(80), location: z.string().max(120).optional(), isActive: z.boolean() })).mutation(({ ctx, input }) => updateTill(ctx.user.id, input.id, input)),
    deleteTill: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteTill(ctx.user.id, input.id)),
    saveMpesaConfig: protectedProcedure.input(z.object({ shortcode: z.string().min(4).max(32).default("4208798"), consumerKey: z.string().min(1), consumerSecret: z.string().min(1), passkey: z.string().min(1), b2cInitiatorName: z.string().optional(), b2cInitiatorPassword: z.string().optional(), environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX") })).mutation(async ({ ctx, input }) => {
      await saveMpesaConfig({ userId: ctx.user.id, shortcode: input.shortcode, consumerKeyEncrypted: encryptSecret(input.consumerKey), consumerSecretEncrypted: encryptSecret(input.consumerSecret), passkeyEncrypted: encryptSecret(input.passkey), b2cInitiatorName: input.b2cInitiatorName, b2cInitiatorPasswordEncrypted: input.b2cInitiatorPassword ? encryptSecret(input.b2cInitiatorPassword) : null, environment: input.environment });
      return { success: true, environment: input.environment };
    }),
    stkPush: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, tillId: z.number().int().positive().optional(), accountReference: z.string().regex(/^1/, "Reference must start with 1").max(64).optional(), transactionDesc: z.string().max(100).default("LeeTec collection") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const liveEnabled = process.env.MPESA_LIVE_ENABLED === "true" || process.env.MPESA_ENVIRONMENT === "PRODUCTION";
      const baseConfig = liveEnabled || !stored ? { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: process.env.MPESA_SHORTCODE ?? "4208798", environment: process.env.MPESA_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" as const : "SANDBOX" as const } : encryptedConfigToDaraja(stored);
      const till = input.tillId ? await getTill(ctx.user.id, input.tillId) : undefined;
      if (input.tillId && (!till || !Boolean(till.isActive))) throw new TRPCError({ code: "BAD_REQUEST", message: "Selected till is not active or does not belong to this account" });
      // BusinessShortCode must remain the parent shortcode that owns the live STK credentials.
      // A selected child till is the Buy Goods destination and belongs in PartyB.
      const paymentType = till ? String(till.paymentType ?? "BUY_GOODS") : "BUY_GOODS";
      const approvedPartyB = liveEnabled ? String(process.env.MPESA_PARTY_B ?? "").trim() : "";
      if (liveEnabled && !approvedPartyB) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Production Buy Goods Till is not configured." });
      const partyB = till ? String(till.tillNumber) : approvedPartyB || baseConfig.shortcode;
      if (liveEnabled && partyB !== approvedPartyB) throw new TRPCError({ code: "BAD_REQUEST", message: "This Till is not the approved production Buy Goods Till." });
      const config = { ...baseConfig, shortcode: process.env.MPESA_SHORTCODE ?? baseConfig.shortcode };
      const accountReference = input.accountReference ?? generatePrefixedReference();
      const result = await triggerStkPush(config, { phoneNumber: input.phoneNumber, amount: input.amount, accountReference, transactionDesc: input.transactionDesc, callbackUrl: stkCallbackUrl(), partyB, transactionType: paymentType === "PAYBILL" ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline" });
      const checkoutRequestId = String(result.CheckoutRequestID ?? result.checkoutRequestId ?? "");
      const merchantRequestId = result.MerchantRequestID ?? result.merchantRequestId;
      if (!checkoutRequestId) throw new TRPCError({ code: "BAD_GATEWAY", message: "Daraja accepted no checkout request ID. No transaction was recorded." });
      await insertTransaction({ userId: ctx.user.id, checkoutRequestId, merchantRequestId: merchantRequestId ? String(merchantRequestId) : undefined, tillId: till ? Number(till.id) : null, accountReference, phoneNumber: input.phoneNumber, amount: input.amount, status: "PENDING" });
      return { ...result, accountReference, checkoutRequestId, merchantRequestId: merchantRequestId ? String(merchantRequestId) : null, status: "PENDING" as const, requestRecorded: true, till: till ? { id: Number(till.id), number: String(till.tillNumber), name: String(till.name) } : null, estimatedPlatformFee: calculatePlatformFee(input.amount), estimatedNetAmount: Math.max(0, input.amount - calculatePlatformFee(input.amount)) };
    }),
    depositWallet: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: z.number().positive().max(1500000) })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const liveEnabled = process.env.MPESA_LIVE_ENABLED === "true" || process.env.MPESA_ENVIRONMENT === "PRODUCTION";
      const environmentConfig = { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: process.env.MPESA_SHORTCODE ?? "4208798", environment: process.env.MPESA_ENVIRONMENT === "SANDBOX" ? "SANDBOX" as const : "PRODUCTION" as const };
      if (liveEnabled && (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_PASSKEY || !process.env.MPESA_SHORTCODE || !process.env.MPESA_PARTY_B)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wallet deposits are not configured for live Buy Goods STK. Add MPESA_PARTY_B (actual Buy Goods Till number, not Store number)." });
      const config = liveEnabled ? environmentConfig : stored ? encryptedConfigToDaraja(stored) : environmentConfig;
      const accountReference = `1WALLET${Date.now().toString().slice(-10)}`;
      try {
        const result = await triggerStkPush(config, { phoneNumber: input.phoneNumber, amount: input.amount, accountReference, transactionDesc: "LeeTec wallet deposit", callbackUrl: stkCallbackUrl(), partyB: process.env.MPESA_PARTY_B, transactionType: "CustomerBuyGoodsOnline" });
        const checkoutRequestId = String(result.CheckoutRequestID ?? result.checkoutRequestId ?? "");
        const merchantRequestId = result.MerchantRequestID ?? result.merchantRequestId;
        if (!checkoutRequestId) throw new TRPCError({ code: "BAD_GATEWAY", message: "Daraja accepted no checkout request ID." });
        await insertWalletDeposit({ userId: ctx.user.id, checkoutRequestId, merchantRequestId: merchantRequestId ? String(merchantRequestId) : undefined, phoneNumber: input.phoneNumber, amount: input.amount });
        return { ...result, accountReference, status: "PENDING" };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({ event: "wallet_stk_deposit_failed", userId: ctx.user.id, amount: input.amount, phoneSuffix: input.phoneNumber.slice(-4), shortcode: config.shortcode, environment: config.environment, detail }));
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({ code: "BAD_GATEWAY", message: detail || "Wallet top-up failed." });
      }
    }),
    payout: protectedProcedure.input(z.object({ phoneNumber: phoneSchema, amount: amountSchema, commandId: z.enum(["BusinessPayment", "SalaryPayment"]).default("BusinessPayment") })).mutation(async ({ ctx, input }) => {
      const result = await createReservedPayout({ userId: ctx.user.id, recipientPhone: input.phoneNumber, amount: input.amount, commandId: input.commandId });
      if (!result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Insufficient wallet balance" });
      return { status: "MANUAL_REVIEW", message: "Payout recorded for manual portal processing. No B2C or B2B API call was made.", payoutId: result?.lastInsertRowid ?? null };
    }),
    registerC2b: protectedProcedure.input(z.object({ tillId: z.number().int().positive().optional(), confirmationUrl: z.string().url(), validationUrl: z.string().url(), responseType: z.enum(["Completed", "Cancelled"]).default("Completed") })).mutation(async ({ ctx, input }) => {
      const stored = await getStoredConfig(ctx.user.id);
      const liveEnabled = process.env.MPESA_LIVE_ENABLED === "true" || process.env.MPESA_ENVIRONMENT === "PRODUCTION";
      const baseConfig = liveEnabled || !stored ? { consumerKey: process.env.MPESA_CONSUMER_KEY ?? "sandbox", consumerSecret: process.env.MPESA_CONSUMER_SECRET ?? "sandbox", passkey: process.env.MPESA_PASSKEY ?? "sandbox", shortcode: process.env.MPESA_SHORTCODE ?? "4208798", environment: process.env.MPESA_ENVIRONMENT === "PRODUCTION" ? "PRODUCTION" as const : "SANDBOX" as const } : encryptedConfigToDaraja(stored);
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
    health: adminProcedure.query(() => ({ status: "operational", liveRequestsEnabled: process.env.MPESA_LIVE_ENABLED === "true", environment: process.env.MPESA_ENVIRONMENT ?? (process.env.MPESA_LIVE_ENABLED === "true" ? "PRODUCTION" : "SANDBOX"), configuration: { consumerKey: Boolean(process.env.MPESA_CONSUMER_KEY), consumerSecret: Boolean(process.env.MPESA_CONSUMER_SECRET), passkey: Boolean(process.env.MPESA_PASSKEY), encryptionKey: Boolean(process.env.LEETEC_CREDENTIAL_KEY), stkCallback: Boolean(process.env.STK_CALLBACK_URL), c2bConfirmation: Boolean(process.env.C2B_CONFIRMATION_URL), c2bValidation: Boolean(process.env.C2B_VALIDATION_URL), b2cResult: Boolean(process.env.B2C_RESULT_URL), b2cTimeout: Boolean(process.env.B2C_TIMEOUT_URL) } })),
    overview: adminProcedure.query(() => getAdminOverview()),
    users: adminProcedure.query(() => listAdminUsers()),
    walletLedger: adminProcedure.query(() => listWalletLedger()),
    auditLogs: adminProcedure.query(() => listAuditLogs()),
    settings: adminProcedure.query(() => getSystemSettings()),
    setSuspended: adminProcedure.input(z.object({ userId: z.number().int().positive(), isSuspended: z.boolean() })).mutation(async ({ ctx, input }) => { const result = await setUserSuspended(input.userId, input.isSuspended); await writeAuditLog({ userId: ctx.user.id, action: input.isSuspended ? "SUSPEND_USER" : "RESTORE_USER", details: { targetUserId: input.userId } }); return result; }),
    adjustWallet: adminProcedure.input(z.object({ userId: z.number().int().positive(), amount: amountSchema, type: z.enum(["CREDIT", "DEBIT"]), reason: z.string().min(3).max(250) })).mutation(async ({ ctx, input }) => { const result = await adjustWallet(input); await writeAuditLog({ userId: ctx.user.id, action: "MANUAL_WALLET_ADJUSTMENT", details: input }); return result; }),
  }),
});

export type AppRouter = typeof appRouter;
