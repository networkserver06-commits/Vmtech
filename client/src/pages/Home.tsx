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
  Store,
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
import { trpc } from "@/lib/trpc";

const navGroups = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", icon: LayoutDashboard },
      { label: "Collections", icon: ArrowDownLeft },
      { label: "Wallet", icon: WalletCards },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "API keys", icon: KeyRound },
      { label: "Tills", icon: Store },
      { label: "Webhooks", icon: Webhook },
    ],
  },
];

function money(value: number) { return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function relativeTime(value: unknown) {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}

function normalizeDepositPhone(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, "").replace(/^\+/, "");
  const normalized = digits.startsWith("254") ? digits : /^(?:07|01)\d{8}$/.test(digits) ? `254${digits.slice(1)}` : "";
  return /^254\d{9}$/.test(normalized) ? normalized : "";
}

function depositDetail(deposit: { status?: unknown; mpesaReceipt?: unknown; failureReason?: unknown }) {
  if (String(deposit.status) === "FAILED") {
    const reason = String(deposit.failureReason ?? "").trim();
    if (!reason || /unresolved reason type|undefined|null|\[object object\]/i.test(reason)) return "Safaricom declined the request without a reason. Verify the phone number and live Daraja credentials.";
    return reason;
  }
  return String(deposit.mpesaReceipt ?? "Awaiting receipt");
}

function readableDepositError(value: unknown) {
  const message = typeof value === "string" ? value.trim() : "";
  if (!message || /unresolved reason type|safaricom declined the request without a usable reason|undefined|null|\[object object\]/i.test(message)) return `No usable error details were returned by the production API. Diagnostic ID: DEP-${Date.now().toString(36).toUpperCase()}. Check the Vercel function logs and confirm the live Daraja variables are deployed.`;
  return message;
}

