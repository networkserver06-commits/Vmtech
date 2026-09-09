import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone } from "./routers.js";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["254712345678", "254712345678"],
    ["0712345678", "254712345678"],
    ["0116553618", "254116553618"],
    ["+254 712 345 678", "254712345678"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["712345678", "25471234567", "0812345678", "011655361"]) (
    "rejects invalid Kenyan number %s",
    (input) => {
      expect(() => normalizeKenyanPhone(input)).toThrow();
    },
  );
});
