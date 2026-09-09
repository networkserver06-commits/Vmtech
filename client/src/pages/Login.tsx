import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck, UserRound, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

type Mode = "login" | "register";

export default function Login() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user) navigate(user.role?.toUpperCase() === "ADMIN" ? "/admin" : "/dashboard");
  }, [loading, user, navigate]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    if (params.get("verified") === "1") setNotice("Email verified successfully.");
    if (params.get("verified") === "0") setError("That verification link is invalid or expired.");
  }, []);

  const passwordChecks = useMemo(() => ({
    length: form.password.length >= 8,
    upper: /[A-Z]/.test(form.password),
    number: /\d/.test(form.password),
    match: form.password.length > 0 && form.password === form.confirmPassword,
  }), [form.password, form.confirmPassword]);

  const changeMode = (next: Mode) => { setMode(next); setError(""); setNotice(""); setShowPassword(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setNotice("");
    if (mode === "register" && !passwordChecks.length) return setError("Password must be at least 8 characters.");
    if (mode === "register" && !passwordChecks.match) return setError("Passwords do not match.");
    setBusy(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Unable to continue. Please try again.");
      if (mode === "register") { setNotice("Account created. You can sign in now. Email verification is optional."); setMode("login"); setForm({ name: "", email: form.email, password: "", confirmPassword: "" }); }
      else window.location.assign("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to connect to LeeTec Engine."); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    if (!form.email) return setError("Enter your email address first.");
    setBusy(true); setError("");
    try { const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Unable to resend verification email."); setNotice("A new verification email has been sent."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to resend verification email."); }
    finally { setBusy(false); }
  };

  return <div className="login-page"><div className="login-ambient ambient-one" /><div className="login-ambient ambient-two" /><form className="login-card login-card-upgraded" onSubmit={submit}><div className="login-logo"><div className="brand-mark"><Zap size={18} /></div><span className="brand-name">LeeTec <span>Engine</span></span></div><div className="login-icon">{mode === "login" ? <LockKeyhole size={21} /> : <MailCheck size={21} />}</div><h1>{mode === "login" ? "Welcome back." : "Create your workspace."}</h1><p>{mode === "login" ? "Sign in to manage collections, Till payments, wallets, and integrations." : "Create a secure developer account and start using your workspace immediately."}</p>{mode === "register" && <Input autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" aria-label="Full name" /> }<Input autoComplete="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" aria-label="Email address" required /><div className="password-wrap"><Input autoComplete={mode === "login" ? "current-password" : "new-password"} type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password" aria-label="Password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>{mode === "register" && <><div className="password-wrap"><Input autoComplete="new-password" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" aria-label="Confirm password" required /><span className="password-confirm-icon">{passwordChecks.match ? <CheckCircle2 size={15} /> : form.confirmPassword ? <XCircle size={15} /> : null}</span></div><div className="password-rules"><span className={passwordChecks.length ? "valid" : ""}>8+ characters</span><span className={passwordChecks.upper ? "valid" : ""}>One uppercase</span><span className={passwordChecks.number ? "valid" : ""}>One number</span></div></>}{error && <div className="login-error"><XCircle size={15} /> <span>{error}</span></div>}{notice && <div className="login-success"><CheckCircle2 size={15} /> <span>{notice}</span></div>}<Button type="submit" disabled={busy} className="primary-button login-button">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} {!busy && <ArrowRight size={16} />}</Button><button type="button" className="login-switch" onClick={() => changeMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Need an account? Create one" : "Already have an account? Sign in"}</button>{notice && mode === "login" && notice.toLowerCase().includes("verify") && <button type="button" className="resend-link" onClick={resend} disabled={busy}>Resend verification email</button>}<div className="login-divider"><span>Secure access for</span></div><div className="login-roles"><div><span className="role-icon developer"><UserRound size={15} /></span><span><strong>Developers</strong><small>Dashboard & API operations</small></span><CheckCircle2 size={15} /></div><div><span className="role-icon admin"><ShieldCheck size={15} /></span><span><strong>Administrators</strong><small>Platform governance & controls</small></span><CheckCircle2 size={15} /></div></div><div className="login-foot"><span><span className="live-dot" /> Email verification optional</span><span>Secure password session</span></div></form></div>;
}