function depositMutationError(error: unknown) {
  const candidate = error as { message?: unknown; data?: { code?: unknown; httpStatus?: unknown } } | null;
  const message = readableDepositError(candidate?.message);
  const metadata = [candidate?.data?.code && `code=${String(candidate.data.code)}`, candidate?.data?.httpStatus && `http=${String(candidate.data.httpStatus)}`].filter(Boolean).join(" ");
  return metadata ? `${message} (${metadata})` : message;
}

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
  const [keyName, setKeyName] = useState("");
  const [keyConfirmation, setKeyConfirmation] = useState<"create" | "revoke" | null>(null);
  const [revokeKeyId, setRevokeKeyId] = useState<number | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [tillNumber, setTillNumber] = useState("");
  const [tillName, setTillName] = useState("");
  const [tillLocation, setTillLocation] = useState("");
  const [tillType, setTillType] = useState<"BUY_GOODS" | "PAYBILL">("BUY_GOODS");
  const [businessShortcode, setBusinessShortcode] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [depositPhone, setDepositPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [walletHistoryTab, setWalletHistoryTab] = useState<"deposits" | "collections">("deposits");
  const [toast, setToast] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositNotice, setDepositNotice] = useState<string | null>(null);
  const [depositCheckoutId, setDepositCheckoutId] = useState<string | null>(null);
  const { user, loading } = useAuth();
  const overview = trpc.engine.overview.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 5000, refetchOnWindowFocus: true });
  const apiKeys = trpc.engine.listApiKeys.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const tills = trpc.engine.listTills.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const walletDeposits = trpc.engine.listWalletDeposits.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const tillTransactions = trpc.engine.listCollections.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const webhooks = trpc.engine.listWebhooks.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const createApiKey = trpc.engine.createApiKey.useMutation({ onSuccess: (result) => { setNewSecret(result.key); setKeyName(""); apiKeys.refetch(); notify("Production key created. Copy it now; it will not be shown again."); } });
  const revokeApiKey = trpc.engine.revokeApiKey.useMutation({ onSuccess: () => { apiKeys.refetch(); notify("API key revoked"); } });
  const createTill = trpc.engine.createTill.useMutation({ onSuccess: () => { tills.refetch(); setTillNumber(""); setTillName(""); setTillLocation(""); setTillType("BUY_GOODS"); setBusinessShortcode(""); notify("Payment destination added to your workspace"); } });
  const deleteTill = trpc.engine.deleteTill.useMutation({ onSuccess: () => { tills.refetch(); notify("Till removed"); } });
  const createWebhook = trpc.engine.createWebhook.useMutation({ onSuccess: () => { webhooks.refetch(); setWebhookUrl(""); setWebhookSecret(""); notify("Webhook endpoint added"); }, onError: (error) => notify(error.message) });
  const deleteWebhook = trpc.engine.deleteWebhook.useMutation({ onSuccess: () => { webhooks.refetch(); notify("Webhook endpoint removed"); }, onError: (error) => notify(error.message) });
  const depositWallet = trpc.engine.depositWallet.useMutation({ onSuccess: () => { overview.refetch(); walletDeposits.refetch(); tillTransactions.refetch(); setDepositError(null); setDepositNotice("STK request accepted. Check the M-PESA phone now and enter your PIN. Your wallet updates only after Safaricom confirms payment."); notify("STK prompt request accepted"); }, onError: (error) => { const message = depositMutationError(error); setDepositNotice(null); setDepositError(message); notify("Deposit request failed — see the Wallet status panel"); } });
  useEffect(() => {
    const result = depositWallet.data as { CheckoutRequestID?: unknown; checkoutRequestId?: unknown } | undefined;
    const checkoutId = result?.CheckoutRequestID ?? result?.checkoutRequestId;
    if (checkoutId) setDepositCheckoutId(String(checkoutId));
  }, [depositWallet.data]);
  useEffect(() => {
    if (!depositCheckoutId) return;
    const started = Date.now();
    const timer = window.setInterval(async () => {
      const response = await walletDeposits.refetch();
      const current = (response.data ?? []).find((deposit) => String(deposit.checkoutRequestId) === depositCheckoutId);
      if (current?.status === "SUCCESS") { setDepositNotice("M-PESA payment confirmed. Your wallet has been credited."); setDepositCheckoutId(null); overview.refetch(); window.clearInterval(timer); }
      else if (current?.status === "FAILED") { setDepositError(readableDepositError(current.failureReason)); setDepositNotice(null); setDepositCheckoutId(null); window.clearInterval(timer); }
      else if (Date.now() - started > 120000) { setDepositError("No M-PESA callback received within two minutes. Confirm the number is an active Safaricom M-PESA line, then try again."); setDepositNotice(null); setDepositCheckoutId(null); window.clearInterval(timer); }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [depositCheckoutId, walletDeposits.refetch, overview.refetch]);
  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);
  const greeting = useMemo(() => `${new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening"}, ${user?.name?.split(" ")[0] ?? "there"}`, [user?.name]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  };
  const live = overview.data ?? { balance: 0, collections: 0, payouts: 0, successRate: 0, activeKeys: 0, accountId: user?.accountId ?? "—", environment: "NOT_CONFIGURED", shortcode: null, transactions: [] };
  const activities = (live.transactions as Array<Record<string, unknown>>).filter((item) => item.kind !== "payout");
  const visibleKeys = (apiKeys.data ?? []) as Array<Record<string, unknown>>;
  const activeKey = visibleKeys.find((key) => Boolean(key.isActive));
  const visibleTills = (tills.data ?? []) as Array<Record<string, unknown>>;
  const visibleDeposits = (walletDeposits.data ?? []).filter((deposit) => String(deposit.status) === "SUCCESS");
  const visibleTillTransactions = tillTransactions.data ?? [];
  const normalizedDepositPhone = normalizeDepositPhone(depositPhone);
  const chartBars = useMemo(() => {
    const values = activities.slice(0, 12).map((item) => Number(item.amount ?? 0));
    const max = Math.max(...values, 1);
    return Array.from({ length: 12 }, (_, index) => Math.max(8, Math.round(((values[index] ?? 0) / max) * 92)));
  }, [activities]);
  if (loading || !user || overview.isLoading) return <div className="auth-state"><div className="brand-mark"><Zap size={17} /></div><span>Loading secure workspace…</span></div>;

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

        <div className="sidebar-quick-actions">
          <div className="profile-row sidebar-profile">
            <div className="profile-avatar">{user.name?.slice(0, 2).toUpperCase() ?? "ME"}</div>
            <div className="profile-copy"><strong>{user.name ?? "Developer"}</strong><span>{user.email ?? "Signed-in account"}</span></div>
            <MoreHorizontal size={17} className="muted-icon" />
          </div>
          <button className="nav-item sidebar-settings"><Settings2 size={17} /><span>Settings</span></button>
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
                    onClick={() => { setActiveNav(item.label); setMobileOpen(false); if (item.label === "Collections") navigate("/collections?from=dashboard"); }}
                  >
                    <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
                    <span>{item.label}</span>
                    {item.label === "API keys" && <span className="nav-count">{live.activeKeys}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sandbox-card">
            <div className="sandbox-icon"><ShieldCheck size={16} /></div>
            <div><strong>{live.environment === "PRODUCTION" ? "Production mode" : live.environment === "SANDBOX" ? "Sandbox mode" : "Payments not configured"}</strong><span>{live.shortcode ? `Shortcode ${live.shortcode}` : "Add M-PESA credentials in Settings"}</span></div>
            <span className="live-dot" />
          </div>
          <button className="nav-item"><CircleHelp size={17} /><span>Help center</span><ExternalLink size={13} className="external" /></button>
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
            <div className="top-profile"><div className="profile-avatar small">{user.name?.slice(0, 2).toUpperCase() ?? "ME"}</div><ChevronDown size={14} /></div>
          </div>
        </header>

        <div className="content-wrap dashboard-tabs" data-active-tab={activeNav}>
          <section className="page-heading">
            <div><div className="eyebrow">{activeNav.toUpperCase()} <span className="eyebrow-line" /></div><h1>{activeNav === "Overview" ? greeting : activeNav}</h1><p>{activeNav === "Overview" ? "Monitor your money flows and keep your integrations moving." : `Manage your ${activeNav.toLowerCase()} in this dedicated workspace tab.`}</p></div>
            <div className="heading-actions">{activeNav === "Overview" && <Button className="primary-button" onClick={() => navigate("/collections?from=dashboard") }><Plus size={17} /> New collection</Button>}</div>
          </section>

          {activeNav === "Overview" && <section className="hero-strip">
            <div className="hero-copy"><div className="hero-kicker"><span className="pulse-dot" /> {live.environment === "PRODUCTION" ? "LIVE ENVIRONMENT" : live.environment === "SANDBOX" ? "SANDBOX ENVIRONMENT" : "ENVIRONMENT SETUP"}</div><h2>Payments that move at the speed of your business.</h2><p>{live.shortcode ? <>Your Daraja connection is configured with shortcode <strong>{live.shortcode}</strong>.</> : "Add your Daraja credentials in Settings to enable payment requests."}</p><button className="text-link" onClick={() => notify(live.shortcode ? "Configuration loaded from your workspace" : "M-PESA configuration is not set")}>View connection health <ArrowUpRight size={15} /></button></div>
            <div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><Zap size={27} /></div><span className="orbit-label label-a">STK</span><span className="orbit-label label-c">C2B</span></div>
          </section>}

          <section className="metrics-grid tab-overview">
            <div className="metric-card balance-card"><div className="metric-top"><span>Available balance</span><WalletCards size={17} /></div><div className="metric-value">{money(live.balance)}</div><div className="metric-bottom"><span className="metric-change neutral">Current balance</span><button className="metric-action" onClick={() => setActiveNav("Wallet")}>Manage wallet <ArrowUpRight size={13} /></button></div></div>
            <div className="metric-card"><div className="metric-top"><span>Collections volume</span><ArrowDownLeft size={17} /></div><div className="metric-value">{money(live.collections)}</div><div className="metric-bottom"><span className="metric-change neutral">All recorded collections</span></div><div className="metric-spark"><div className="spark-line">{chartBars.slice(-8).map((height, index) => <span key={index} style={{ height: `${height}%` }} />)}</div></div></div>
            <div className="metric-card"><div className="metric-top"><span>Successful requests</span><CheckCircle2 size={17} /></div><div className="metric-value">{live.successRate}<span>%</span></div><div className="metric-bottom"><span className="metric-change neutral">Recorded activity</span><span>{activities.length} recent events</span></div><div className="progress-track"><div className="progress-value" style={{ width: `${live.successRate}%` }} /></div><div className="progress-caption"><span>From stored transactions</span><span>{live.successRate >= 90 ? "Healthy" : live.successRate > 0 ? "Monitor" : "No data"}</span></div></div>
            <div className="metric-card"><div className="metric-top"><span>Active API keys</span><KeyRound size={17} /></div><div className="metric-value">{String(live.activeKeys).padStart(2, "0")}</div><div className="metric-bottom"><span className="metric-change neutral">{live.environment === "PRODUCTION" ? "Production" : live.environment === "SANDBOX" ? "Sandbox" : "Not configured"}</span><span>{activeKey ? `Last used ${relativeTime(activeKey.lastUsedAt)}` : "No active keys"}</span></div><button className="metric-action standalone" onClick={() => { setActiveNav("API keys"); document.getElementById("api-keys-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Manage keys <ArrowUpRight size={13} /></button></div>
          </section>

          <section className="wallet-deposit-panel panel tab-wallet">
            <div className="wallet-deposit-copy"><div className="panel-kicker">WALLET OPERATIONS <span className="eyebrow-line" /></div><h3>Fund your platform wallet</h3><p>Send an STK Push to your platform M-PESA account. Your platform wallet is credited only after Safaricom confirms the payment.</p><div className="wallet-deposit-meta"><span><CheckCircle2 size={14} /> Live callback settlement</span><span><ShieldCheck size={14} /> Ledger tracked</span></div></div>
            <div className="wallet-deposit-form"><label className="wallet-form-field"><span>M-PESA number</span><Input value={depositPhone} onChange={(event) => setDepositPhone(event.target.value.replace(/[^\d+\s()-]/g, "").slice(0, 20))} placeholder="07..., 011..., or 254..." aria-label="M-PESA phone number" inputMode="tel" autoComplete="tel" /><small>Accepted: 07XXXXXXXX, 011XXXXXXXX, or 254XXXXXXXXX</small></label><label className="wallet-form-field"><span>Deposit amount</span><Input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount in KES" aria-label="Wallet deposit amount" inputMode="decimal" min="1" max="1500000" /><small>Wallet credit follows the confirmed M-PESA callback.</small></label><button className="primary-button" disabled={depositWallet.isPending || !normalizedDepositPhone || Number(depositAmount) <= 0} onClick={() => depositWallet.mutate({ phoneNumber: normalizedDepositPhone, amount: Number(depositAmount) })}><WalletCards size={16} /> {depositWallet.isPending ? "Sending…" : "Deposit wallet"}</button></div>
            {(depositWallet.isPending || depositNotice || depositError || depositCheckoutId) && <div className={`deposit-flow-status ${depositError ? "error" : depositWallet.isPending || depositCheckoutId ? "pending" : "success"}`} role="status"><div className="deposit-flow-icon">{depositError ? <XCircle size={16} /> : depositWallet.isPending || depositCheckoutId ? <Activity size={16} /> : <CheckCircle2 size={16} />}</div><div><strong>{depositError ? "Deposit request failed" : depositWallet.isPending ? "Sending STK prompt…" : depositCheckoutId ? "Waiting for M-PESA confirmation…" : "M-PESA payment confirmed"}</strong><span>{depositError ?? (depositCheckoutId ? "Daraja accepted the request. The prompt must now be delivered to an active Safaricom M-PESA line." : depositNotice)}</span>{depositError && <small>Verify that this is an active Safaricom M-PESA number, then check the live shortcode, STK passkey, consumer credentials, and callback configuration.</small>}</div>{(depositError || depositNotice) && <button aria-label="Dismiss deposit status" onClick={() => { setDepositError(null); setDepositNotice(null); }}><X size={15} /></button>}</div>}
            <div className="wallet-history"><div className="wallet-history-tabs"><button className={walletHistoryTab === "deposits" ? "active" : ""} onClick={() => setWalletHistoryTab("deposits")}>Wallet deposits <span>{visibleDeposits.length}</span></button><button className={walletHistoryTab === "collections" ? "active" : ""} onClick={() => setWalletHistoryTab("collections")}>Direct Till collections <span>{visibleTillTransactions.length}</span></button></div>{walletHistoryTab === "deposits" ? <div className="wallet-history-list">{visibleDeposits.length ? visibleDeposits.map((deposit) => <div className="wallet-history-row" key={String(deposit.id)}><div><strong>{money(Number(deposit.amount))}</strong><small>{String(deposit.phoneNumber)} · {depositDetail(deposit)}</small></div><span className="deposit-status success">Credited</span><small>{new Date(String(deposit.createdAt)).toLocaleString()}</small></div>) : <div className="wallet-history-empty">Completed wallet deposits will appear here after M-PESA confirms payment.</div>}</div> : <div className="wallet-history-list">{visibleTillTransactions.length ? visibleTillTransactions.map((transaction) => <div className="wallet-history-row" key={String(transaction.id)}><div><strong>{money(Number(transaction.amount))}</strong><small>{String(transaction.tillName ?? "Platform Till")} · {String(transaction.tillNumber ?? "Primary shortcode")} · {String(transaction.accountReference)} · Fee {money(Number(transaction.platformFee ?? 0))} · Net {money(Number(transaction.netAmount ?? transaction.amount))}</small></div><span className={`deposit-status ${String(transaction.status).toLowerCase()}`}>{String(transaction.status) === "SUCCESS" ? "Settled" : String(transaction.status)}</span><small>{new Date(String(transaction.createdAt)).toLocaleString()}</small></div>) : <div className="wallet-history-empty">No direct Till collections yet.</div>}</div>}</div>
          </section>

          <section className="panel webhook-panel tab-webhooks"><div className="panel-heading"><div><h3>Webhook endpoints</h3><p>Send your payment events to a server you control.</p></div><Webhook size={18} className="gold-icon" /></div><div className="key-access-note"><ShieldCheck size={15} /><div><strong>Protect your webhook secret</strong><span>LeeTec stores the secret encrypted. Use it to verify signatures in your application. It is never shown again after submission.</span></div></div><div className="webhook-list">{(webhooks.data ?? []).length ? (webhooks.data ?? []).map((hook) => <div className="webhook-row" key={String(hook.id)}><div className="till-details"><strong>{String(hook.url)}</strong><span><span className="live-dot" /> Active · Created {relativeTime(hook.createdAt)}</span></div><button className="danger-button" onClick={() => { if (window.confirm("Remove this webhook endpoint?")) deleteWebhook.mutate({ id: Number(hook.id) }); }}>Remove</button></div>) : <div className="till-empty">No webhook endpoints configured yet.</div>}</div><div className="webhook-create-row"><Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://your-domain.com/webhooks/leetec" aria-label="Webhook URL" type="url" /><Input value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Signing secret (16+ characters)" aria-label="Webhook signing secret" type="password" /><button className="secondary-button" disabled={createWebhook.isPending || !/^https:\/\//.test(webhookUrl) || webhookSecret.length < 16} onClick={() => createWebhook.mutate({ url: webhookUrl.trim(), secret: webhookSecret })}><Plus size={16} /> Add webhook</button></div><div className="fee-note"><ShieldCheck size={15} /><span>Use HTTPS in production. Your endpoint should return a 2xx response quickly and process events asynchronously.</span></div></section>

          <section className="dashboard-grid tab-overview">
            <div className="panel volume-panel"><div className="panel-heading"><div><h3>Transaction volume</h3><p>Gross collection value processed across your tills</p></div><div className="period-select">All recorded data <ChevronDown size={14} /></div></div><div className="chart-summary"><div><strong>{money(live.collections)}</strong><span>Direct Till collections</span></div><div className="legend"><span><i className="legend-dot collections" /> Collections</span></div></div><div className="bar-chart" aria-label="Transaction volume chart">{chartBars.map((height, index) => <div className="bar-column" key={index}><div className="bar collections" style={{ height: `${height}%` }} /></div>)}</div><div className="chart-axis"><span>Older</span><span>Recent</span></div></div>
            <div className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common developer tasks</p></div><Zap size={17} className="gold-icon" /></div><div className="quick-list"><button onClick={() => navigate("/collections?from=dashboard")}><span className="quick-icon green"><ArrowDownLeft size={17} /></span><span><strong>Collect payment</strong><small>Trigger an STK Push</small></span><ArrowUpRight size={15} /></button><button onClick={() => navigate("/collections?from=dashboard")}><span className="quick-icon blue"><Store size={17} /></span><span><strong>Pay to a Till</strong><small>Collect directly to PayBill or Buy Goods</small></span><ArrowUpRight size={15} /></button><button onClick={() => setActiveNav("Webhooks")}><span className="quick-icon purple"><Webhook size={17} /></span><span><strong>Configure webhook</strong><small>Receive event updates</small></span><ArrowUpRight size={15} /></button></div></div>
          </section>

          <section className="lower-grid">
            <div className="panel activity-panel tab-overview"><div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest direct Till collections</p></div><button className="panel-link" onClick={() => navigate("/collections?from=dashboard")}>View all <ArrowUpRight size={14} /></button></div><div className="activity-table"><div className="table-head"><span>Reference</span><span>Type</span><span>Amount</span><span>Status</span><span>Time</span><span /></div>{activities.length ? activities.map((tx) => { const payout = false; const status = String(tx.status ?? "PENDING"); const amount = Number(tx.amount ?? 0); const reference = String(tx.checkoutRequestId ?? tx.conversationId ?? tx.id ?? "—"); const detail = String(tx.phoneNumber ?? tx.recipientPhone ?? tx.accountReference ?? "—"); const displayStatus = status === "SUCCESS" ? "Success" : status === "FAILED" ? "Failed" : "Pending"; return <div className="table-row" key={`${tx.kind}-${tx.id}`}><div className="ref-cell"><div className={`tx-icon ${payout ? "payout" : "collection"}`}>{payout ? <Send size={14} /> : <ArrowDownLeft size={14} />}</div><div><strong>{reference}</strong><small>{detail}</small></div></div><span className="type-cell">STK Push / Till</span><strong className={payout ? "amount-negative" : "amount-positive"}>+ {money(amount)}</strong><StatusBadge status={displayStatus} /><span className="time-cell">{relativeTime(tx.createdAt)}</span><button className="row-more" aria-label={`More actions for ${reference}`}><MoreHorizontal size={16} /></button></div>; }) : <div className="live-empty">No M-PESA transactions yet. New activity will appear here automatically.</div>}</div></div>
            <div id="api-keys-panel" className="panel key-panel tab-api-keys"><div className="panel-heading"><div><h3>Developer API keys</h3><p>Create a secret key for server-side API requests.</p></div><KeyRound size={17} className="gold-icon" /></div><div className="key-access-note"><ShieldCheck size={15} /><div><strong>Use the secret key for live API calls</strong><span>Send it as <code>Authorization: Bearer sk_live_…</code> or the <code>x-api-key</code> header. The key is shown only once.</span></div></div><div className="key-preview"><div className="key-label"><span>{activeKey ? String(activeKey.name) : "No active key"}</span>{activeKey && <button onClick={() => { setRevokeKeyId(Number(activeKey.id)); setKeyConfirmation("revoke"); }}>Revoke</button>}</div><div className="secret-value">{newSecret ?? (activeKey ? `${String(activeKey.keyPrefix)}••••••••••••••••` : "Create a key to receive a secret")}{newSecret && <CopyButton value={newSecret} />}</div><div className="key-meta"><span><span className="live-dot" /> {activeKey ? "Active" : "Not configured"}</span><span>{activeKey ? `Created ${relativeTime(activeKey.createdAt)}` : "No keys created"}</span></div></div><div className="key-warning"><ShieldCheck size={16} /><span>Store the secret securely. It cannot be retrieved after this screen.</span></div><div className="key-create-row"><Input value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Key name, e.g. Production API" aria-label="New API key name" /><button className="secondary-button" disabled={createApiKey.isPending || keyName.trim().length < 2} onClick={() => setKeyConfirmation("create")}><Plus size={16} /> Create key</button></div></div>
          </section>

          <section id="tills-panel" className="panel tills-panel tab-tills">
            <div className="panel-heading"><div><h3>Payment destinations</h3><p>Add a user-owned Buy Goods Till or PayBill for API collections.</p></div><span className="till-count">{visibleTills.length} configured</span></div>
            <div className="till-list">{visibleTills.length ? visibleTills.map((till) => <div className="till-row" key={String(till.id)}><div className="till-icon"><Webhook size={15} /></div><div className="till-details"><strong>{String(till.name)}</strong><span>{String(till.paymentType ?? "BUY_GOODS") === "PAYBILL" ? "PayBill" : "Buy Goods Till"} · {String(till.tillNumber)}{till.location ? ` · ${String(till.location)}` : ""}</span></div><span className={`till-status ${Boolean(till.isActive) ? "active" : "inactive"}`}>{Boolean(till.isActive) ? "Active" : "Inactive"}</span><button className="row-more" aria-label={`Remove ${String(till.name)}`} onClick={() => deleteTill.mutate({ id: Number(till.id) })}><X size={14} /></button></div>) : <div className="till-empty">No payment destinations configured. Add a Buy Goods Till or PayBill to route API collections.</div>}</div>
            <div className="till-create-row"><select value={tillType} onChange={(event) => setTillType(event.target.value as "BUY_GOODS" | "PAYBILL")} aria-label="Payment destination type"><option value="BUY_GOODS">Buy Goods Till</option><option value="PAYBILL">PayBill</option></select><Input value={tillName} onChange={(event) => setTillName(event.target.value)} placeholder="Till name" aria-label="Till name" /><Input value={tillNumber} onChange={(event) => setTillNumber(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Till number" aria-label="Till number" inputMode="numeric" /><Input value={tillLocation} onChange={(event) => setTillLocation(event.target.value)} placeholder="Location (optional)" aria-label="Location (optional)" /><Input value={businessShortcode} onChange={(event) => setBusinessShortcode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder={tillType === "BUY_GOODS" ? "Go-Live shortcode" : "PayBill number"} aria-label={tillType === "BUY_GOODS" ? "Go-Live shortcode" : "PayBill number"} inputMode="numeric" /><button className="secondary-button" disabled={createTill.isPending || tillName.trim().length < 2 || !/^\d{5,8}$/.test(tillNumber) || (tillType === "BUY_GOODS" && !/^\d{5,8}$/.test(businessShortcode))} onClick={() => createTill.mutate({ name: tillName.trim(), tillNumber, location: tillLocation.trim() || undefined, paymentType: tillType, businessShortcode: tillType === "BUY_GOODS" ? businessShortcode : undefined })}><Plus size={16} /> Add destination</button></div>
            <div className="fee-note"><ShieldCheck size={15} /><span>Platform fee: KES 1 for payments up to KES 50, then 1.5%. It is charged from your dashboard wallet after a successful STK Push.</span></div>
          </section>

          <footer className="footer-note"><span><span className="footer-dot" /> All systems operational</span><span>LeeTec Engine v1.0 <span className="footer-sep">•</span> <button onClick={() => notify("Status page is opening soon")}>Status</button></span></footer>
        {keyConfirmation && <div className="crud-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setKeyConfirmation(null); setRevokeKeyId(null); } }}><div className="crud-modal key-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="key-confirm-title"><div className="modal-heading"><div><span className="modal-kicker">SECURITY CONFIRMATION</span><h2 id="key-confirm-title">{keyConfirmation === "create" ? "Create secret API key?" : "Revoke this API key?"}</h2><p>{keyConfirmation === "create" ? "A new live secret will be generated and shown once." : "Any integration using this key will immediately lose API access."}</p></div><button aria-label="Close confirmation" onClick={() => { setKeyConfirmation(null); setRevokeKeyId(null); }}><X size={18} /></button></div><div className="modal-note"><ShieldCheck size={16} /><span>{keyConfirmation === "create" ? "Store the sk_live_ secret securely. It cannot be retrieved after you leave this screen." : "Revocation is immediate and cannot be undone. Create a replacement key before revoking if your integration is still active."}</span></div><div className="modal-actions"><button className="secondary-button" onClick={() => { setKeyConfirmation(null); setRevokeKeyId(null); }}>Cancel</button><button className={keyConfirmation === "revoke" ? "danger-button" : "primary-button"} disabled={createApiKey.isPending || revokeApiKey.isPending} onClick={() => { if (keyConfirmation === "create") createApiKey.mutate({ name: keyName.trim() }); else if (revokeKeyId !== null) revokeApiKey.mutate({ id: revokeKeyId }); setKeyConfirmation(null); setRevokeKeyId(null); }}>{keyConfirmation === "create" ? "Create secret key" : "Revoke key"}</button></div></div></div>}
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={16} /> {toast}</div>}
    </div>
  );
}
