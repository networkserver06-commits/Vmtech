import type { Express, Request, Response } from "express";
import { clearSessionCookie, loginWithEmail, registerWithEmail, setSessionCookie, verifyEmail } from "../emailAuth.js";

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body ?? {};
      if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ error: "A valid email is required" });
      if (typeof password !== "string" || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });
      if (typeof name !== "string" || name.trim().length < 2) return res.status(400).json({ error: "Name is required" });
      res.status(201).json(await registerWithEmail({ email, password, name }));
    } catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Registration failed" }); }
  });
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Email and password are required" });
      const token = await loginWithEmail(email, password);
      setSessionCookie(req, res, token);
      res.json({ success: true });
    } catch (error) { res.status(401).json({ error: error instanceof Error ? error.message : "Login failed" }); }
  });
  app.get("/api/auth/verify", async (req: Request, res: Response) => {
    try { await verifyEmail(typeof req.query.token === "string" ? req.query.token : ""); res.redirect("/login?verified=1"); }
    catch { res.redirect("/login?verified=0"); }
  });
  app.post("/api/auth/logout", (req, res) => { clearSessionCookie(req, res); res.json({ success: true }); });
}
