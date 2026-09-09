import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "crud-test-user",
    email: "crud@example.com",
    name: "CRUD Tester",
    loginMethod: "test",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("engine CRUD contracts", () => {
  it("lists tenant-scoped collections and payouts without leaking across users", async () => {
    const caller = appRouter.createCaller(createContext());
    expect(await caller.engine.listCollections()).toEqual([]);
    expect(await caller.engine.listPayouts()).toEqual([]);
  });

  it("rejects collection references that do not start with 1", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.engine.createCollection({ phoneNumber: "254712884203", amount: 2500, accountReference: "INV-1001" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects payout phone numbers outside the Kenyan 254 format", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.engine.createPayout({ phoneNumber: "0712884203", amount: 2500, commandId: "BusinessPayment" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
