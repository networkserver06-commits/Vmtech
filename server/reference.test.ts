import { describe, expect, it } from "vitest";
import { accountReferenceSchema } from "./reference.js";

describe("account reference validation", () => {
  it("accepts merchant references that do not start with 1", () => {
    expect(accountReferenceSchema.parse("ADVERT1790000713085")).toBe("ADVERT1790000713085");
  });

  it("trims surrounding whitespace", () => {
    expect(accountReferenceSchema.parse("  invoice-42  ")).toBe("invoice-42");
  });

  it("rejects empty or overlong references", () => {
    expect(() => accountReferenceSchema.parse("   ")).toThrow();
    expect(() => accountReferenceSchema.parse("x".repeat(65))).toThrow();
  });
});
