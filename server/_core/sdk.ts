import type { Request } from "express";
import type { User } from "../../drizzle/schema.js";
import { authenticateEmailRequest } from "../emailAuth.js";

export type AuthenticatedUser = User;

class EmailAuthSDK {
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const user = await authenticateEmailRequest(req);
    if (!user) throw new Error("Invalid session");
    return user;
  }
}

export const sdk = new EmailAuthSDK();
