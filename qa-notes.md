# LeeTec Engine QA notes

- Desktop preview rendered successfully at 1440x1000 with the intended dark navy / lime visual system.
- Mobile preview rendered successfully at 390x844; the sidebar collapses behind a menu and the dashboard stacks into a single column.
- The first desktop capture showed footer spacing collisions in the success-rate and active-key metric cards.
- Fixed by lifting the metric footers in cards three and four with targeted CSS rules.
- Production build, TypeScript check, and Vitest security tests passed before this visual adjustment.

Final verification at 1440x900 confirmed the success-rate card now separates its trend line, progress bar, and caption, while the active-key card separates environment metadata from the manage action.

Collections and Payouts desktop previews render with distinct navigation states, summary metrics, sortable table headers, search/status controls, edit and delete row actions, and responsive table containers.

Mobile previews at 390x844 stack the page heading, CTA, summary cards, balance banner, and table controls cleanly without horizontal page overflow. The table remains intentionally scrollable within its data region.
