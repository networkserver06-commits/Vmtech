import { describe, expect, it } from "vitest";
import { calculatePlatformFee } from "./db.js";

describe("wallet fee safeguards", () => {
  it("charges KES 1 for collections from KES 1 through KES 50", () => {
    expect(calculatePlatformFee(1)).toBe(1);
    expect(calculatePlatformFee(50)).toBe(1);
  });

  it("charges 1.5% for collections above KES 50", () => {
    expect(calculatePlatformFee(100)).toBe(1.5);
    expect(calculatePlatformFee(1000)).toBe(15);
  });

  it("rounds fractional fees to two decimal places", () => {
    expect(calculatePlatformFee(51)).toBe(0.77);
    expect(calculatePlatformFee(99.99)).toBe(1.5);
  });

  it("does not produce a fee for invalid or non-positive amounts", () => {
    expect(calculatePlatformFee(0)).toBe(0);
    expect(calculatePlatformFee(-10)).toBe(0);
    expect(calculatePlatformFee(Number.NaN)).toBe(0);
  });
});
