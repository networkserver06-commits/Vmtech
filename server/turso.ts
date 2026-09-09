import { createClient, type Client, type InStatement } from "@libsql/client/web";

let client: Client | null = null;
let initialized: Promise<void> | null = null;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, openId TEXT NOT NULL UNIQUE, accountId TEXT UNIQUE, name TEXT, email TEXT, loginMethod TEXT, role TEXT NOT NULL DEFAULT 'user', isSuspended INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, lastSignedIn TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, balance TEXT NOT NULL DEFAULT '0.00', currency TEXT NOT NULL DEFAULT 'KES', updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS walletTransactions (id INTEGER PRIMARY KEY AUTOINCREMENT, walletId INTEGER NOT NULL, amount TEXT NOT NULL, type TEXT NOT NULL, reference TEXT NOT NULL UNIQUE, description TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS mpesaConfigs (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL UNIQUE, shortcode TEXT NOT NULL DEFAULT '4208798', passkeyEncrypted TEXT NOT NULL, consumerKeyEncrypted TEXT NOT NULL, consumerSecretEncrypted TEXT NOT NULL, b2cInitiatorName TEXT, b2cInitiatorPasswordEncrypted TEXT, environment TEXT NOT NULL DEFAULT 'SANDBOX', createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
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
  `CREATE INDEX IF NOT EXISTS payouts_user_idx ON payouts(userId)`,
  `CREATE INDEX IF NOT EXISTS api_keys_user_idx ON apiKeys(userId)`,
  `CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON auditLogs(userId)`,
];

export async function getTurso() {
  if (!client && process.env.TURSO_DATABASE_URL) {
    client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
    initialized = client.batch(schemaStatements.map((sql) => ({ sql })), "write").then(async () => {
      const columns = await client!.execute("PRAGMA table_info(users)");
      const names = new Set(columns.rows.map((row) => String((row as unknown as { name: string }).name)));
      const additions = [
        ["passwordHash", "TEXT"], ["emailVerified", "INTEGER NOT NULL DEFAULT 0"],
      ] as const;
      for (const [name, type] of additions) if (!names.has(name)) await client!.execute(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
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
