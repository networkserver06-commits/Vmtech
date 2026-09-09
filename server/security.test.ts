import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, generatePrefixedReference, hashApiKey, signWebhook } from "./security.js";

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
});
