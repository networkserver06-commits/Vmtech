import { ArrowLeft, BookOpen, CheckCircle2, Copy, ExternalLink, KeyRound, ShieldCheck, Webhook, Zap } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button subtle" aria-label={`Copy ${value}`} onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }}>{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>;
}

const endpoints = [
  { method: "POST", path: "/api/v1/callbacks/stk", description: "Receive Safaricom STK Push payment confirmations." },
  { method: "POST", path: "/api/v1/callbacks/c2b/confirmation", description: "Receive confirmed C2B transactions." },
  { method: "POST", path: "/api/v1/callbacks/c2b/validation", description: "Validate incoming C2B transactions before completion." },
];

export default function Documentation() {
  const [, navigate] = useLocation();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark"><Zap size={17} strokeWidth={2.8} /></div><span className="brand-name">LeeTec <span>Engine</span></span></div>
      <div className="workspace-switcher"><div className="workspace-avatar">LT</div><div className="workspace-copy"><strong>LeeTec workspace</strong><span>Production</span></div></div>
      <nav className="nav-area" aria-label="Documentation navigation">
        <div className="nav-group"><div className="nav-label">Developer resources</div>
          <button className="nav-item" onClick={() => navigate("/dashboard")}><ArrowLeft size={17} /><span>Back to workspace</span></button>
          <button className="nav-item active"><BookOpen size={17} /><span>API reference</span></button>
          <button className="nav-item" onClick={() => navigate("/dashboard")}><KeyRound size={17} /><span>API keys</span></button>
          <button className="nav-item" onClick={() => navigate("/dashboard")}><Webhook size={17} /><span>Webhooks</span></button>
        </div>
      </nav>
      <div className="sidebar-bottom"><div className="sandbox-card"><div className="sandbox-icon"><ShieldCheck size={16} /></div><div><strong>Production mode</strong><span>Secure API access</span></div><span className="live-dot" /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>API reference</strong></div><div className="topbar-actions"><Button className="secondary-button" onClick={() => navigate("/dashboard")}><ArrowLeft size={15} /> Workspace</Button></div></header>
      <div className="content-wrap">
        <section className="page-heading"><div><div className="eyebrow">DEVELOPER RESOURCES <span className="eyebrow-line" /></div><h1>API reference</h1><p>Build secure payment flows with LeeTec Engine and Safaricom Daraja.</p></div><div className="heading-actions"><Button className="primary-button" onClick={() => navigate("/dashboard")}><Zap size={16} /> Open workspace</Button></div></section>
        <section className="hero-strip"><div className="hero-copy"><div className="hero-kicker">QUICK START</div><h2>Move from credentials to your first request.</h2><p>Create a production API key, configure your callbacks, and use the endpoint references below to connect your integration.</p></div><div className="hero-art"><BookOpen size={42} /></div></section>
        <div className="settings-grid">
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><KeyRound size={16} /></div><div><h2>Authentication</h2><p>Use a LeeTec production API key in the authorization header.</p></div></div><div className="code-block"><code>Authorization: Bearer sk_live_…</code><CopyValue value="Authorization: Bearer sk_live_" /></div><p className="settings-note"><ShieldCheck size={15} /> Keep API keys server-side. Never expose a secret key in browser or mobile code.</p></section>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Zap size={16} /></div><div><h2>Payment routing</h2><p>Production Buy Goods STK requests use the configured Daraja merchant mapping.</p></div></div><div className="doc-detail-list"><div><span>Transaction type</span><strong>CustomerBuyGoodsOnline</strong></div><div><span>Business shortcode</span><strong>Configured in workspace</strong></div><div><span>PartyB / store</span><strong>Configured in workspace</strong></div></div></section>
        </div>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Callback endpoints</h2><p>Register these public HTTPS endpoints with your payment provider.</p></div><Webhook size={22} /></div><div className="docs-endpoints">{endpoints.map((endpoint) => <div className="docs-endpoint" key={endpoint.path}><span className="method-pill">{endpoint.method}</span><code>{endpoint.path}</code><span>{endpoint.description}</span><ExternalLink size={14} /></div>)}</div></section>
        <section className="settings-card docs-note"><BookOpen size={18} /><div><strong>Need to configure your integration?</strong><p>Open the workspace to create API keys, manage tills, and review wallet and collection activity.</p></div><Button className="secondary-button" onClick={() => navigate("/dashboard")}>Go to workspace</Button></section>
      </div>
    </main>
  </div>;
}
