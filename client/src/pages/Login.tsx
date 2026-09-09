import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, UserRound, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => { if (!loading && user) navigate(user.role?.toUpperCase() === "ADMIN" ? "/admin" : "/dashboard"); }, [loading, user, navigate]);
  return <div className="login-page"><div className="login-ambient ambient-one" /><div className="login-ambient ambient-two" /><div className="login-card"><div className="login-logo"><div className="brand-mark"><Zap size={18} /></div><span className="brand-name">LeeTec <span>Engine</span></span></div><div className="login-icon"><LockKeyhole size={21} /></div><h1>One login. Every workspace.</h1><p>Sign in securely to manage collections, payouts, wallets, and developer integrations.</p><Button className="primary-button login-button" onClick={() => startLogin()}>Continue with LeeTec <ArrowRight size={16} /></Button><div className="login-divider"><span>Secure access for</span></div><div className="login-roles"><div><span className="role-icon developer"><UserRound size={15} /></span><span><strong>Developers</strong><small>Dashboard & API operations</small></span><CheckCircle2 size={15} /></div><div><span className="role-icon admin"><ShieldCheck size={15} /></span><span><strong>Administrators</strong><small>Platform governance & controls</small></span><CheckCircle2 size={15} /></div></div><div className="login-foot"><span><span className="live-dot" /> Encrypted session</span><span>By continuing you agree to secure access policies.</span></div></div></div>;
}
