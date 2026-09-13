import type { User } from "../drizzle/schema.js";
import { asRows, execute, getTurso, type TursoRow } from "./turso.js";
import { isConfiguredAdminEmail } from "./_core/env.js";
import { decryptSecret, signWebhook } from "./security.js";
import { randomUUID } from "node:crypto";

const now = () => new Date().toISOString();
const userFromRow = (row: TursoRow) => {
  const { passwordHash: _passwordHash, ...safeRow } = row;
  return { ...safeRow, role: isConfiguredAdminEmail(row.email == null ? null : String(row.email)) ? "admin" : row.role, isSuspended: Boolean(row.isSuspended), createdAt: new Date(String(row.createdAt)), updatedAt: new Date(String(row.updatedAt)), lastSignedIn: new Date(String(row.lastSignedIn)) } as unknown as User;
};

export async function getDb() { return getTurso(); }

export async function upsertUser(user: { openId: string; accountId?: string | null; name?: string | null; email?: string | null; loginMethod?: string | null; role?: string; lastSignedIn?: Date }) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getTurso();
  if (!db) return;
  const existing = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE openId = ? LIMIT 1", args: [user.openId] }))[0];
  let accountId = user.accountId ?? (existing?.accountId as string | undefined);
  if (!existing && !accountId) {
    const max = asRows<TursoRow>(await db.execute("SELECT MAX(CAST(accountId AS INTEGER)) AS maxAccountId FROM users"))[0]?.maxAccountId;
    accountId = String(Number(max ?? 0) + 1);
  }
  const signedIn = (user.lastSignedIn ?? new Date()).toISOString();
  await db.execute({ sql: `INSERT INTO users (openId, accountId, name, email, loginMethod, role, lastSignedIn, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(openId) DO UPDATE SET accountId=excluded.accountId, name=excluded.name, email=excluded.email, loginMethod=excluded.loginMethod, role=excluded.role, lastSignedIn=excluded.lastSignedIn, updatedAt=excluded.updatedAt`, args: [user.openId, accountId ?? null, user.name ?? null, user.email ?? null, user.loginMethod ?? null, user.role ?? "user", signedIn, now()] });
  const saved = asRows<TursoRow>(await db.execute({ sql: "SELECT id FROM users WHERE openId = ?", args: [user.openId] }))[0];
  if (saved) await db.execute({ sql: "INSERT OR IGNORE INTO wallets (userId) VALUES (?)", args: [Number(saved.id)] });
}

export async function getUserByOpenId(openId: string) {
  const db = await getTurso(); if (!db) return undefined;
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE openId = ? LIMIT 1", args: [openId] }))[0];
  return row ? userFromRow(row) : undefined;
}

export async function getUserById(id: number) {
  const db = await getTurso(); if (!db) return undefined;
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT * FROM users WHERE id = ? LIMIT 1", args: [id] }))[0];
  return row ? userFromRow(row) : undefined;
}

export async function getOverviewData(userId: number) {
  const db = await getTurso();
  if (!db) return { balance: 0, collections: 0, payouts: 0, successRate: 100, activeKeys: 0, accountId: "1", transactions: [] };
  const [wallet, collections, keys, recentCollections, mpesaConfig] = await Promise.all([
    db.execute({ sql: "SELECT balance FROM wallets WHERE userId = ? LIMIT 1", args: [userId] }),
    db.execute({ sql: "SELECT * FROM transactions WHERE userId = ?", args: [userId] }),
    db.execute({ sql: "SELECT id FROM apiKeys WHERE userId = ? AND isActive = 1", args: [userId] }),
    db.execute({ sql: "SELECT *, 'collection' AS kind FROM transactions WHERE userId = ? ORDER BY datetime(createdAt) DESC LIMIT 10", args: [userId] }),
    db.execute({ sql: "SELECT shortcode, environment FROM mpesaConfigs WHERE userId = ? LIMIT 1", args: [userId] }),
  ]);
  const collectionRows = asRows<TursoRow>(collections);
  const total = collectionRows.length; const successful = collectionRows.filter((row) => row.status === "SUCCESS").length;
  const user = await getUserById(userId);
  const activity = asRows<TursoRow>(recentCollections);
  const config = asRows<TursoRow>(mpesaConfig)[0];
  const envLive = process.env.MPESA_LIVE_ENABLED === "true";
  return { balance: Number(asRows<TursoRow>(wallet)[0]?.balance ?? 0), collections: collectionRows.reduce((sum, row) => sum + Number(row.amount), 0), payouts: 0, successRate: total ? Math.round((successful / total) * 1000) / 10 : 0, activeKeys: keys.rows.length, accountId: user?.accountId ?? "—", environment: config?.environment === "PRODUCTION" || (!config && envLive) ? "PRODUCTION" : config?.environment === "SANDBOX" || !envLive ? "SANDBOX" : "NOT_CONFIGURED", shortcode: config?.shortcode ? String(config.shortcode) : process.env.MPESA_SHORTCODE ?? "4208798", transactions: activity };
}

