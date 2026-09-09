import { afterEach, describe, expect, it } from "vitest";
import { registerC2bUrls, triggerStkPush } from "./mpesa.js";

describe("Daraja integration safeguards", () => {
  const previousLiveFlag = process.env.MPESA_LIVE_ENABLED;

  afterEach(() => {
    if (previousLiveFlag === undefined) delete process.env.MPESA_LIVE_ENABLED;
    else process.env.MPESA_LIVE_ENABLED = previousLiveFlag;
  });

  it("accepts C2B registration in sandbox without making a live request", async () => {
    process.env.MPESA_LIVE_ENABLED = "false";
    const result = await registerC2bUrls({ consumerKey: "sandbox", consumerSecret: "sandbox", passkey: "sandbox", shortcode: "4208798" }, { confirmationUrl: "https://leetec.online/api/callbacks/c2b/confirmation", validationUrl: "https://leetec.online/api/callbacks/c2b/validation" });
    expect(result.sandbox).toBe(true);
    expect(result.ResponseDescription).toContain("Sandbox");
  });

  it("accepts STK Push in sandbox without a production certificate", async () => {
    process.env.MPESA_LIVE_ENABLED = "false";
    const result = await triggerStkPush({ consumerKey: "sandbox", consumerSecret: "sandbox", passkey: "sandbox", shortcode: "4208798", environment: "SANDBOX" }, { phoneNumber: "254712345678", amount: 10, accountReference: "100001", transactionDesc: "Test", callbackUrl: "https://example.com/stk" });
    expect(result.sandbox).toBe(true);
    expect(result.CheckoutRequestID).toMatch(/^ws_CO_/);
  });
});
