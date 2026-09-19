import { ArrowLeft, BookOpen, CheckCircle2, Copy, KeyRound, ShieldCheck, Webhook, Zap, Code2 as Code2Icon, Activity, ExternalLink } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button subtle" aria-label={`Copy ${value}`} onClick={async () => { try { await navigator.clipboard?.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch { setCopied(false); } }}>{copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button>;
}

const baseUrl = "https://leetec.online";
const connectionSnippet = `LEETEC_BASE_URL=${baseUrl}\nLEETEC_API_KEY=your_leetec_api_key`;
const curlSnippet = `curl -X POST "$LEETEC_BASE_URL/api/v1/stkpush" \\\n  -H "Authorization: Bearer $LEETEC_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"phoneNumber":"254700000000","amount":100,"accountReference":"1ORDER001"}'`;
const nodeSnippet = `const response = await fetch(\`${baseUrl}/api/v1/stkpush\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.LEETEC_API_KEY}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    phoneNumber: "254700000000",
    amount: 100,
    accountReference: "1ORDER001"
  })
});

const result = await response.json();`;

function CodeBlock({ value }: { value: string }) { return <div className="code-block docs-code-block"><code>{value}</code><CopyValue value={value} /></div>; }
function DetailList({ items }: { items: Array<[string, string]> }) { return <div className="doc-detail-list">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }

