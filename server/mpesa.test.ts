import { afterEach, describe, expect, it, vi } from "vitest";
import { explainDarajaStkError, registerC2bUrls, triggerStkPush } from "./mpesa.js";

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

  it("explains live STK product and credential failures", () => {
    expect(explainDarajaStkError(404, {})).toContain("Lipa na M-PESA Online");
    expect(explainDarajaStkError(401, { errorMessage: "Invalid access token" })).toContain("consumer key");
    expect(explainDarajaStkError(400, { errorMessage: "Invalid BusinessShortCode" })).toContain("shortcode");
  });

  it("sends a production STK request to Daraja with the live payload", async () => {
    process.env.MPESA_LIVE_ENABLED = "true";
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "live-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ResponseCode: "0", CheckoutRequestID: "ws_CO_live_1", MerchantRequestID: "live-merchant" }), { status: 200 }));

    const result = await triggerStkPush({ consumerKey: "live-key", consumerSecret: "live-secret", passkey: "live-passkey", shortcode: "4208798", environment: "PRODUCTION" }, { phoneNumber: "254712345678", amount: 10, accountReference: "1WALLETTEST", transactionDesc: "Wallet deposit", callbackUrl: "https://leetec.online/api/v1/callbacks/stk" });
    expect(result.CheckoutRequestID).toBe("ws_CO_live_1");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("api.safaricom.co.ke/oauth/v1/generate");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)).TransactionType).toBe("CustomerBuyGoodsOnline");
    fetchMock.mockRestore();
  });
});
