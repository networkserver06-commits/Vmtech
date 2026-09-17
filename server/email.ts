import { ENV } from "./_core/env.js";

const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
const appUrl = () => (ENV.appUrl.trim() || "https://leetec.online").replace(/\/$/, "");

function brandedEmail(title: string, preheader: string, content: string) {
  return `<!doctype html><html><head><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"></head><body style="margin:0;background:#0b1117;color:#eef2f4;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b1117"><tr><td align="center" style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border:1px solid #26343d;border-radius:16px;overflow:hidden;background:#101820"><tr><td style="padding:24px 28px;background:linear-gradient(135deg,#1e321f,#101820);border-bottom:1px solid #33443a"><div style="font-size:18px;font-weight:700;color:#f6f8f6"><span style="display:inline-block;padding:6px 8px;border-radius:8px;background:#c5f56e;color:#17200f;margin-right:8px">⚡</span>LeeTec <span style="color:#9aa8ad;font-weight:400">Engine</span></div><div style="margin-top:8px;color:#a7c56c;font-size:11px;letter-spacing:1.4px;text-transform:uppercase">Secure M-PESA infrastructure</div></td></tr><tr><td style="padding:30px 28px"><h1 style="margin:0 0 14px;color:#f1f5f4;font-size:26px;line-height:1.2">${title}</h1>${content}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #26343d;color:#71818a;font-size:11px;line-height:1.6">Powered by <strong style="color:#c5f56e">LeeTec Engine</strong><br>Secure payment operations for modern businesses.</td></tr></table></td></tr></table></body></html>`;
}

export function buildVerificationEmail(token: string) {
  const verificationUrl = `${appUrl()}/api/auth/verify?token=${encodeURIComponent(token)}`;
  return brandedEmail("Verify your email address", "Confirm your LeeTec Engine email address to secure your workspace.", `<p style="margin:0 0 18px;color:#aab8bd;font-size:15px;line-height:1.7">Welcome to LeeTec Engine. Confirm your email to keep your workspace account secure.</p><p style="margin:0 0 24px"><a href="${verificationUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#c5f56e;color:#17200f;text-decoration:none;font-weight:700;font-size:14px">Verify email address</a></p><p style="margin:0;color:#71818a;font-size:12px;line-height:1.6">This verification link expires in 30 minutes. If you did not create this account, you can safely ignore this message.</p>`);
}

export function buildPayoutAdminEmail(input: { userName: string; userEmail: string; amount: number; destinationType: string; destination: string; requestCount?: number }) {
  const countLabel = input.requestCount && input.requestCount > 1 ? `${input.requestCount} payout requests` : "Payout request";
  return brandedEmail("New payout request", `${countLabel} submitted by ${input.userName}.`, `<p style="margin:0 0 18px;color:#aab8bd;font-size:15px;line-height:1.7">A customer has requested a payout and it is ready for admin review.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #2a3a43;border-radius:10px;background:#141e27"><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Customer</td><td style="padding:12px 14px;color:#eef2f4;font-size:12px;text-align:right">${escapeHtml(input.userName)}</td></tr><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Email</td><td style="padding:12px 14px;color:#eef2f4;font-size:12px;text-align:right">${escapeHtml(input.userEmail)}</td></tr><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Amount</td><td style="padding:12px 14px;color:#c5f56e;font-size:14px;font-weight:700;text-align:right">KES ${input.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td></tr><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Destination</td><td style="padding:12px 14px;color:#eef2f4;font-size:12px;text-align:right">${escapeHtml(input.destinationType)} · ${escapeHtml(input.destination)}</td></tr></table><p style="margin:22px 0 0"><a href="${appUrl()}/admin" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#c5f56e;color:#17200f;text-decoration:none;font-weight:700;font-size:13px">Open admin review</a></p>`);
}

async function sendResendEmail(input: { to: string[]; subject: string; html: string }) {
  const apiKey = ENV.resendApiKey.trim();
  const from = ENV.resendFromEmail.trim();
  if (!apiKey || !from) throw new Error("Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }) });
  if (!response.ok) {
    let providerMessage = "";
    try { const body = await response.json() as { message?: string; name?: string }; providerMessage = body.message || body.name || ""; } catch { /* preserve a stable provider error */ }
    throw new Error(providerMessage ? `Unable to send email: ${providerMessage}` : "Unable to send email");
  }
}

export async function sendVerificationEmail(email: string, token: string) {
  await sendResendEmail({ to: [email], subject: "Verify your LeeTec Engine email", html: buildVerificationEmail(token) });
}

export async function notifyAdminsOfPayoutRequest(input: { userName: string; userEmail: string; amount: number; destinationType: string; destination: string; requestCount?: number }) {
  const recipients = ENV.adminEmails;
  if (!recipients.length) return { sent: false, reason: "No admin email is configured" };
  await sendResendEmail({ to: recipients, subject: `LeeTec payout request · KES ${input.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`, html: buildPayoutAdminEmail(input) });
  return { sent: true, recipients: recipients.length };
}

export function buildPayoutUserEmail(input: { userName: string; amount: number; destinationType: string; destination: string; status: "REQUESTED" | "APPROVED" | "REJECTED"; adminNote?: string | null }) {
  const statusCopy = input.status === "APPROVED" ? "Payout approved ✅" : input.status === "REJECTED" ? "Payout request update" : "Payout request received";
  const detail = input.status === "APPROVED" ? "Your payout request has been approved and received for processing by the LeeTec operations team." : input.status === "REJECTED" ? "Your payout request was not approved. Please review the note below or contact support." : "Your payout request has been received and is waiting for admin review.";
  return brandedEmail(statusCopy, `Your LeeTec payout request for KES ${input.amount.toFixed(2)} is ${input.status.toLowerCase()}.`, `<p style="margin:0 0 18px;color:#aab8bd;font-size:15px;line-height:1.7">Hi ${escapeHtml(input.userName)}, ${detail}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #2a3a43;border-radius:10px;background:#141e27"><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Amount requested</td><td style="padding:12px 14px;color:#c5f56e;font-size:14px;font-weight:700;text-align:right">KES ${input.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</td></tr><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Payout method</td><td style="padding:12px 14px;color:#eef2f4;font-size:12px;text-align:right">${escapeHtml(input.destinationType)} · ${escapeHtml(input.destination)}</td></tr><tr><td style="padding:12px 14px;color:#82939b;font-size:12px">Status</td><td style="padding:12px 14px;color:#c5f56e;font-size:12px;font-weight:700;text-align:right">${escapeHtml(input.status)}</td></tr></table>${input.adminNote ? `<p style="margin:18px 0 0;color:#aab8bd;font-size:12px;line-height:1.6"><strong style="color:#eef2f4">Admin note:</strong> ${escapeHtml(input.adminNote)}</p>` : ""}<p style="margin:22px 0 0;color:#71818a;font-size:12px;line-height:1.6">You can view the latest payout status from your LeeTec workspace.</p>`);
}

export async function notifyUserOfPayoutStatus(email: string, input: { userName: string; amount: number; destinationType: string; destination: string; status: "REQUESTED" | "APPROVED" | "REJECTED"; adminNote?: string | null }) {
  await sendResendEmail({ to: [email], subject: `LeeTec payout ${input.status.toLowerCase()} · KES ${input.amount.toLocaleString("en-KE", { minimumFractionDigits: 2 })}`, html: buildPayoutUserEmail(input) });
  return { sent: true };
}
