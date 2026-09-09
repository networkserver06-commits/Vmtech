export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  appUrl: process.env.APP_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  adminEmails: (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean),
  mpesaLiveEnabled: process.env.MPESA_LIVE_ENABLED === "true",
  mpesaEnvironment: process.env.MPESA_ENVIRONMENT ?? (process.env.MPESA_LIVE_ENABLED === "true" ? "PRODUCTION" : "SANDBOX"),
};

export function isConfiguredAdminEmail(email: string | null | undefined) {
  return Boolean(email && ENV.adminEmails.includes(email.trim().toLowerCase()));
}
