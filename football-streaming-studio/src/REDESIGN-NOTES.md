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
