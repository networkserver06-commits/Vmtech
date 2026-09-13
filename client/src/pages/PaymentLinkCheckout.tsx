import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CheckCircle2, ShieldCheck, XCircle, Zap } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";

function normalizePhone(value: string) {
  const digits = value.trim().replace(/[^\d+]/g, "").replace(/^\+/, "");
  const normalized = digits.startsWith("254") ? digits : /^(?:07|01)\d{8}$/.test(digits) ? `254${digits.slice(1)}` : "";
  return /^254\d{9}$/.test(normalized) ? normalized : "";
}

export default function PaymentLinkCheckout() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const merchantSlug = pathParts[0] === "pay" ? (pathParts[1] ?? "").trim().toLowerCase() : "";
  const reference = params.get("reference") ?? `1LINK${Date.now().toString().slice(-8)}`;
  const fixedAmount = params.get("amount") ?? "";
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(fixedAmount);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status?: string; message?: string; checkoutRequestId?: string; requestRecorded?: boolean; failureReason?: string | null; mpesaReceipt?: string | null } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const checkoutRequestId = result?.checkoutRequestId;
    if (!checkoutRequestId || !["PENDING", "PROCESSING"].includes(String(result.status ?? "PENDING").toUpperCase())) return;
    let attempts = 0;
    const poll = async () => {
      try {
        const response = await fetch(`/api/v1/payment-links/status?slug=${encodeURIComponent(merchantSlug)}&checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`, { cache: "no-store" });
        if (!response.ok) return;
        const status = await response.json();
        setResult((current) => current ? { ...current, ...status } : current);
      } catch { /* Continue polling; the callback remains authoritative. */ }
    };
    void poll();
    const timer = window.setInterval(() => { attempts += 1; if (attempts >= 30) window.clearInterval(timer); else void poll(); }, 2000);
    return () => window.clearInterval(timer);
  }, [merchantSlug, result?.checkoutRequestId, result?.status]);

  const submit = async () => {
    setError(null); setResult(null);
    const phoneNumber = normalizePhone(phone);
    const numericAmount = Number(amount);
    if (!phoneNumber) return setError("Enter a valid Kenyan number: 07…, 01…, +254…, or 254….");
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1500000) return setError("Enter an amount between KES 1 and KES 1,500,000.");
    if (!merchantSlug) return setError("This payment link is incomplete or unavailable. Ask the merchant for a new link.");
    setPending(true);
    try {
      const merchantQuery = `slug=${encodeURIComponent(merchantSlug)}`;
      const response = await fetch(`/api/v1/payment-links/stkpush?${merchantQuery}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber, amount: numericAmount, accountReference: reference }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(response.status === 404 ? "This payment link is unavailable. The merchant may have disabled or deleted it." : String(body.error ?? body.message ?? "Payment request failed. Please try again."));
      setResult(body); setPhone("");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Payment request failed. Please try again."); }
    finally { setPending(false); }
  };

  const status = String(result?.status ?? "PENDING").toUpperCase();
  const finalStatus = status === "SUCCESS" || status === "FAILED" || status === "CANCELLED";
  const statusTitle = status === "SUCCESS" ? "Payment successful" : status === "FAILED" ? "Payment failed" : status === "CANCELLED" ? "Payment cancelled" : "Prompt sent successfully";
  const statusMessage = status === "SUCCESS" ? `Payment received successfully${result?.mpesaReceipt ? ` · Receipt ${result.mpesaReceipt}` : ""}.` : status === "FAILED" ? (result?.failureReason ?? "The payment was not completed. Please try again.") : status === "CANCELLED" ? "The M-PESA prompt was cancelled on the phone." : "Check the M-PESA phone and enter your PIN. We will update this page when Safaricom confirms the payment.";
  return <div className="public-checkout-shell"><main className="public-checkout-card"><header className="public-checkout-brand"><span className="brand-mark"><Zap size={18} /></span><span className="brand-name">LeeTec <span>Pay</span></span></header><div className="public-checkout-kicker"><span className="live-dot" /> SECURE PAYMENT CHECKOUT</div><h1>Complete your payment</h1><p className="public-checkout-intro">Enter the M-PESA number that should receive the payment prompt. Your payment is handled securely by LeeTec.</p><div className="public-payment-summary"><span>Payment reference</span><strong>{reference}</strong></div><div className="public-checkout-form"><label className={error && !normalizePhone(phone) ? "field-error" : ""}><span>M-PESA phone number</span><input value={phone} onChange={(event) => { setPhone(event.target.value.replace(/[^\d+\s()-]/g, "").slice(0, 20)); setError(null); }} inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX or 2547XX XXX XXX" aria-label="M-PESA phone number" />{error && !normalizePhone(phone) && <small className="input-error">{error}</small>}</label><label className={error && normalizePhone(phone) ? "field-error" : ""}><span>Amount (KES)</span><input value={amount} onChange={(event) => { if (!fixedAmount) setAmount(event.target.value.replace(/[^\d.]/g, "")); setError(null); }} inputMode="decimal" type="number" min="1" max="1500000" readOnly={Boolean(fixedAmount)} placeholder="Enter amount" aria-label="Payment amount" />{fixedAmount ? <small className="field-help">Amount set by the merchant.</small> : <small className="field-help">Enter between KES 1 and KES 1,500,000.</small>}</label><button className="primary-button public-checkout-submit" disabled={pending} onClick={submit}>{pending ? <><Activity size={17} /> Sending secure prompt…</> : <>Send M-PESA prompt <ArrowRight size={17} /></>}</button></div>{error && normalizePhone(phone) && <div className="checkout-response error" role="alert"><XCircle size={18} /><span>{error}</span></div>}{result && <div className={`checkout-response ${status === "SUCCESS" ? "success" : finalStatus ? "error" : "success"}`} role="status">{status === "SUCCESS" ? <CheckCircle2 size={18} /> : finalStatus ? <XCircle size={18} /> : <Activity size={18} />}<div><strong>{statusTitle}</strong><span>{statusMessage} Request ID: {result.checkoutRequestId ?? "recorded"}</span></div></div>}<div className="public-checkout-note"><ShieldCheck size={16} /><span>Never share your M-PESA PIN. Payment status is confirmed after the Safaricom callback.</span></div></main><SiteFooter /></div>;
}
