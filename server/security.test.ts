import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generatePrefixedReference, getC2bCallbackToken, getStkCallbackToken, hashApiKey, safeWebhookUrl, signWebhook } from "./security.js";

describe("LeeTec Engine security primitives", () => {
  it("encrypts and decrypts credential secrets", () => {
    const encrypted = encryptSecret("daraja-secret");
    expect(encrypted).not.toContain("daraja-secret");
    expect(decryptSecret(encrypted)).toBe("daraja-secret");
  });

  it("hashes API keys deterministically", () => {
    expect(hashApiKey("sk_live_example")).toBe(hashApiKey("sk_live_example"));
    expect(hashApiKey("sk_live_example")).not.toBe(hashApiKey("sk_live_other"));
  });

  it("creates references that start with 1", () => {
    expect(generatePrefixedReference().startsWith("1")).toBe(true);
  });

  it("signs webhook payloads with HMAC SHA-256", () => {
    expect(signWebhook('{"event":"payment.success"}', "secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("does not expose the old production fallback key in source", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./security.ts", import.meta.url), "utf8"));
    expect(source).not.toContain("leetec-build-key-change-before-production");
  });

  it("requires dedicated callback secrets and derives separate tokens", () => {
    const previousStk = process.env.STK_CALLBACK_SECRET;
    const previousC2b = process.env.C2B_CALLBACK_SECRET;
    process.env.STK_CALLBACK_SECRET = "a".repeat(32);
    process.env.C2B_CALLBACK_SECRET = "b".repeat(32);
    expect(getStkCallbackToken()).toMatch(/^[a-f0-9]{64}$/);
    expect(getC2bCallbackToken()).toMatch(/^[a-f0-9]{64}$/);
    expect(getStkCallbackToken()).not.toBe(getC2bCallbackToken());
    if (previousStk === undefined) delete process.env.STK_CALLBACK_SECRET; else process.env.STK_CALLBACK_SECRET = previousStk;
    if (previousC2b === undefined) delete process.env.C2B_CALLBACK_SECRET; else process.env.C2B_CALLBACK_SECRET = previousC2b;
  });

  it("rejects unsafe webhook destinations", () => {
    expect(safeWebhookUrl("https://merchant.example/webhooks/payments")).toBe("https://merchant.example/webhooks/payments");
    expect(() => safeWebhookUrl("http://localhost:3000/hook")).toThrow();
    expect(() => safeWebhookUrl("https://127.0.0.1/hook")).toThrow();
    expect(() => safeWebhookUrl("https://user:pass@example.com/hook")).toThrow();
  });
});