export default function Documentation() {
  const [, navigate] = useLocation();
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark"><Zap size={17} strokeWidth={2.8} /></div><span className="brand-name">LeeTec <span>Engine</span></span></div>
      <div className="workspace-switcher"><div className="workspace-avatar">LT</div><div className="workspace-copy"><strong>LeeTec Documentation</strong><span>Public API guide</span></div></div>
      <nav className="nav-area" aria-label="Documentation navigation"><div className="nav-group"><div className="nav-label">Developer resources</div><button className="nav-item" onClick={() => navigate("/dashboard")}><ArrowLeft size={17} /><span>Back to workspace</span></button><button className="nav-item active"><BookOpen size={17} /><span>Documentation home</span></button><button className="nav-item" onClick={() => navigate("/dashboard")}><KeyRound size={17} /><span>API keys</span></button><button className="nav-item" onClick={() => navigate("/dashboard")}><Webhook size={17} /><span>Webhooks</span></button></div></nav>
      <div className="sidebar-bottom"><div className="sandbox-card"><div className="sandbox-icon"><ShieldCheck size={16} /></div><div><strong>Secure HTTPS API</strong><span>LeeTec Engine access</span></div><span className="live-dot" /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>API reference</strong></div><div className="topbar-actions"><Button className="secondary-button" onClick={() => navigate("/dashboard")}><ArrowLeft size={15} /> Workspace</Button></div></header>
      <div className="content-wrap">
        <section className="page-heading"><div><div className="eyebrow">LEE TEC ENGINE · PUBLIC API <span className="eyebrow-line" /></div><h1>LeeTec Engine API</h1><p>One secure API for collecting payments, tracking transaction status, and connecting payment activity to your application.</p></div><div className="heading-actions"><Button className="primary-button" onClick={() => navigate("/dashboard")}><Zap size={16} /> Open workspace</Button></div></section>
        <section className="hero-strip"><div className="hero-copy"><div className="hero-kicker">QUICK START</div><h2>Connect your application to LeeTec.</h2><p>Use your LeeTec API key with the LeeTec base URL. Keep the key on your server and use HTTPS for every request.</p></div><div className="hero-art"><Activity size={42} /></div></section>

        <div className="settings-grid">
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><KeyRound size={16} /></div><div><h2>LeeTec API key</h2><p>The only credential your integration needs.</p></div></div><DetailList items={[["Credential", "LeeTec API key"], ["Header", "Authorization: Bearer"], ["Format", "sk_live_…"], ["Storage", "Server-side only"]]} /><p className="settings-note"><ShieldCheck size={15} /> Create a key in Workspace → API keys. Never expose it in browser, mobile, or public source code.</p></section>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Zap size={16} /></div><div><h2>LeeTec base URL</h2><p>Use this URL for all LeeTec API requests.</p></div></div><DetailList items={[["Base URL", baseUrl], ["Protocol", "HTTPS"], ["API version", "v1"]]} /><p className="settings-note"><ShieldCheck size={15} /> LeeTec manages payment connections, routing, storage, and status updates for you.</p></section>
        </div>

        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>LeeTec connection</h2><p>These are the only two values required by a LeeTec API client.</p></div><KeyRound size={22} /></div><CodeBlock value={connectionSnippet} /><p className="settings-note"><ShieldCheck size={15} /> Replace <code>your_leetec_api_key</code> with the secret from Workspace → API keys. Keep both values on your server.</p></section>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Create a payment request</h2><p>Send a secure payment prompt through LeeTec Engine.</p></div><Code2Icon /></div><CodeBlock value={curlSnippet} /><p className="settings-note"><Activity size={15} /> A successful response means the request was accepted. Check transaction history for the final payment status.</p></section>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Node.js example</h2><p>Use any backend runtime that can make HTTPS requests.</p></div><Code2Icon /></div><CodeBlock value={nodeSnippet} /></section>

        <div className="settings-grid">
          <section className="settings-card docs-panel"><div className="settings-card-heading"><div className="settings-icon"><BookOpen size={16} /></div><div><h2>Request fields</h2><p>Required and optional payment values.</p></div></div><DetailList items={[["phoneNumber", "Kenyan mobile number"], ["amount", "Payment amount in KES"], ["accountReference", "Your order or customer reference"], ["transactionDesc", "Optional payment description"]]} /></section>
          <section className="settings-card docs-panel"><div className="settings-card-heading"><div className="settings-icon"><Activity size={16} /></div><div><h2>Payment statuses</h2><p>Track the complete payment lifecycle.</p></div></div><DetailList items={[["PENDING", "Request accepted; awaiting confirmation"], ["SUCCESS", "Payment confirmed"], ["FAILED", "Payment was not completed"], ["CANCELLED", "Payment was cancelled"]]} /></section>
        </div>

        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Transaction history</h2><p>Read the latest payment activity for your LeeTec account.</p></div><Activity size={22} /></div><div className="docs-endpoints"><div className="docs-endpoint"><span className="method-pill">GET</span><code>/api/v1/transactions</code><span>Complete authenticated transaction history.</span></div><div className="docs-endpoint"><span className="method-pill">GET</span><code>/api/v1/collections</code><span>Collections history alias.</span></div></div><p className="settings-note"><ShieldCheck size={15} /> Use history as the source of truth before fulfilling an order.</p></section>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>LeeTec Engine capabilities</h2><p>Everything needed to operate payment collection from one platform.</p></div><Zap size={22} /></div><DetailList items={[["Payment collection", "STK Push and incoming collections"], ["Transaction tracking", "Pending, successful, failed, and cancelled states"], ["Workspace controls", "API keys, destinations, payment links, and webhooks"], ["Notifications", "Optional signed webhooks for payment events"], ["Security", "HTTPS API access and server-side authentication"]]} /></section>
        <section className="settings-grid"><section className="settings-card docs-panel"><div className="settings-card-heading"><div className="settings-icon"><CheckCircle2 size={16} /></div><div><h2>Integration checklist</h2><p>Start using LeeTec Engine safely.</p></div></div><DetailList items={[["1", "Create a LeeTec API key"], ["2", "Set the LeeTec base URL"], ["3", "Store the key on your backend"], ["4", "Send requests over HTTPS"], ["5", "Check history for final status"]]} /></section><section className="settings-card docs-panel"><div className="settings-card-heading"><div className="settings-icon"><ShieldCheck size={16} /></div><div><h2>Private information</h2><p>Never place these in public code.</p></div></div><DetailList items={[["API key", "Keep private"], ["Customer details", "Use only when required"], ["Server configuration", "Managed securely by LeeTec"]]} /></section></section>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Webhooks</h2><p>Optional notifications for payment events.</p></div><Webhook size={22} /></div><p className="settings-note"><ShieldCheck size={15} /> Configure webhooks from Workspace → Webhooks. Transaction history remains available even when webhooks are not configured.</p></section>
        <section className="admin-panel docs-panel"><div className="admin-panel-heading"><div><h2>Support and workspace actions</h2><p>Manage your LeeTec Engine integration from the authenticated workspace.</p></div><ExternalLink size={22} /></div><div className="modal-actions"><Button className="primary-button" onClick={() => navigate("/dashboard")}><KeyRound size={15} /> Manage API keys</Button><Button className="secondary-button" onClick={() => navigate("/dashboard")}><Webhook size={15} /> Configure webhooks</Button></div></section>
        <SiteFooter />
      </div>
    </main>
  </div>;
}
