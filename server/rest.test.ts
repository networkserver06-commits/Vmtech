import { describe, expect, it } from "vitest";
import { explainStkResult } from "./rest.js";

describe("explainStkResult", () => {
  it("explains common M-PESA callback rejection codes", () => {
    expect(explainStkResult(1032, "")).toContain("cancelled");
    expect(explainStkResult(1037, "")).toContain("timed out");
    expect(explainStkResult(2001, "")).toContain("PIN");
  });

  it("uses Safaricom's description for unknown codes", () => {
    expect(explainStkResult(9999, "Custom Safaricom reason")).toBe("Custom Safaricom reason");
  });
});
