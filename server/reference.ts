import { z } from "zod";

/**
 * M-PESA account references may be supplied by merchants and payment-link users.
 * Do not require an internal LeeTec reference prefix; only reject empty or
 * unreasonably long values before sending the request to Daraja.
 */
export const accountReferenceSchema = z
  .string()
  .trim()
  .min(1, "Reference is required")
  .max(64, "Reference must be 64 characters or fewer");
