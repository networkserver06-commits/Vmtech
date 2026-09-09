import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Code2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Terminal,
  TrendingUp,
  UserRound,
  WalletCards,
  Webhook,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Collections", icon: ArrowDownLeft },
      { label: "Payouts", icon: Send },
      { label: "Wallet", icon: WalletCards },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "API keys", icon: KeyRound },
      { label: "Webhooks", icon: Webhook },
      { label: "API reference", icon: Code2 },
    ],
  },
];

const transactions = [
  { id: "19483021", type: "STK Push", detail: "254 712 884 203", amount: "+ KES 2,500", status: "Success", time: "Today, 10:42" },
  { id: "19483018", type: "B2C payout", detail: "254 701 002 111", amount: "− KES 8,000", status: "Success", time: "Today, 09:18" },
  { id: "19483007", type: "STK Push", detail: "254 722 400 918", amount: "+ KES 1,250", status: "Pending", time: "Yesterday, 18:06" },
  { id: "19482994", type: "B2C payout", detail: "254 711 882 040", amount: "− KES 3,500", status: "Failed", time: "Yesterday, 15:23" },
];

const bars = [48, 60, 42, 68, 54, 74, 63, 82, 56, 72, 88, 70, 92, 76, 66, 84, 96, 79, 100, 87, 92, 80, 96, 90];

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Success" ? "success" : status === "Pending" ? "pending" : "failed";
  return (
    <span className={`status-badge ${tone}`}>
      {status === "Success" ? <CheckCircle2 size={13} /> : status === "Pending" ? <Activity size={13} /> : <XCircle size={13} />}
      {status}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="icon-button subtle"
      aria-label={`Copy ${value}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);
  const greeting = useMemo(() => "Good morning, Brian", []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };
  if (loading || !user) return <div className="auth-state"><div className="brand-mark"><Zap size={17} /></div><span>Loading secure workspace…</span></div>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Zap size={17} strokeWidth={2.8} /></div>
          <span className="brand-name">LeeTec <span>Engine</span></span>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-avatar">LT</div>
          <div className="workspace-copy"><strong>LeeTec workspace</strong><span>Production</span></div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav className="nav-area" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.label;
                return (
                  <button
                    key={item.label}
                    className={`nav-item ${active ? "active" : ""}`}
                    onClick={() => { setActiveNav(item.label); setMobileOpen(false); if (item.label === "Collections") navigate("/collections"); if (item.label === "Payouts") navigate("/payouts"); }}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span>{item.label}</span>
                    {item.label === "API keys" && <span className="nav-count">2</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <div className="sandbox-icon"><ShieldCheck size={16} /></div>
            <div><strong>Sandbox mode</strong><span>Safe testing enabled</span></div>
            <span className="live-dot" />
          </div>
          <button className="nav-item"><Settings2 size={17} /><span>Settings</span></button>
          <button className="nav-item"><CircleHelp size={17} /><span>Help center</span><ExternalLink size={13} className="external" /></button>
          <div className="profile-row">
            <div className="profile-avatar">BK</div>
            <div className="profile-copy"><strong>Brian Kimani</strong><span>Owner</span></div>
            <MoreHorizontal size={17} className="muted-icon" />
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="search-wrap"><Search size={16} /><Input placeholder="Search" /><kbd>⌘ K</kbd></div>
            <button className="top-icon" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <div className="top-profile"><div className="profile-avatar small">BK</div><ChevronDown size={14} /></div>
          </div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div><div className="eyebrow">OVERVIEW <span className="eyebrow-line" /></div><h1>{greeting}</h1><p>Monitor your money flows and keep your integrations moving.</p></div>
            <div className="heading-actions"><Button className="secondary-button" onClick={() => notify("API reference is opening soon") }><Code2 size={16} /> API reference</Button><Button className="primary-button" onClick={() => navigate("/collections") }><Plus size={17} /> New collection</Button></div>
          </section>

          <section className="hero-strip">
            <div className="hero-copy"><div className="hero-kicker"><span className="pulse-dot" /> LIVE ENVIRONMENT</div><h2>Payments that move at the speed of your business.</h2><p>Your Daraja connection is healthy. The platform shortcode <strong>4208798</strong> is ready to collect.</p><button className="text-link" onClick={() => notify("Connection diagnostics are healthy")}>View connection health <ArrowUpRight size={15} /></button></div>
            <div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Zap size={27} /></div><span className="orbit-label label-a">STK</span><span className="orbit-label label-b">B2C</span><span className="orbit-label label-c">C2B</span></div>
          </section>

          <section className="metrics-grid">
            <div className="metric-card balance-card"><div className="metric-top"><span>Available balance</span><WalletCards size={17} /></div><div className="metric-value">KES 128,450<span>.00</span></div><div className="metric-bottom"><span className="metric-change positive"><ArrowUpRight size={13} /> 12.8%</span><span>vs. last month</span><button className="metric-action" onClick={() => setActiveNav("Wallet")}>Manage wallet <ArrowUpRight size={13} /></button></div></div>
            <div className="metric-card"><div className="metric-top"><span>Collections volume</span><ArrowDownLeft size={17} /></div><div className="metric-value">KES 482,920<span>.00</span></div><div className="metric-bottom"><span className="metric-change positive"><ArrowUpRight size={13} /> 8.4%</span><span>this month</span></div><div className="metric-spark"><div className="spark-line"><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div></div>
            <div className="metric-card"><div className="metric-top"><span>Successful requests</span><CheckCircle2 size={17} /></div><div className="metric-value">98<span>.7%</span></div><div className="metric-bottom"><span className="metric-change positive"><TrendingUp size={13} /> 1.2%</span><span>last 30 days</span></div><div className="progress-track"><div className="progress-value" /></div><div className="progress-caption"><span>14,281 total calls</span><span>Excellent</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>Active API keys</span><KeyRound size={17} /></div><div className="metric-value">02</div><div className="metric-bottom"><span className="metric-change neutral">Production</span><span>rotated 12d ago</span></div><button className="metric-action standalone" onClick={() => setActiveNav("API keys")}>Manage keys <ArrowUpRight size={13} /></button></div>
          </section>

          <section className="dashboard-grid">
            <div className="panel volume-panel"><div className="panel-heading"><div><h3>Transaction volume</h3><p>Gross value processed across all flows</p></div><div className="period-select">Last 30 days <ChevronDown size={14} /></div></div><div className="chart-summary"><div><strong>KES 611,370</strong><span><ArrowUpRight size={13} /> 10.6% from previous period</span></div><div className="legend"><span><i className="legend-dot collections" /> Collections</span><span><i className="legend-dot payouts" /> Payouts</span></div></div><div className="bar-chart" aria-label="Transaction volume chart">{bars.map((height, index) => <div className="bar-column" key={index}><div className={`bar collections ${index > 15 ? "emphasis" : ""}`} style={{ height: `${height}%` }} /><div className="bar payouts" style={{ height: `${Math.max(18, height * .42)}%` }} /></div>)}</div><div className="chart-axis"><span>01 Sep</span><span>08 Sep</span><span>15 Sep</span><span>22 Sep</span><span>30 Sep</span></div></div>
            <div className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common developer tasks</p></div><Zap size={17} className="gold-icon" /></div><div className="quick-list"><button onClick={() => navigate("/collections")}><span className="quick-icon green"><ArrowDownLeft size={17} /></span><span><strong>Collect payment</strong><small>Trigger an STK Push</small></span><ArrowUpRight size={15} /></button><button onClick={() => navigate("/payouts")}><span className="quick-icon blue"><Send size={17} /></span><span><strong>Send payout</strong><small>Disburse via B2C</small></span><ArrowUpRight size={15} /></button><button onClick={() => setActiveNav("Webhooks")}><span className="quick-icon purple"><Webhook size={17} /></span><span><strong>Configure webhook</strong><small>Receive event updates</small></span><ArrowUpRight size={15} /></button></div><div className="quick-footer"><Terminal size={15} /> <span>Need help integrating?</span><button onClick={() => setActiveNav("API reference")}>Read the docs <ArrowUpRight size={13} /></button></div></div>
          </section>

          <section className="lower-grid">
            <div className="panel activity-panel"><div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest collections and payouts</p></div><button className="panel-link" onClick={() => navigate("/collections")}>View all <ArrowUpRight size={14} /></button></div><div className="activity-table"><div className="table-head"><span>Reference</span><span>Type</span><span>Amount</span><span>Status</span><span>Time</span><span /></div>{transactions.map((tx) => <div className="table-row" key={tx.id}><div className="ref-cell"><div className={`tx-icon ${tx.type === "STK Push" ? "collection" : "payout"}`}>{tx.type === "STK Push" ? <ArrowDownLeft size={14} /> : <Send size={14} />}</div><div><strong>{tx.id}</strong><small>{tx.detail}</small></div></div><span className="type-cell">{tx.type}</span><strong className={tx.amount.startsWith("+") ? "amount-positive" : "amount-negative"}>{tx.amount}</strong><StatusBadge status={tx.status} /><span className="time-cell">{tx.time}</span><button className="row-more" aria-label={`More actions for ${tx.id}`}><MoreHorizontal size={16} /></button></div>)}</div></div>
            <div className="panel key-panel"><div className="panel-heading"><div><h3>Production key</h3><p>Use this key in your server</p></div><KeyRound size={17} className="gold-icon" /></div><div className="key-preview"><div className="key-label"><span>Secret key</span><button onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeOff size={14} /> : <Eye size={14} />} {showSecret ? "Hide" : "Reveal"}</button></div><div className="secret-value">{showSecret ? "sk_live_51M2••••••••••••••••9XwP" : "sk_live_51M2••••••••••••••••••••"}<CopyButton value="sk_live_51M2_example_key" /></div><div className="key-meta"><span><span className="live-dot" /> Active</span><span>Created 12 days ago</span></div></div><div className="key-warning"><ShieldCheck size={16} /><span>Keep your secret key private. It can make live API requests.</span></div><button className="secondary-button full-width" onClick={() => notify("Key creation flow opened")}><Plus size={16} /> Create another key</button></div>
          </section>

          <footer className="footer-note"><span><span className="footer-dot" /> All systems operational</span><span>LeeTec Engine v1.0 <span className="footer-sep">•</span> <button onClick={() => notify("Status page is opening soon")}>Status</button> <span className="footer-sep">•</span> <button onClick={() => notify("Documentation is opening soon")}>Documentation</button></span></footer>
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
