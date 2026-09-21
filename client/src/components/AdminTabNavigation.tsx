import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Code2, CreditCard, Settings2, UserRound } from "lucide-react";

export type AdminTabId = "users" | "ledger" | "payouts" | "settings" | "profile";

type AdminTab = { id: AdminTabId; label: string; icon: LucideIcon; badge?: number };

type AdminTabNavigationProps = {
  value: AdminTabId;
  payoutCount: number;
  onChange: (tab: AdminTabId) => void;
};

const tabs: AdminTab[] = [
  { id: "users", label: "Developers", icon: Code2 },
  { id: "ledger", label: "Wallet Ledger", icon: CreditCard },
  { id: "payouts", label: "Payout Requests", icon: ArrowUpRight },
  { id: "settings", label: "System Settings", icon: Settings2 },
  { id: "profile", label: "Profile", icon: UserRound },
];

export default function AdminTabNavigation({ value, payoutCount, onChange }: AdminTabNavigationProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentIndex = tabs.findIndex((tab) => tab.id === value);
  const moveFocus = (index: number) => {
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); moveFocus(index + 1); }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveFocus(index - 1); }
    if (event.key === "Home") { event.preventDefault(); moveFocus(0); }
    if (event.key === "End") { event.preventDefault(); moveFocus(tabs.length - 1); }
  };

  return <section className="admin-tab-navigation" aria-label="Admin section navigation">
    <div className="admin-section-selector">
      <label htmlFor="admin-section-select">ADMIN SECTION</label>
      <select id="admin-section-select" value={value} onChange={(event) => onChange(event.target.value as AdminTabId)}>
        {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}{tab.id === "payouts" && payoutCount ? ` (${payoutCount})` : ""}</option>)}
      </select>
    </div>
    <div className="admin-tab-scroll" role="tablist" aria-label="Super Admin Portal sections">
      {tabs.map((tab, index) => {
        const Icon = tab.icon;
        const badge = tab.id === "payouts" ? payoutCount : tab.badge;
        return <button id={`admin-tab-${tab.id}`} key={tab.id} ref={(element) => { tabRefs.current[index] = element; }} className={`admin-tab ${value === tab.id ? "active" : ""}`} type="button" role="tab" aria-selected={value === tab.id} aria-controls={`admin-panel-${tab.id}`} tabIndex={value === tab.id ? 0 : -1} onClick={() => onChange(tab.id)} onKeyDown={(event) => handleKeyDown(event, index)}>
          <Icon size={15} aria-hidden="true" /><span>{tab.label}</span>{badge ? <strong className="admin-tab-badge">{badge}</strong> : null}
        </button>;
      })}
    </div>
  </section>;
}