export async function insertApiKey(input: { userId: number; name: string; keyHash: string }) { return execute({ sql: "INSERT INTO apiKeys (userId, name, keyHash, keyPrefix) VALUES (?, ?, ?, 'sk_live_')", args: [input.userId, input.name, input.keyHash] }); }
export async function listApiKeys(userId: number) { const result = await execute({ sql: "SELECT id, name, keyPrefix, isActive, lastUsedAt, createdAt FROM apiKeys WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function revokeApiKey(userId: number, id: number) { return execute({ sql: "UPDATE apiKeys SET isActive = 0 WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function listTills(userId: number) { const result = await execute({ sql: "SELECT id, tillNumber, name, location, paymentType, businessShortcode, isActive, createdAt FROM tills WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createTill(input: { userId: number; tillNumber: string; name: string; location?: string | null; paymentType: "BUY_GOODS" | "PAYBILL"; businessShortcode?: string | null }) { return execute({ sql: "INSERT INTO tills (userId, tillNumber, name, location, paymentType, businessShortcode) VALUES (?, ?, ?, ?, ?, ?)", args: [input.userId, input.tillNumber, input.name, input.location ?? null, input.paymentType, input.businessShortcode ?? null] }); }
export async function updateTill(userId: number, id: number, input: { tillNumber: string; name: string; location?: string | null; isActive: boolean }) { return execute({ sql: "UPDATE tills SET tillNumber = ?, name = ?, location = ?, isActive = ? WHERE id = ? AND userId = ?", args: [input.tillNumber, input.name, input.location ?? null, input.isActive ? 1 : 0, id, userId] }); }
export async function deleteTill(userId: number, id: number) { return execute({ sql: "DELETE FROM tills WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function getTill(userId: number, id: number) { const result = await execute({ sql: "SELECT id, tillNumber, name, location, paymentType, businessShortcode, isActive FROM tills WHERE id = ? AND userId = ? LIMIT 1", args: [id, userId] }); return result ? asRows<TursoRow>(result)[0] : undefined; }
export async function recordC2bConfirmation(input: { tillNumber: string; transactionId: string; amount: number; phoneNumber: string; accountReference: string }) {
  const till = asRows<TursoRow>(await (await getTurso())?.execute({ sql: "SELECT id, userId FROM tills WHERE tillNumber = ? AND isActive = 1 LIMIT 1", args: [input.tillNumber] }) ?? { rows: [] })[0];
  if (!till) return null;
  const result = await execute({ sql: "INSERT OR IGNORE INTO transactions (userId, tillId, checkoutRequestId, mpesaReceipt, accountReference, phoneNumber, amount, platformFee, netAmount, status) VALUES (?, ?, ?, ?, ?, ?, ?, '0.00', ?, 'SUCCESS')", args: [Number(till.userId), Number(till.id), `C2B_${input.transactionId}`, input.transactionId, input.accountReference || input.transactionId, input.phoneNumber, input.amount.toFixed(2), input.amount.toFixed(2)] });
  if (Number(result?.rowsAffected ?? 0) === 1) await dispatchUserWebhooks(Number(till.userId), "payment.success", { transactionId: `C2B_${input.transactionId}`, accountReference: input.accountReference || input.transactionId, phoneNumber: input.phoneNumber, amount: input.amount, status: "SUCCESS", mpesaReceipt: input.transactionId, tillNumber: input.tillNumber });
  return result;
}
export async function listCollections(userId: number) { const result = await execute({ sql: "SELECT tr.*, ti.tillNumber, ti.name AS tillName FROM transactions tr LEFT JOIN tills ti ON ti.id = tr.tillId WHERE tr.userId = ? ORDER BY datetime(tr.createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createCollection(input: { userId: number; checkoutRequestId: string; accountReference: string; phoneNumber: string; amount: number; status?: string }) { return execute({ sql: "INSERT INTO transactions (userId, checkoutRequestId, accountReference, phoneNumber, amount, status) VALUES (?, ?, ?, ?, ?, ?)", args: [input.userId, input.checkoutRequestId, input.accountReference, input.phoneNumber, input.amount.toFixed(2), input.status ?? "PENDING"] }); }
export async function insertTransaction(input: { userId: number; checkoutRequestId: string; merchantRequestId?: string; accountReference: string; phoneNumber: string; amount: number; tillId?: number | null; status?: string }) { return execute({ sql: "INSERT INTO transactions (userId, checkoutRequestId, merchantRequestId, tillId, accountReference, phoneNumber, amount, status, netAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [input.userId, input.checkoutRequestId, input.merchantRequestId ?? null, input.tillId ?? null, input.accountReference, input.phoneNumber, input.amount.toFixed(2), input.status ?? "PENDING", input.amount.toFixed(2)] }); }
export async function updateCollection(userId: number, id: number, input: { phoneNumber: string; amount: number; accountReference: string }) { return execute({ sql: "UPDATE transactions SET phoneNumber = ?, amount = ?, accountReference = ? WHERE id = ? AND userId = ?", args: [input.phoneNumber, input.amount.toFixed(2), input.accountReference, id, userId] }); }
export async function deleteCollection(userId: number, id: number) { return execute({ sql: "DELETE FROM transactions WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function listPayouts(userId: number) { const result = await execute({ sql: "SELECT * FROM payouts WHERE userId = ? ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createPayout(input: { userId: number; recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment"; status?: string }) { return execute({ sql: "INSERT INTO payouts (userId, recipientPhone, amount, commandId, status) VALUES (?, ?, ?, ?, ?)", args: [input.userId, input.recipientPhone, input.amount.toFixed(2), input.commandId, input.status ?? "PENDING"] }); }
export async function updatePayout(userId: number, id: number, input: { recipientPhone: string; amount: number; commandId: "BusinessPayment" | "SalaryPayment" }) { return execute({ sql: "UPDATE payouts SET recipientPhone = ?, amount = ?, commandId = ? WHERE id = ? AND userId = ?", args: [input.recipientPhone, input.amount.toFixed(2), input.commandId, id, userId] }); }
export async function deletePayout(userId: number, id: number) { return execute({ sql: "DELETE FROM payouts WHERE id = ? AND userId = ?", args: [id, userId] }); }

export async function getWalletBalance(userId: number) { const result = await execute({ sql: "SELECT balance FROM wallets WHERE userId = ? LIMIT 1", args: [userId] }); return Number(result ? asRows<TursoRow>(result)[0]?.balance ?? 0 : 0); }
export async function insertWalletDeposit(input: { userId: number; checkoutRequestId: string; merchantRequestId?: string; phoneNumber: string; amount: number }) { return execute({ sql: "INSERT INTO walletDeposits (userId, checkoutRequestId, merchantRequestId, phoneNumber, amount) VALUES (?, ?, ?, ?, ?)", args: [input.userId, input.checkoutRequestId, input.merchantRequestId ?? null, input.phoneNumber, input.amount.toFixed(2)] }); }
export async function listWalletDeposits(userId: number) { const result = await execute({ sql: "SELECT id, checkoutRequestId, phoneNumber, amount, status, mpesaReceipt, failureReason, createdAt, settledAt FROM walletDeposits WHERE userId = ? ORDER BY datetime(createdAt) DESC LIMIT 20", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createPayoutRecord(input: { userId: number; phoneNumber: string; amount: number; commandId: string; originatorConversationId?: string; conversationId?: string }) { return execute({ sql: "INSERT INTO payouts (userId, recipientPhone, amount, commandId, originatorConversationId, conversationId, status) VALUES (?, ?, ?, ?, ?, ?, 'PENDING')", args: [input.userId, input.phoneNumber, input.amount.toFixed(2), input.commandId, input.originatorConversationId ?? null, input.conversationId ?? null] }); }

export async function listAdminUsers() { const result = await execute("SELECT u.*, COALESCE(w.balance, '0.00') AS balance FROM users u LEFT JOIN wallets w ON w.userId = u.id ORDER BY datetime(u.createdAt) DESC"); return result ? asRows<TursoRow>(result).map((row) => ({ ...userFromRow(row), balance: Number(row.balance ?? 0) })) : []; }
export async function getAdminOverview() {
  const db = await getTurso(); if (!db) return { developers: 0, walletFloat: 0, activeIntegrations: 0, suspendedAccounts: 0, successfulTransactions: 0, totalTransactions: 0, environment: "NOT_CONFIGURED", shortcode: null };
  const [users, wallets, keys, webhooks, configs, transactions] = await Promise.all([
    db.execute("SELECT COUNT(*) AS count, SUM(CASE WHEN isSuspended = 1 THEN 1 ELSE 0 END) AS suspended FROM users"),
    db.execute("SELECT COALESCE(SUM(CAST(balance AS REAL)), 0) AS total FROM wallets"),
    db.execute("SELECT COUNT(*) AS count FROM apiKeys WHERE isActive = 1"),
    db.execute("SELECT COUNT(*) AS count FROM webhookEndpoints WHERE isActive = 1"),
    db.execute("SELECT environment, shortcode FROM mpesaConfigs ORDER BY id DESC LIMIT 1"),
    db.execute("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) AS successful FROM transactions"),
  ]);
  const userRow = asRows<TursoRow>(users)[0] ?? {}; const config = asRows<TursoRow>(configs)[0] ?? {}; const tx = asRows<TursoRow>(transactions)[0] ?? {};
  return { developers: Number(userRow.count ?? 0), walletFloat: Number(asRows<TursoRow>(wallets)[0]?.total ?? 0), activeIntegrations: Number(asRows<TursoRow>(keys)[0]?.count ?? 0) + Number(asRows<TursoRow>(webhooks)[0]?.count ?? 0), suspendedAccounts: Number(userRow.suspended ?? 0), successfulTransactions: Number(tx.successful ?? 0), totalTransactions: Number(tx.total ?? 0), environment: String(config.environment ?? "NOT_CONFIGURED"), shortcode: config.shortcode ? String(config.shortcode) : null };
}
export async function listWalletLedger() { const result = await execute("SELECT wt.*, w.userId FROM walletTransactions wt JOIN wallets w ON w.id = wt.walletId ORDER BY datetime(wt.createdAt) DESC LIMIT 100"); return result ? asRows<TursoRow>(result) : []; }
export async function setUserSuspended(userId: number, isSuspended: boolean) { return execute({ sql: "UPDATE users SET isSuspended = ?, updatedAt = ? WHERE id = ?", args: [isSuspended ? 1 : 0, now(), userId] }); }
export async function adjustWallet(input: { userId: number; amount: number; type: "CREDIT" | "DEBIT"; reason: string }) { const current = await getWalletBalance(input.userId); const next = Math.max(0, current + (input.type === "CREDIT" ? input.amount : -input.amount)); const db = await getTurso(); if (!db) return null; await db.batch([{ sql: "INSERT OR IGNORE INTO wallets (userId, balance) VALUES (?, '0.00')", args: [input.userId] }, { sql: "UPDATE wallets SET balance = ?, updatedAt = ? WHERE userId = ?", args: [next.toFixed(2), now(), input.userId] }, { sql: "INSERT INTO walletTransactions (walletId, amount, type, reference, description) SELECT id, ?, ?, ?, ? FROM wallets WHERE userId = ?", args: [(input.type === "CREDIT" ? input.amount : -input.amount).toFixed(2), input.type === "CREDIT" ? "ADMIN_ADJUSTMENT" : "DEBIT", generateAuditReference(), input.reason, input.userId] }], "write"); return { balance: next }; }
export async function writeAuditLog(input: { userId: number; action: string; details: unknown }) { return execute({ sql: "INSERT INTO auditLogs (userId, action, details) VALUES (?, ?, ?)", args: [input.userId, input.action, JSON.stringify(input.details)] }); }
export async function listAuditLogs() { const result = await execute("SELECT * FROM auditLogs ORDER BY datetime(createdAt) DESC LIMIT 100"); return result ? asRows<TursoRow>(result) : []; }
export async function getSystemSettings() { const result = await execute("SELECT * FROM systemSettings"); return result ? asRows<TursoRow>(result) : [{ settingKey: "PLATFORM_SHORTCODE", value: "4208798", description: "Primary M-PESA Paybill" }, { settingKey: "MAINTENANCE_MODE", value: "false", description: "Block new money movement requests" }]; }
export async function getStoredMpesaConfig(userId: number) { const result = await execute({ sql: "SELECT * FROM mpesaConfigs WHERE userId = ? LIMIT 1", args: [userId] }); return result ? asRows<TursoRow>(result)[0] : undefined; }
export async function saveMpesaConfig(input: { userId: number; shortcode: string; consumerKeyEncrypted: string; consumerSecretEncrypted: string; passkeyEncrypted: string; b2cInitiatorName?: string; b2cInitiatorPasswordEncrypted?: string | null; environment: string }) { return execute({ sql: `INSERT INTO mpesaConfigs (userId, shortcode, consumerKeyEncrypted, consumerSecretEncrypted, passkeyEncrypted, b2cInitiatorName, b2cInitiatorPasswordEncrypted, environment) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET shortcode=excluded.shortcode, consumerKeyEncrypted=excluded.consumerKeyEncrypted, consumerSecretEncrypted=excluded.consumerSecretEncrypted, passkeyEncrypted=excluded.passkeyEncrypted, b2cInitiatorName=excluded.b2cInitiatorName, b2cInitiatorPasswordEncrypted=excluded.b2cInitiatorPasswordEncrypted, environment=excluded.environment`, args: [input.userId, input.shortcode, input.consumerKeyEncrypted, input.consumerSecretEncrypted, input.passkeyEncrypted, input.b2cInitiatorName ?? null, input.b2cInitiatorPasswordEncrypted ?? null, input.environment] }); }
export async function listWebhooks(userId: number) { const result = await execute({ sql: "SELECT id, url, isActive, createdAt FROM webhookEndpoints WHERE userId = ? AND isActive = 1 ORDER BY datetime(createdAt) DESC", args: [userId] }); return result ? asRows<TursoRow>(result) : []; }
export async function createWebhook(input: { userId: number; url: string; secretEncrypted: string }) { return execute({ sql: "INSERT INTO webhookEndpoints (userId, url, secretEncrypted) VALUES (?, ?, ?)", args: [input.userId, input.url, input.secretEncrypted] }); }
export async function deleteWebhook(userId: number, id: number) { return execute({ sql: "DELETE FROM webhookEndpoints WHERE id = ? AND userId = ?", args: [id, userId] }); }
export async function dispatchUserWebhooks(userId: number, event: string, data: Record<string, unknown>) {
  const db = await getTurso(); if (!db) return;
  const endpoints = asRows<TursoRow>(await db.execute({ sql: "SELECT id, url, secretEncrypted FROM webhookEndpoints WHERE userId = ? AND isActive = 1", args: [userId] }));
  for (const endpoint of endpoints) {
    const deliveryId = randomUUID();
    const body = JSON.stringify({ id: deliveryId, event, createdAt: new Date().toISOString(), data });
    let responseStatus = 0; let delivered = false;
    for (let attempt = 0; attempt < 3 && !delivered; attempt += 1) {
      try {
        const response = await fetch(String(endpoint.url), { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "LeeTec-Webhook/1.0", "X-LeeTec-Event": event, "X-LeeTec-Delivery": deliveryId, "X-LeeTec-Signature": signWebhook(body, decryptSecret(String(endpoint.secretEncrypted))) }, body, signal: AbortSignal.timeout(8000) });
        responseStatus = response.status; delivered = response.ok;
      } catch { responseStatus = 0; }
      if (!delivered && attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
    await db.execute({ sql: "INSERT INTO webhookLogs (webhookEndpointId, statusCode, payload, status) VALUES (?, ?, ?, ?)", args: [Number(endpoint.id), responseStatus, body, delivered ? "DELIVERED" : "FAILED"] });
  }
}
export async function authenticateApiKey(keyHash: string) { const result = await execute({ sql: "SELECT a.*, u.* FROM apiKeys a JOIN users u ON u.id = a.userId WHERE a.keyHash = ? AND a.isActive = 1 LIMIT 1", args: [keyHash] }); const row = result ? asRows<TursoRow>(result)[0] : undefined; return row ? { keyId: Number(row.id), user: userFromRow(row) } : null; }
export async function markApiKeyUsed(keyId: number) { return execute({ sql: "UPDATE apiKeys SET lastUsedAt = ? WHERE id = ?", args: [now(), keyId] }); }
export function calculatePlatformFee(amount: number) { return amount <= 50 ? 1 : Math.round(amount * 0.015 * 100) / 100; }
export async function updateStkCallback(input: { checkoutRequestId: string; success: boolean; failureReason?: string | null; receipt?: string | null; paidAmount?: number | null; paidPhoneNumber?: string | null }) {
  const db = await getTurso(); if (!db) return null;
  const deposit = asRows<TursoRow>(await db.execute({ sql: "SELECT id, userId, amount, phoneNumber, status FROM walletDeposits WHERE checkoutRequestId = ? LIMIT 1", args: [input.checkoutRequestId] }))[0];
  if (deposit) {
    if (input.success && (!input.receipt || input.paidAmount == null || Math.abs(Number(deposit.amount) - input.paidAmount) > 0.001 || (input.paidPhoneNumber && String(deposit.phoneNumber) !== input.paidPhoneNumber))) {
      return db.execute({ sql: "UPDATE walletDeposits SET status = 'FAILED', failureReason = ? WHERE checkoutRequestId = ? AND status = 'PENDING'", args: ["Safaricom callback payment details did not match the pending deposit", input.checkoutRequestId] });
    }
    const result = await db.execute({ sql: "UPDATE walletDeposits SET status = ?, failureReason = ?, mpesaReceipt = ?, settledAt = ? WHERE checkoutRequestId = ? AND status = 'PENDING'", args: [input.success ? "SUCCESS" : "FAILED", input.failureReason ?? null, input.receipt ?? null, input.success ? now() : null, input.checkoutRequestId] });
    if (Number(result.rowsAffected ?? 0) === 1) await dispatchUserWebhooks(Number(deposit.userId), `wallet.deposit.${input.success ? "success" : "failed"}`, { depositId: Number(deposit.id), checkoutRequestId: input.checkoutRequestId, phoneNumber: String(deposit.phoneNumber), amount: Number(deposit.amount), status: input.success ? "SUCCESS" : "FAILED", failureReason: input.failureReason ?? null, mpesaReceipt: input.receipt ?? null });
    if (!input.success || Number(result.rowsAffected ?? 0) !== 1) return result;
    const amount = Number(deposit.amount ?? 0); const reference = `WALLET_DEPOSIT_${String(deposit.id)}`;
    await db.batch([{ sql: "INSERT OR IGNORE INTO wallets (userId, balance) VALUES (?, '0.00')", args: [Number(deposit.userId)] }, { sql: "UPDATE wallets SET balance = CAST(balance AS REAL) + ?, updatedAt = ? WHERE userId = ?", args: [amount.toFixed(2), now(), Number(deposit.userId)] }, { sql: "INSERT OR IGNORE INTO walletTransactions (walletId, amount, type, reference, description) SELECT id, ?, 'DEPOSIT', ?, ? FROM wallets WHERE userId = ?", args: [amount.toFixed(2), reference, `Wallet deposit via STK Push ${input.checkoutRequestId}`, Number(deposit.userId)] }], "write");
    return result;
  }
  if (input.success && !input.receipt) return db.execute({ sql: "UPDATE transactions SET status = 'FAILED', failureReason = ? WHERE checkoutRequestId = ? AND status = 'PENDING'", args: ["Safaricom callback did not include a payment receipt", input.checkoutRequestId] });
  const transaction = asRows<TursoRow>(await db.execute({ sql: "SELECT amount, phoneNumber FROM transactions WHERE checkoutRequestId = ? LIMIT 1", args: [input.checkoutRequestId] }))[0];
  if (input.success && transaction && (input.paidAmount == null || Math.abs(Number(transaction.amount) - input.paidAmount) > 0.001 || (input.paidPhoneNumber && String(transaction.phoneNumber) !== input.paidPhoneNumber))) return db.execute({ sql: "UPDATE transactions SET status = 'FAILED', failureReason = ? WHERE checkoutRequestId = ? AND status = 'PENDING'", args: ["Safaricom callback payment details did not match the pending transaction", input.checkoutRequestId] });
  const result = await db.execute({ sql: "UPDATE transactions SET status = ?, failureReason = ?, mpesaReceipt = ? WHERE checkoutRequestId = ? AND status != 'SUCCESS'", args: [input.success ? "SUCCESS" : "FAILED", input.failureReason ?? null, input.receipt ?? null, input.checkoutRequestId] });
  const row = asRows<TursoRow>(await db.execute({ sql: "SELECT id, userId, amount, accountReference, phoneNumber, status, failureReason, mpesaReceipt, createdAt FROM transactions WHERE checkoutRequestId = ? LIMIT 1", args: [input.checkoutRequestId] }))[0];
  if (row && Number(result.rowsAffected ?? 0) === 1) await dispatchUserWebhooks(Number(row.userId), `payment.${String(row.status).toLowerCase()}`, { transactionId: Number(row.id), checkoutRequestId: input.checkoutRequestId, accountReference: String(row.accountReference), phoneNumber: String(row.phoneNumber), amount: Number(row.amount), status: String(row.status), failureReason: row.failureReason == null ? null : String(row.failureReason), mpesaReceipt: row.mpesaReceipt == null ? null : String(row.mpesaReceipt), createdAt: String(row.createdAt) });
  if (!input.success || Number(result.rowsAffected ?? 0) !== 1) return result;
  if (!row) return result;
  const amount = Number(row.amount ?? 0); const fee = calculatePlatformFee(amount); const net = Math.max(0, amount - fee); const reference = `STK_FEE_${String(row.id)}`;
  await db.batch([{ sql: "UPDATE transactions SET platformFee = ?, netAmount = ?, feeChargedAt = ? WHERE id = ? AND feeChargedAt IS NULL", args: [fee.toFixed(2), net.toFixed(2), now(), Number(row.id)] }, { sql: "INSERT OR IGNORE INTO wallets (userId, balance) VALUES (?, '0.00')", args: [Number(row.userId)] }, { sql: "UPDATE wallets SET balance = CAST(balance AS REAL) - ?, updatedAt = ? WHERE userId = ?", args: [fee.toFixed(2), now(), Number(row.userId)] }, { sql: "INSERT OR IGNORE INTO walletTransactions (walletId, amount, type, reference, description) SELECT id, ?, 'PLATFORM_FEE', ?, ? FROM wallets WHERE userId = ?", args: [(-fee).toFixed(2), reference, `Platform fee for STK Push ${input.checkoutRequestId}`, Number(row.userId)] }], "write");
  return result;
}
function generateAuditReference() { return `1AUD${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(0, 64); }
