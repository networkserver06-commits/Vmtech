import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./emailAuth.js";
import { buildPayoutAdminEmail, buildPayoutUserEmail, buildVerificationEmail } from "./email.js";

describe("email authentication", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^scrypt:/);
    expect(await verifyPassword("correct horse battery staple", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("uses a unique salt for each password hash", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });

  it("builds a branded verification email with a safe verification link", () => {
    const html = buildVerificationEmail("token with spaces&symbols");
    expect(html).toContain("Powered by <strong style=\"color:#c5f56e\">LeeTec Engine</strong>");
    expect(html).toContain('mailto:leetec.online@gmail.com');
    expect(html).toContain("Support: leetec.online@gmail.com");
    expect(html).toContain("/api/auth/verify?token=token%20with%20spaces%26symbols");
    expect(html).toContain("Verify email address");
  });

  it("builds an escaped payout notification for administrators", () => {
    const html = buildPayoutAdminEmail({ userName: "A <Customer>", userEmail: "customer@example.com", amount: 1250, destinationType: "PHONE", destination: "254712345678", requestCount: 2 });
    expect(html).toContain("Powered by <strong style=\"color:#c5f56e\">LeeTec Engine</strong>");
    expect(html).toContain("A &lt;Customer&gt;");
    expect(html).toContain("KES 1,250.00");
    expect(html).toContain("2 payout requests");
  });

  it("builds a user payout approval email with amount and method", () => {
    const html = buildPayoutUserEmail({ userName: "Customer", amount: 2500, destinationType: "PHONE", destination: "254712345678", status: "APPROVED" });
    expect(html).toContain("Payout approved ✅");
    expect(html).toContain("KES 2,500.00");
    expect(html).toContain("PHONE · 254712345678");
    expect(html).toContain("received for processing");
  });
});
