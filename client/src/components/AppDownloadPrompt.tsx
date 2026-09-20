import { Download, Smartphone, X } from "lucide-react";
import { useEffect, useState } from "react";

const APK_URL = "/leetec-engine.apk";
const DISMISS_KEY = "leetec-app-download-dismissed";

export default function AppDownloadPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    if (!dismissed) {
      const timer = window.setTimeout(() => setOpen(true), 1400);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setOpen(false);
    window.localStorage.setItem(DISMISS_KEY, "1");
  };

  if (!open) return null;

  return (
    <div className="app-download-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <section className="app-download-modal" role="dialog" aria-modal="true" aria-labelledby="app-download-title">
        <button className="app-download-close" type="button" aria-label="Dismiss app download prompt" onClick={dismiss}><X size={17} /></button>
        <div className="app-download-icon"><Smartphone size={22} /></div>
        <span className="modal-kicker">LEE TEC ENGINE MOBILE</span>
        <h2 id="app-download-title">Take your payment workspace with you.</h2>
        <p>Install the LeeTec Engine Android app for quick access to collections, payouts, wallet activity, and connection health on the go.</p>
        <div className="app-download-actions">
          <a className="primary-button" href={APK_URL} download="leetec-engine.apk"><Download size={16} /> Download Android app</a>
          <button className="secondary-button" type="button" onClick={dismiss}>Maybe later</button>
        </div>
        <small>Android APK · Secure WebView access to the LeeTec Engine workspace</small>
      </section>
    </div>
  );
}

export { APK_URL };

export function AppDownloadCard() {
  return (
    <section className="app-download-card">
      <div className="app-download-card-icon"><Smartphone size={26} /></div>
      <div className="app-download-card-copy"><span className="panel-kicker">MOBILE WORKSPACE <span className="eyebrow-line" /></span><h2>LeeTec Engine for Android</h2><p>Keep collections, payouts, wallet activity, and connection health close at hand. Download the Android app and sign in with your existing LeeTec Engine account.</p><div className="app-download-points"><span><span className="live-dot" /> Android APK</span><span>•</span><span>Same secure workspace</span></div></div>
      <div className="app-download-card-action"><a className="primary-button" href={APK_URL} download="leetec-engine.apk"><Download size={16} /> Download app</a><small>Version 1.1 · LeeTec Engine</small></div>
    </section>
  );
}
