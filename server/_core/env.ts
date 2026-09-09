export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  tursoDatabaseUrl: process.env.TURSO_DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "",
  appUrl: process.env.APP_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};
