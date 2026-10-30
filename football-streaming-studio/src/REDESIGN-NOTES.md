# UI redesign notes
- Design system: `components/ui/*` (Button, Badge/StatePill, Panel, Form controls, Alert/EmptyState, ConfirmButton, PageHeader).
- Shell: sidebar (+ "Current show" shortcut), contextual top bar, per-show tabs (Studio / Commentary / Automation / Log).
- Studio: scoreboard strip, program preview, scene buttons (keys 1–6), tabbed side panel (Suggestions / Graphics / Match data).
- Behaviour changes (intentional, small): see the chat summary.

## Overlay / OBS
- One Browser Source: `/overlay/<session>?token=…` (no `scene=`). It shows the scene, graphics cards and ticker, and follows scene changes (`scene.command`) — same page as the studio preview.
- Optional fields on the overlay-state response let OBS recover after a reload: `scene_id`, `editorial_cards` (visible ones), `competition`.
- Screen positions: main / left / right / bottom strip / ticker bar. Ticker = a `custom` card with payload `{ kind: "ticker", label, items }`.
- Branding: `lib/branding/` (league themes, generated crests). Drop licensed SVGs in `public/crests/` and `public/leagues/`.
- Design sandbox: `/overlay/demo` (dev only).

## Language, theme and overlay options (v2)
- **Amharic**: `lib/i18n/{en,am}.ts` (TypeScript enforces matching keys). `useT()` in components. Switch in the sidebar,
  login page and Settings. Amharic disables letter-spacing/uppercase globally and loads Noto Sans Ethiopic.
- **Light / dark**: `lib/theme`. Light mode re-points the zinc/emerald/red/amber palette variables in `globals.css`
  (`html[data-theme="light"]`), so components need no `dark:` variants. Set System / Light / Dark in the sidebar or Settings.
  The OBS overlay always ignores this and stays a broadcast surface.
- **Overlay URL options**: `?token=…&lang=am|en&tone=dark|light&lite=1`. Settings builds the URL for you.
  `tone=light` switches the cards to a light surface; `lite=1` removes blur for slower PCs.
- **Ethiopian calendar / clock** (Settings → Appearance): affects match dates/times in the studio and the next-matches ticker.
- Overlay scenes (scoreboard, stats, timeline, player, tactical) were rebuilt at broadcast-legible sizes and share one panel style.
