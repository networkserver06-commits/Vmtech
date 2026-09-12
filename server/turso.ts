import { createClient, type Client, type InStatement } from "@libsql/client/web";

let client: Client | null = null;
let initialized: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, openId TEXT NOT NULL UNIQUE, accountId TEXT UNIQUE, name TEXT, email TEXT, loginMethod TEXT, role TEXT NOT NULL DEFAULT 'user', isSuspended INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, lastSignedIn TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, balance TEXT NOT NULL DEFAULT '0.00', currency TEXT NOT NULL DEFAULT 'KES', updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS walletTransactions (id INTEGER PRIMARY KEY AUTOINCREMENT, walletId INTEGER NOT NULL, amount TEXT NOT NULL, type TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, description TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS walletDeposits (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, checkoutRequestId TEXT NOT NULL UNIQUE, merchantRequestId TEXT, phoneNumber TEXT NOT NULL, amount TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', mpesaReceipt TEXT, failureReason TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, settledAt TEXT)`,
  `CREATE TABLE IF NOT EXISTS mpesaConfigs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, shortcode TEXT NOT NULL DEFAULT '4208798', passkeyEncrypted TEXT NOT NULL, consumerKeyEncrypted TEXT NOT NULL, consumerSecretEncrypted TEXT NOT NULL, b2cInitiatorName TEXT, b2cInitiatorPasswordEncrypted TEXT, environment TEXT NOT NULL DEFAULT 'SANDBOX', createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS tills (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, tillNumber TEXT NOT NULL, name TEXT NOT NULL, location TEXT, paymentType TEXT NOT NULL DEFAULT 'BUY_GOODS', businessShortcode TEXT, isActive INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(userId, tillNumber))`,
  `CREATE TABLE IF NOT EXISTS apiKeys (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, name TEXT NOT NULL, keyPrefix TEXT NOT NULL DEFAULT 'sk_live_', keyHash TEXT NOT NULL UNIQUE, isActive INTEGER NOT NULL DEFAULT 1, lastUsedAt TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, checkoutRequestId TEXT NOT NULL UNIQUE, merchantRequestId TEXT, mpesaReceipt TEXT, accountReference TEXT NOT NULL, phoneNumber TEXT NOT NULL, amount TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', failureReason TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, recipientPhone TEXT NOT NULL, amount TEXT NOT NULL, commandId TEXT NOT NULL DEFAULT 'BusinessPayment', originatorConversationId TEXT UNIQUE, conversationId TEXT, mpesaReceipt TEXT, status TEXT NOT NULL DEFAULT 'PENDING', failureReason TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS webhookEndpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, url TEXT NOT NULL, secretEncrypted TEXT NOT NULL, isActive INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS webhookLogs (id INTEGER PRIMARY KEY AUTOINCREMENT, webhookEndpointId INTEGER NOT NULL, statusCode INTEGER NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS systemSettings (id INTEGER PRIMARY KEY AUTOINCREMENT, settingKey TEXT NOT NULL UNIQUE, value TEXT NOT NULL, description TEXT, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS auditLogs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, action TEXT NOT NULL, details TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS emailVerificationTokens (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, tokenHash TEXT NOT NULL UNIQUE, expiresAt TEXT NOT NULL, usedAt TEXT, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS users_account_idx ON users(accountId)`,
  `CREATE INDEX IF NOT EXISTS transactions_user_idx ON transactions(userId)`,
  `CREATE INDEX IF NOT EXISTS wallet_deposits_user_idx ON walletDeposits(userId)`,
  `CREATE INDEX IF NOT EXISTS payouts_user_idx ON payouts(userId)`,
  `CREATE INDEX IF NOT EXISTS api_keys_user_idx ON apiKeys(userId)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON auditLogs(userId)`,
  `CREATE INDEX IF NOT EXISTS tills_user_idx ON tills(userId)`,
];

export async function getTurso() {
  if (!client && process.env.TURSO_DATABASE_URL) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    initialized = client.batch(schemaStatements.map((sql) => ({ sql })), "write").then(async () => {
      const userColumns = await client!.execute("PRAGMA table_info(users)");
      const userNames = new Set(userColumns.rows.map((row) => String((row as unknown as { name: string }).name)));
      const userAdditions = [["passwordHash", "TEXT"], ["emailVerified", "INTEGER NOT NULL DEFAULT 0"]] as const;
      for (const [name, type] of userAdditions) if (!userNames.has(name)) await client!.execute(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
      const transactionColumns = await client!.execute("PRAGMA table_info(transactions)");
      const transactionNames = new Set(transactionColumns.rows.map((row) => String((row as unknown as { name: string }).name)));
      const transactionAdditions = [["tillId", "INTEGER"], ["platformFee", "TEXT NOT NULL DEFAULT '0.00'"], ["netAmount", "TEXT"], ["feeChargedAt", "TEXT"]] as const;
      for (const [name, type] of transactionAdditions) if (!transactionNames.has(name)) await client!.execute(`ALTER TABLE transactions ADD COLUMN ${name} ${type}`);
      const tillColumns = await client!.execute("PRAGMA table_info(tills)");
      const tillNames = new Set(tillColumns.rows.map((row) => String((row as unknown as { name: string }).name)));
      const tillAdditions = [["paymentType", "TEXT NOT NULL DEFAULT 'BUY_GOODS'"], ["businessShortcode", "TEXT"]] as const;
      for (const [name, type] of tillAdditions) if (!tillNames.has(name)) await client!.execute(`ALTER TABLE tills ADD COLUMN ${name} ${type}`);
      await client!.execute("CREATE INDEX IF NOT EXISTS transactions_till_idx ON transactions(tillId)");
      await client!.execute("CREATE INDEX IF NOT EXISTS transactions_fee_idx ON transactions(feeChargedAt)");
    });
  }
  if (initialized) await initialized;
  return client;
}

export async function execute(statement: InStatement) {
  const db = await getTurso();
  if (!db) return null;
  return db.execute(statement);
}

export type TursoRow = Record<string, unknown>;
export const asRows = <T extends TursoRow>(result: { rows: unknown[] }) => result.rows as T[];
