import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "../server/_core/authRoutes.js";
import { registerRestRoutes } from "../server/rest.js";
import { appRouter } from "../server/routers.js";
import { createContext } from "../server/_core/context.js";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));
registerAuthRoutes(app);
registerRestRoutes(app);
app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));

export default app;
