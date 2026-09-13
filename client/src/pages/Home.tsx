import { useEffect, useMemo, useState } from "react";
import SiteFooter from "@/components/SiteFooter";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Link2,
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
      { label: "Payment links", icon: Link2 },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "API keys", icon: KeyRound },
      { label: "Tills", icon: Store },
      { label: "Webhooks", icon: Webhook },
      { label: "Documentation", icon: BookOpen },
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
  return message || "Deposit request failed.";
}

function depositMutationError(error: unknown) {
  const candidate = error as { message?: unknown; data?: { code?: unknown; httpStatus?: unknown } } | null;
  return readableDepositError(candidate?.message);
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
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [depositPhone, setDepositPhone] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [walletHistoryTab, setWalletHistoryTab] = useState<"deposits" | "collections">("deposits");
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositNotice, setDepositNotice] = useState<string | null>(null);
  const [depositCheckoutId, setDepositCheckoutId] = useState<string | null>(null);
  const [paymentLinkAmount, setPaymentLinkAmount] = useState("");
  const [paymentLinkReference, setPaymentLinkReference] = useState("");
  const [paymentLink, setPaymentLink] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const { user, loading, refresh, logout } = useAuth();
  const overview = trpc.engine.overview.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 5000, refetchOnWindowFocus: true });
  const apiKeys = trpc.engine.listApiKeys.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const tills = trpc.engine.listTills.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const walletDeposits = trpc.engine.listWalletDeposits.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 5000, refetchIntervalInBackground: true, refetchOnWindowFocus: true });
  const tillTransactions = trpc.engine.listCollections.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 5000, refetchIntervalInBackground: true, refetchOnWindowFocus: true });
  const webhooks = trpc.engine.listWebhooks.useQuery(undefined, { enabled: Boolean(user), refetchOnWindowFocus: true });
  const mutationError = (error: unknown) => { const message = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? "Request failed. Please try again."); return message && message !== "undefined" ? message : "Request failed. Please try again."; };
  const createApiKey = trpc.engine.createApiKey.useMutation({ onSuccess: (result) => { setNewSecret(result.key); setShowSecret(true); setKeyName(""); apiKeys.refetch(); notify("API key created and securely stored"); }, onError: (error) => notify(mutationError(error), "error") });
  const revokeApiKey = trpc.engine.revokeApiKey.useMutation({ onSuccess: () => { apiKeys.refetch(); notify("API key revoked"); }, onError: (error) => notify(mutationError(error), "error") });
  const createTill = trpc.engine.createTill.useMutation({ onSuccess: () => { tills.refetch(); setTillNumber(""); setTillName(""); setTillLocation(""); setTillType("BUY_GOODS"); }, onError: (error) => notify(mutationError(error), "error") });
  const deleteTill = trpc.engine.deleteTill.useMutation({ onSuccess: () => { tills.refetch(); notify("Till removed"); }, onError: (error) => notify(mutationError(error), "error") });
  const createWebhook = trpc.engine.createWebhook.useMutation({ onSuccess: () => { webhooks.refetch(); setWebhookUrl(""); setWebhookSecret(""); setShowWebhookSecret(false); notify("Webhook endpoint added"); }, onError: (error) => notify(mutationError(error), "error") });
  const testWebhook = trpc.engine.testWebhook.useMutation({ onSuccess: (result) => { webhooks.refetch(); notify(result.message, result.status === "DELIVERED" ? "success" : "error"); }, onError: (error) => notify(mutationError(error), "error") });
  const deleteWebhook = trpc.engine.deleteWebhook.useMutation({ onSuccess: () => { webhooks.refetch(); notify("Webhook endpoint removed"); }, onError: (error) => notify(mutationError(error), "error") });
  const depositWallet = trpc.engine.depositWallet.useMutation({ onSuccess: () => { overview.refetch(); walletDeposits.refetch(); tillTransactions.refetch(); setDepositError(null); setDepositNotice("STK request accepted. Check the M-PESA phone now and enter your PIN. Your wallet updates only after Safaricom confirms payment."); notify("STK prompt request accepted"); }, onError: (error) => { const message = depositMutationError(error); setDepositNotice(null); setDepositError(message); notify("Deposit request failed — see the Wallet status panel"); } });
  const updateProfile = trpc.auth.updateProfile.useMutation({ onSuccess: async () => { await refresh(); setProfileOpen(false); notify("Profile updated"); }, onError: (error) => notify(mutationError(error), "error") });
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

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast(message);
    setToastTone(tone);
    window.setTimeout(() => setToast(null), 2600);
  };
  const live = overview.data ?? { balance: 0, collections: 0, payouts: 0, successRate: 0, activeKeys: 0, accountId: user?.accountId ?? "—", environment: "NOT_CONFIGURED", shortcode: null, transactions: [] };
  const activities = (live.transactions as Array<Record<string, unknown>>).filter((item) => item.kind !== "payout");
  const visibleKeys = (apiKeys.data ?? []) as Array<Record<string, unknown>>;
  const activeKey = visibleKeys.find((key) => Boolean(key.isActive));
  const recoverableKey = typeof activeKey?.key === "string" ? String(activeKey.key) : null;
  const displayedKey = newSecret ?? recoverableKey;
  const visibleTills = (tills.data ?? []) as Array<Record<string, unknown>>;
  const visibleDeposits = walletDeposits.data ?? [];
  const visibleTillTransactions = tillTransactions.data ?? [];
  const normalizedDepositPhone = normalizeDepositPhone(depositPhone);
  const handleNavigation = (label: string) => {
    setActiveNav(label);
    setMobileOpen(false);
    if (label === "Collections") navigate("/collections?from=dashboard");
    if (label === "Documentation") navigate("/docs");
    if (label === "Payment links") setPaymentLink(null);
    notify(`${label} opened`);
  };
  const submitWebhook = () => {
    const url = webhookUrl.trim();
    if (!/^https:\/\//i.test(url)) return notify("Webhook URL must start with https://", "error");
    if (webhookSecret.trim().length < 16) return notify("Webhook signing secret must be at least 16 characters", "error");
    createWebhook.mutate({ url, secret: webhookSecret.trim() });
  };
  const submitTill = () => {
    if (tillName.trim().length < 2) return notify("Enter a destination name with at least 2 characters", "error");
    if (!/^\d{5,8}$/.test(tillNumber)) return notify("Enter a valid 5–8 digit Till or PayBill number", "error");
    createTill.mutate({ name: tillName.trim(), tillNumber, location: tillLocation.trim() || undefined, paymentType: tillType });
  };
  const submitKey = () => {
    if (keyName.trim().length < 2) return notify("Enter an API key name with at least 2 characters", "error");
    setKeyConfirmation("create");
  };
  const submitDeposit = () => {
    if (!normalizedDepositPhone) return notify("Enter a valid Safaricom number: 07..., 011..., or 254...", "error");
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) return notify("Enter a deposit amount greater than zero", "error");
    if (amount > 1500000) return notify("Deposit amount cannot exceed KES 1,500,000", "error");
    depositWallet.mutate({ phoneNumber: normalizedDepositPhone, amount });
  };
  const generatePaymentLink = () => {
    const amountText = paymentLinkAmount.trim();
    const amount = Number(amountText);
    const reference = paymentLinkReference.trim() || `1LINK${Date.now().toString().slice(-8)}`;
    if (amountText && (!Number.isFinite(amount) || amount <= 0 || amount > 1500000)) return notify("Enter an amount between KES 1 and KES 1,500,000", "error");
    if (!/^1[A-Za-z0-9_-]{1,63}$/.test(reference)) return notify("Reference must start with 1 and contain only letters, numbers, _ or -", "error");
    const url = new URL("/collections", window.location.origin);
    url.searchParams.set("from", "payment-link");
    if (amountText) url.searchParams.set("amount", amount.toFixed(2));
    url.searchParams.set("reference", reference);
    setPaymentLink(url.toString());
    setPaymentLinkReference(reference);
    notify("Payment link generated");
  };
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
          <div className="workspace-copy"><strong>LeeTec workspace</strong><span>Payments workspace</span></div>
          <div className="workspace-switcher-meta"><span className="workspace-status"><span className="live-dot" /> Live</span><ChevronDown size={15} className="muted-icon" /></div>
        </div>

        <div className="sidebar-quick-actions">
          <button className="profile-row sidebar-profile" onClick={() => { setProfileName(user.name ?? ""); setProfileOpen(true); }}>
            <div className="profile-avatar">{user.name?.slice(0, 2).toUpperCase() ?? "ME"}</div>
            <div className="profile-copy"><strong>{user.name ?? "Developer"}</strong><span>{user.email ?? "Signed-in account"}</span></div>
            <MoreHorizontal size={17} className="muted-icon" />
          </button>
          <button className="nav-item sidebar-settings" onClick={() => { setProfileName(user.name ?? ""); setProfileOpen(true); }}><Settings2 size={17} /><span>Settings</span></button>
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
                    onClick={() => handleNavigation(item.label)}
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
          <a className="nav-item" href="https://wa.me/254116553618" target="_blank" rel="noreferrer"><CircleHelp size={17} /><span>Help center</span><ExternalLink size={13} className="external" /></a>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="breadcrumbs"><span className="breadcrumb-home"><LayoutDashboard size={13} /> Workspace</span><span className="slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <div className="search-wrap"><Search size={16} /><Input placeholder="Search workspace" aria-label="Search workspace" /><kbd>⌘ K</kbd></div>
            <button className="top-icon" aria-label="Notifications"><Bell size={18} /><span className="notification-dot" /></button>
            <button className="top-profile" aria-label="Open profile settings" onClick={() => { setProfileName(user.name ?? ""); setProfileOpen(true); }}><div className="profile-avatar small">{user.name?.slice(0, 2).toUpperCase() ?? "ME"}</div><span className="top-profile-name">{user.name?.split(" ")[0] ?? "Account"}</span><ChevronDown size={14} /></button>
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
            <div className="wallet-deposit-form"><label className="wallet-form-field"><span>M-PESA number</span><Input value={depositPhone} onChange={(event) => setDepositPhone(event.target.value.replace(/[^\d+\s()-]/g, "").slice(0, 20))} placeholder="07..., 011..., or 254..." aria-label="M-PESA phone number" inputMode="tel" autoComplete="tel" /><small>Accepted: 07XXXXXXXX, 011XXXXXXXX, or 254XXXXXXXXX</small></label><label className="wallet-form-field"><span>Deposit amount</span><Input value={depositAmount} onChange={(event) => setDepositAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount in KES" aria-label="Wallet deposit amount" inputMode="decimal" min="1" max="1500000" /><small>Wallet credit follows the confirmed M-PESA callback.</small></label><button className="primary-button" disabled={depositWallet.isPending} onClick={submitDeposit}><WalletCards size={16} /> {depositWallet.isPending ? "Sending…" : "Deposit wallet"}</button></div>
            {(depositWallet.isPending || depositNotice || depositError || depositCheckoutId) && <div className={`deposit-flow-status ${depositError ? "error" : depositWallet.isPending || depositCheckoutId ? "pending" : "success"}`} role="status"><div className="deposit-flow-icon">{depositError ? <XCircle size={16} /> : depositWallet.isPending || depositCheckoutId ? <Activity size={16} /> : <CheckCircle2 size={16} />}</div><div><strong>{depositError ? "Deposit request failed" : depositWallet.isPending ? "Sending STK prompt…" : depositCheckoutId ? "Waiting for M-PESA confirmation…" : "M-PESA payment confirmed"}</strong><span>{depositError ?? (depositCheckoutId ? "Daraja accepted the request. The prompt must now be delivered to an active Safaricom M-PESA line." : depositNotice)}</span></div>{(depositError || depositNotice) && <button aria-label="Dismiss deposit status" onClick={() => { setDepositError(null); setDepositNotice(null); }}><X size={15} /></button>}</div>}
            <div className="wallet-history"><div className="wallet-history-tabs"><button className={walletHistoryTab === "deposits" ? "active" : ""} onClick={() => setWalletHistoryTab("deposits")}>Wallet STK requests <span>{visibleDeposits.length}</span></button><button className={walletHistoryTab === "collections" ? "active" : ""} onClick={() => setWalletHistoryTab("collections")}>Direct Till collections <span>{visibleTillTransactions.length}</span></button></div>{walletHistoryTab === "deposits" ? <div className="wallet-history-list">{visibleDeposits.length ? visibleDeposits.map((deposit) => { const status = String(deposit.status); const statusLabel = status === "SUCCESS" ? "Credited" : status === "FAILED" ? "Failed" : "Pending"; return <div className="wallet-history-row" key={String(deposit.id)}><div><strong>{money(Number(deposit.amount))}</strong><small>{String(deposit.phoneNumber)} · {depositDetail(deposit)} · Checkout {String(deposit.checkoutRequestId)}</small></div><span className={`deposit-status ${status.toLowerCase()}`}>{statusLabel}</span><small>{new Date(String(deposit.createdAt)).toLocaleString()}</small></div>; }) : <div className="wallet-history-empty">Wallet STK requests will appear here after you submit them.</div>}</div> : <div className="wallet-history-list">{visibleTillTransactions.length ? visibleTillTransactions.map((transaction) => <div className="wallet-history-row" key={String(transaction.id)}><div><strong>{money(Number(transaction.amount))}</strong><small>{String(transaction.tillName ?? "Platform Till")} · {String(transaction.tillNumber ?? "Primary shortcode")} · {String(transaction.accountReference)} · Fee {money(Number(transaction.platformFee ?? 0))} · Net {money(Number(transaction.netAmount ?? transaction.amount))}</small></div><span className={`deposit-status ${String(transaction.status).toLowerCase()}`}>{String(transaction.status) === "SUCCESS" ? "Settled" : String(transaction.status)}</span><small>{new Date(String(transaction.createdAt)).toLocaleString()}</small></div>) : <div className="wallet-history-empty">No direct Till collections yet.</div>}</div>}</div>
          </section>

          <section className="panel webhook-panel tab-webhooks"><div className="panel-heading"><div><h3>Webhook endpoints</h3><p>Send your payment events to a server you control.</p></div><Webhook size={18} className="gold-icon" /></div><div className="key-access-note"><ShieldCheck size={15} /><div><strong>Protect your webhook secret</strong><span>LeeTec stores the secret encrypted. Use it to verify signatures in your application. It is never shown again after submission.</span></div></div><div className="webhook-list">{(webhooks.data ?? []).length ? (webhooks.data ?? []).map((hook) => <div className="webhook-row" key={String(hook.id)}><div className="till-details"><strong>{String(hook.url)}</strong><span><span className="live-dot" /> Active · Created {relativeTime(hook.createdAt)}</span><small className={hook.lastDeliveryStatus === "DELIVERED" ? "webhook-delivery-ok" : hook.lastDeliveryStatus === "FAILED" ? "webhook-delivery-failed" : "webhook-delivery-none"}>{hook.lastDeliveryStatus ? `Last delivery: ${String(hook.lastDeliveryStatus)}${hook.lastStatusCode ? ` · HTTP ${String(hook.lastStatusCode)}` : ""}` : "No delivery tested yet"}</small></div><div className="webhook-row-actions"><button className="secondary-button" disabled={testWebhook.isPending} onClick={() => testWebhook.mutate({ id: Number(hook.id) })}>Test delivery</button><button className="danger-button" onClick={() => { if (window.confirm("Remove this webhook endpoint?")) deleteWebhook.mutate({ id: Number(hook.id) }); }}>Remove</button></div></div>) : <div className="till-empty">No webhook endpoints configured yet.</div>}</div><div className="webhook-create-row"><Input value={webhookUrl} onChange={(event) => setWebhookUrl(event.target.value)} placeholder="https://your-domain.com/webhooks/leetec" aria-label="Webhook URL" type="url" /><div className="secret-input-wrap"><Input value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} placeholder="Signing secret (16+ characters)" aria-label="Webhook signing secret" type={showWebhookSecret ? "text" : "password"} /><button type="button" className="secret-toggle" aria-label={showWebhookSecret ? "Hide webhook secret" : "Show webhook secret"} onClick={() => setShowWebhookSecret((value) => !value)}>{showWebhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button></div><button className="secondary-button" disabled={createWebhook.isPending} onClick={submitWebhook}><Plus size={16} /> Add webhook</button></div><div className="fee-note"><ShieldCheck size={15} /><span>Use HTTPS in production. Your endpoint should return a 2xx response quickly and process events asynchronously.</span></div></section>
          <section className="panel payment-links-panel tab-payment-links"><div className="panel-heading"><div><div className="panel-kicker">SHAREABLE COLLECTIONS <span className="eyebrow-line" /></div><h3>Generate a payment link</h3><p>Create a secure collection page with a fixed amount or let the payer enter the amount.</p></div><Link2 size={18} className="gold-icon" /></div><div className="key-access-note"><ShieldCheck size={15} /><div><strong>Flexible payment requests</strong><span>Amount is optional. Leave it blank for a payer-entered amount; a signed-in workspace user still confirms the Kenyan M-PESA number before sending the STK prompt.</span></div></div><div className="webhook-create-row payment-link-form"><Input value={paymentLinkAmount} onChange={(event) => setPaymentLinkAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Amount in KES (optional)" aria-label="Optional payment link amount" inputMode="decimal" /><Input value={paymentLinkReference} onChange={(event) => setPaymentLinkReference(event.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64))} placeholder="Reference e.g. 1ORDER1001" aria-label="Payment link reference" /><button className="primary-button" onClick={generatePaymentLink}><Link2 size={16} /> Generate link</button></div>{paymentLink && <div className="generated-link-card"><div><strong>Ready to share</strong><span>{paymentLink}</span></div><CopyButton value={paymentLink} /><button className="secondary-button" onClick={() => window.open(paymentLink, "_blank", "noopener,noreferrer")}><ExternalLink size={15} /> Open form</button></div>}</section>

          <section className="dashboard-grid tab-overview">
            <div className="panel volume-panel"><div className="panel-heading"><div><h3>Transaction volume</h3><p>Gross collection value processed across your tills</p></div><div className="period-select">All recorded data <ChevronDown size={14} /></div></div><div className="chart-summary"><div><strong>{money(live.collections)}</strong><span>Direct Till collections</span></div><div className="legend"><span><i className="legend-dot collections" /> Collections</span></div></div><div className="bar-chart" aria-label="Transaction volume chart">{chartBars.map((height, index) => <div className="bar-column" key={index}><div className="bar collections" style={{ height: `${height}%` }} /></div>)}</div><div className="chart-axis"><span>Older</span><span>Recent</span></div></div>
            <div className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Common developer tasks</p></div><Zap size={17} className="gold-icon" /></div><div className="quick-list"><button onClick={() => navigate("/collections?from=dashboard")}><span className="quick-icon green"><ArrowDownLeft size={17} /></span><span><strong>Collect payment</strong><small>Trigger an STK Push</small></span><ArrowUpRight size={15} /></button><button onClick={() => navigate("/collections?from=dashboard")}><span className="quick-icon blue"><Store size={17} /></span><span><strong>Pay to a Till</strong><small>Collect directly to PayBill or Buy Goods</small></span><ArrowUpRight size={15} /></button></div></div>
          </section>

          <section className="lower-grid">
            <div className="panel activity-panel tab-overview"><div className="panel-heading"><div><h3>Recent activity</h3><p>Your latest direct Till collections</p></div><button className="panel-link" onClick={() => navigate("/collections?from=dashboard")}>View all <ArrowUpRight size={14} /></button></div><div className="activity-table"><div className="table-head"><span>Reference</span><span>Type</span><span>Amount</span><span>Status</span><span>Time</span><span /></div>{activities.length ? activities.map((tx) => { const payout = false; const status = String(tx.status ?? "PENDING"); const amount = Number(tx.amount ?? 0); const reference = String(tx.checkoutRequestId ?? tx.conversationId ?? tx.id ?? "—"); const detail = String(tx.phoneNumber ?? tx.recipientPhone ?? tx.accountReference ?? "—"); const displayStatus = status === "SUCCESS" ? "Success" : status === "FAILED" ? "Failed" : "Pending"; return <div className="table-row" key={`${tx.kind}-${tx.id}`}><div className="ref-cell"><div className={`tx-icon ${payout ? "payout" : "collection"}`}>{payout ? <Send size={14} /> : <ArrowDownLeft size={14} />}</div><div><strong>{reference}</strong><small>{detail}</small></div></div><span className="type-cell">STK Push / Till</span><strong className={payout ? "amount-negative" : "amount-positive"}>+ {money(amount)}</strong><StatusBadge status={displayStatus} /><span className="time-cell">{relativeTime(tx.createdAt)}</span><button className="row-more" aria-label={`More actions for ${reference}`}><MoreHorizontal size={16} /></button></div>; }) : <div className="live-empty">No M-PESA transactions yet. New activity will appear here automatically.</div>}</div></div>
            <div id="api-keys-panel" className="panel key-panel tab-api-keys"><div className="panel-heading"><div><h3>Developer API keys</h3><p>Create a secret key for server-side API requests.</p></div><KeyRound size={17} className="gold-icon" /></div><div className="key-access-note"><ShieldCheck size={15} /><div><strong>Use the secret key for live API calls</strong><span>Send it as <code>Authorization: Bearer sk_live_…</code> or the <code>x-api-key</code> header. New keys are encrypted for owner-only recovery.</span></div></div><div className="key-preview"><div className="key-label"><span>{activeKey ? String(activeKey.name) : "No active key"}</span>{activeKey && <button onClick={() => { setRevokeKeyId(Number(activeKey.id)); setKeyConfirmation("revoke"); }}>Revoke</button>}</div><div className="secret-value">{displayedKey ? (showSecret ? displayedKey : "sk_live_••••••••••••••••") : (activeKey ? `${String(activeKey.keyPrefix)}••••••••••••••••` : "Create a key to receive a secret")}{displayedKey && <><button type="button" className="secret-toggle" aria-label={showSecret ? "Hide API key" : "Show API key"} onClick={() => setShowSecret((value) => !value)}>{showSecret ? <EyeOff size={15} /> : <Eye size={15} />}</button><CopyButton value={displayedKey} /></>}</div><div className="key-meta"><span><span className="live-dot" /> {activeKey ? "Active" : "Not configured"}</span><span>{activeKey ? `Created ${relativeTime(activeKey.createdAt)}` : "No keys created"}</span></div></div><div className="key-history-list"><div className="key-history-heading"><strong>All API keys</strong><span>{visibleKeys.length} total</span></div>{visibleKeys.length ? visibleKeys.map((key) => <div className="key-history-row" key={String(key.id)}><div><strong>{String(key.name ?? "Unnamed key")}</strong><small>{String(key.keyPrefix ?? "sk_live_")}•••••••• · Created {relativeTime(key.createdAt)}</small></div><span className={`till-status ${Boolean(key.isActive) ? "active" : "inactive"}`}>{Boolean(key.isActive) ? "Active" : "Revoked"}</span></div>) : <div className="till-empty">No API keys have been created.</div>}</div><div className="key-warning"><ShieldCheck size={16} /><span>{activeKey && !recoverableKey && !newSecret ? "This is a legacy key created before recovery was enabled. Create a replacement key to enable eye reveal and copy anytime." : "Encrypted owner-only recovery is enabled. Use the eye to reveal the key and copy it whenever needed."}</span></div><div className="key-create-row"><Input value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Key name, e.g. Production API" aria-label="New API key name" /><button className="secondary-button" disabled={createApiKey.isPending} onClick={submitKey}><Plus size={16} /> Create key</button></div></div>
          </section>

          <section id="tills-panel" className="panel tills-panel tab-tills">
            <div className="panel-heading"><div><h3>Payment destinations</h3><p>Add a user-owned Buy Goods Till or PayBill for API collections.</p></div><span className="till-count">{visibleTills.length} configured</span></div>
            <div className="till-list">{visibleTills.length ? visibleTills.map((till) => <div className="till-row" key={String(till.id)}><div className="till-icon"><Webhook size={15} /></div><div className="till-details"><strong>{String(till.name)}</strong><span>{String(till.paymentType ?? "BUY_GOODS") === "PAYBILL" ? "PayBill" : "Buy Goods Till"} · {String(till.tillNumber)}{till.location ? ` · ${String(till.location)}` : ""}</span></div><span className={`till-status ${Boolean(till.isActive) ? "active" : "inactive"}`}>{Boolean(till.isActive) ? "Active" : "Inactive"}</span><button className="row-more" aria-label={`Remove ${String(till.name)}`} onClick={() => deleteTill.mutate({ id: Number(till.id) })}><X size={14} /></button></div>) : <div className="till-empty">No payment destinations configured. Add a Buy Goods Till or PayBill to route API collections.</div>}</div>
            <div className="till-create-row"><select value={tillType} onChange={(event) => setTillType(event.target.value as "BUY_GOODS" | "PAYBILL")} aria-label="Payment destination type"><option value="BUY_GOODS">Buy Goods Till</option><option value="PAYBILL">PayBill</option></select><Input value={tillName} onChange={(event) => setTillName(event.target.value)} placeholder="Till name" aria-label="Till name" /><Input value={tillNumber} onChange={(event) => setTillNumber(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Till or PayBill number" aria-label="Till or PayBill number" inputMode="numeric" /><Input value={tillLocation} onChange={(event) => setTillLocation(event.target.value)} placeholder="Location (optional)" aria-label="Location (optional)" /><button className="secondary-button" disabled={createTill.isPending} onClick={submitTill}><Plus size={16} /> Add destination</button></div>
            <div className="fee-note"><ShieldCheck size={15} /><span>Platform fee: KES 1 for payments up to KES 50, then 1.5%. It is charged from your dashboard wallet after a successful STK Push.</span></div>
          </section>

          <SiteFooter />
          <footer className="footer-note"><span><span className="footer-dot" /> All systems operational</span><span>LeeTec Engine v1.0 <span className="footer-sep">•</span> <button onClick={() => notify("Status page is opening soon")}>Status</button></span></footer>
        {profileOpen && <div className="crud-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><div className="crud-modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title"><div className="modal-heading"><div><span className="modal-kicker">WORKSPACE SETTINGS</span><h2 id="profile-title">Profile & account</h2><p>Keep your workspace identity and session controls up to date.</p></div><button aria-label="Close profile settings" onClick={() => setProfileOpen(false)}><X size={18} /></button></div><div className="profile-summary"><div className="profile-avatar large">{user.name?.slice(0, 2).toUpperCase() ?? "ME"}</div><div><strong>{user.name ?? "Developer"}</strong><span>{user.email ?? "No email"}</span><small>Account #{user.accountId ?? "—"} · {user.role === "admin" ? "Administrator" : "Developer"}</small></div></div><div className="form-grid profile-form"><label>Display name<Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your full name" autoComplete="name" /></label><label>Email address<Input value={user.email ?? ""} readOnly disabled /></label></div><div className="modal-note"><ShieldCheck size={16} /><span>Your email and role are managed securely by the account system. Only your display name can be changed here.</span></div><div className="modal-actions"><button className="danger-button" onClick={async () => { await logout(); navigate("/"); }}>Sign out</button><span className="modal-actions-spacer" /><button className="secondary-button" onClick={() => setProfileOpen(false)}>Cancel</button><button className="primary-button" disabled={updateProfile.isPending || profileName.trim().length < 2} onClick={() => updateProfile.mutate({ name: profileName.trim() })}>{updateProfile.isPending ? "Saving…" : "Save profile"}</button></div></div></div>}
        {keyConfirmation && <div className="crud-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setKeyConfirmation(null); setRevokeKeyId(null); } }}><div className="crud-modal key-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="key-confirm-title"><div className="modal-heading"><div><span className="modal-kicker">SECURITY CONFIRMATION</span><h2 id="key-confirm-title">{keyConfirmation === "create" ? "Create secret API key?" : "Revoke this API key?"}</h2><p>{keyConfirmation === "create" ? "The encrypted secret will remain available to you with eye reveal and copy controls." : "Any integration using this key will immediately lose API access."}</p></div><button aria-label="Close confirmation" onClick={() => { setKeyConfirmation(null); setRevokeKeyId(null); }}><X size={18} /></button></div><div className="modal-note"><ShieldCheck size={16} /><span>{keyConfirmation === "create" ? "Your key is encrypted at rest and can be revealed or copied later from this workspace." : "Revocation is immediate and cannot be undone. Create a replacement key before revoking if your integration is still active."}</span></div><div className="modal-actions"><button className="secondary-button" onClick={() => { setKeyConfirmation(null); setRevokeKeyId(null); }}>Cancel</button><button className={keyConfirmation === "revoke" ? "danger-button" : "primary-button"} disabled={createApiKey.isPending || revokeApiKey.isPending} onClick={() => { if (keyConfirmation === "create") createApiKey.mutate({ name: keyName.trim() }); else if (revokeKeyId !== null) revokeApiKey.mutate({ id: revokeKeyId }); setKeyConfirmation(null); setRevokeKeyId(null); }}>{keyConfirmation === "create" ? "Create secret key" : "Revoke key"}</button></div></div></div>}
        </div>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
        <button className={activeNav === "Overview" ? "active" : ""} onClick={() => setActiveNav("Overview")}><LayoutDashboard size={20} /><span>Home</span></button>
        <button className={activeNav === "Collections" ? "active" : ""} onClick={() => navigate("/collections?from=dashboard")}><ArrowDownLeft size={20} /><span>Accounts</span></button>
        <button className={activeNav === "Payment links" ? "active" : ""} onClick={() => setActiveNav("Payment links")}><Link2 size={20} /><span>Links</span></button>
        <button className={activeNav === "Wallet" ? "active" : ""} onClick={() => setActiveNav("Wallet")}><WalletCards size={20} /><span>Wallet</span></button>
        <a href="https://wa.me/254116553618" target="_blank" rel="noreferrer"><CircleHelp size={20} /><span>WhatsApp</span></a>
        <button onClick={() => notify("Settings are available from the dashboard workspace menu")}><Settings2 size={20} /><span>Settings</span></button>
      </nav>
      {toast && <div className={`toast ${toastTone === "error" ? "toast-error" : "toast-success"}`} role="alert">{toastTone === "error" ? <XCircle size={16} /> : <CheckCircle2 size={16} />} {toast}</div>}
    </div>
  );
}
