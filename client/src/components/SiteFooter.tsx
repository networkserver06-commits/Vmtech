import { MessageCircle, Phone } from "lucide-react";

export default function SiteFooter() {
  return <footer className="site-footer" aria-label="LeeTec support footer">
    <span>Powered by LeeTec · © 2026 LeeTec. All rights reserved.</span>
    <span className="site-footer-support"><span>Support:</span><a href="tel:+254116553618"><Phone size={13} /> +254 116 553 618</a><a href="https://wa.me/254116553618" target="_blank" rel="noreferrer"><MessageCircle size={13} /> WhatsApp</a></span>
  </footer>;
}
