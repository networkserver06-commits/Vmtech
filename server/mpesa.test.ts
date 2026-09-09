import { describe, expect, it } from "vitest";
import { registerC2bUrls } from "./mpesa";

describe("Daraja integration safeguards", () => {
  it("accepts C2B registration in sandbox without making a live request", async () => {
    const result = await registerC2bUrls({ consumerKey: "sandbox", consumerSecret: "sandbox", passkey: "sandbox", shortcode: "4208798" }, { confirmationUrl: "https://leetec.online/api/callbacks/c2b/confirmation", validationUrl: "https://leetec.online/api/callbacks/c2b/validation" });
    expect(result.sandbox).toBe(true);
    expect(result.ResponseDescription).toContain("Sandbox");
  });
});
