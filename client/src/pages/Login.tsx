import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (!loading && user) navigate(user.role?.toUpperCase() === "ADMIN" ? "/admin" : "/dashboard"); }, [loading, user, navigate]);
  useEffect(() => { const params = new URLSearchParams(window.location.search); if (params.get("verified") === "1") setNotice("Email verified. You can now sign in."); if (params.get("verified") === "0") setError("That verification link is invalid or expired."); }, []);
  const submit = async () => {
    setError(""); setNotice("");
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(form) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? "Unable to continue"); return; }
    if (mode === "register") { setNotice("Account created. Check your email to verify your address before signing in."); setMode("login"); return; }
    window.location.href = "/";
  };
  return <div className="login-page"><div className="login-ambient ambient-one" /><div className="login-ambient ambient-two" /><div className="login-card"><div className="login-logo"><div className="brand-mark"><Zap size={18} /></div><span className="brand-name">LeeTec <span>Engine</span></span></div><div className="login-icon"><LockKeyhole size={21} /></div><h1>{mode === "login" ? "Welcome back." : "Create your workspace."}</h1><p>{mode === "login" ? "Sign in to manage collections, payouts, wallets, and integrations." : "Use your email to create a secure developer account."}</p>{mode === "register" && <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /> }<Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" /><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (8+ characters)" />{error && <div className="login-error">{error}</div>}{notice && <div className="login-success"><CheckCircle2 size={15} /> {notice}</div>}<Button className="primary-button login-button" onClick={submit}>{mode === "login" ? "Sign in" : "Create account"} <ArrowRight size={16} /></Button><button className="login-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button><div className="login-divider"><span>Secure access for</span></div><div className="login-roles"><div><span className="role-icon developer"><UserRound size={15} /></span><span><strong>Developers</strong><small>Dashboard & API operations</small></span><CheckCircle2 size={15} /></div><div><span className="role-icon admin"><ShieldCheck size={15} /></span><span><strong>Administrators</strong><small>Platform governance & controls</small></span><CheckCircle2 size={15} /></div></div><div className="login-foot"><span><span className="live-dot" /> Email verification required</span><span>Secure password session</span></div></div></div>;
}
