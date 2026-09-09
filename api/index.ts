import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "../server/_core/authRoutes";
import { registerRestRoutes } from "../server/rest";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));
registerAuthRoutes(app);
registerRestRoutes(app);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

export default app;
