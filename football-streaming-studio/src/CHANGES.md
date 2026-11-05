# v4 — formats, Rundown, Preview Maker, speed

## Formats for YouTube / TikTok / Shorts / Reels
- Output format switch: **16:9** (1920×1080), **9:16** (1080×1920), **1:1** (1080×1080) — in the studio preview, Settings and the OBS URL (`&format=portrait`).
- Vertical and square use platform-safe margins (clear of the app's header, caption and button column), a compact two-row score bug,
  one big card at a time, captions/lower third that never cover a card, and type scaled up so it is readable on a phone.
- Cards: one graphic per screen zone; a newer card replaces the older one (no more half-height cards). Default zone is the big main area.

## One scene + the Rundown (manual switching)
- Scenes are gone from the UI: the score bug is always on, live commentary is the lower third, everything else is a graphic.
- **Rundown**: every graphic is a tile. Click = on air (the card it replaces comes off). Big NEXT / PREV / CLEAR, keys:
  ← → (or N/P) next/prev · 1–9 jump · Space take cued · Esc clear. Optional auto-advance every N seconds (loop).
  Timeline / Tactical / Player spotlight remain as "Live views" in the same list (they replace the main card while shown).

## Preview Maker (new page: "Preview maker")
- Pick a match → **pre-match preview** or **post-match review** → one click builds the graphics from match data, writes an editable script
  (English or Amharic), and plays it: each line brings its graphic in, speaks, holds, takes it out. **Auto card animator** picks an entrance
  (pop / slide / rise / fade) per graphic. Captions are burned in. Shows the length and whether it fits a 60 s Short/TikTok.
- Edit any line, change its graphic, reorder, add lines. Full-screen stage and **Record video** (Chrome/Edge; crops to the picture).
- Voice uses the browser's speech engine. Browsers cannot record that voice into the file: for a video WITH voice use OBS Desktop Audio or
  your screen recorder's system sound. Amharic voices exist in Microsoft Edge (Mekdes/Ameha).
- "Make preview" shortcut on every fixture in Matches.

## Matches filters (simplified)
- One date bar (‹ date › + Today + native date picker), Day/Week/Month, a Live toggle, one row of league pills, search. Grouped by league.
  Dates use the viewer's local calendar (your timezone fix is kept).

## Speed
- Panels and scenes are lazy-loaded (studio tabs, preview, overlay card layer, full-screen scenes); overlay first load = score bug only.
- Store subscriptions narrowed (sidebar/top bar no longer re-render on every score tick); one shared clock instead of a timer per card.
- Overlay: no backdrop blur; card layer memoised; incident polling removed (your change kept); fewer font weights; Ge'ez font loads on demand.
- Run `next build && next start` to judge speed — `next dev` is several times slower. Add to next.config: `experimental: { optimizePackageImports: ["lucide-react"] }`.

# v3.1 — fixes after review

- **"Not started" bug (overlay):** the overlay set the match status from the *show session* ("live" as soon as you start the show),
  so the score bug said LIVE 0\' before kick-off. Status now comes from the match period / provider status. Before kick-off the
  score bug shows **VS + kick-off time** (no LIVE, no clock). Needs the backend payload fields in `backend_fixes/3_…`.
- **Scenes + graphics united:** one "Graphics" list. The score bug is always on, live commentary is the lower third, and
  Timeline / Tactical / Player spotlight are full-screen graphics inside the Live group (shown under "On air now" like any card).
  The redundant Stats scene is gone (use the Match stats card). The old Scenes list and 1–6 hotkeys were removed.
- **Colour schemes:** Pitch green · Royal blue · Matchday gold · Crimson (Settings → Appearance), day or night, also applied to the overlay URL.
- **Backend:** see `backend_fixes/` (fixtures window bug, pagination, status mapping, caching, UTC margin).

# What changed (v3)

## Broadcast look (overlay)
- **One graphics package.** Scenes (stats, timeline, player, tactical) and editorial cards now share a single
  `BroadcastPanel` (`components/overlay/broadcast.tsx`): chamfered corners, slanted league-coloured title tab, accent rule,
  mown-grass stripes, condensed display type. No rounded "web card" styling.
- **Score bug** rebuilt like a TV match graphic: league tab, team-colour name blocks, crests, score box with goal pop, red LIVE clock tab.
- **Ticker** with slanted label tab and »» separators; **lower third** as a live-commentary caption with a red LIVE tab.
- **Timeline** (your incident version) restyled: two lanes (home above / away below), SVG icons for goals, cards, subs, VAR.
  **Tactical** keeps your formations and gets grass bands + readable jersey labels.
- Your new cards (preview, odds, momentum, xG race, best XI, player ratings, broadcasts, average positions) inherit the frame and are translated.

## Studio
- **Broadcast desk**: scenes and graphics are one tab. Cards are grouped by phase (Pre-match / Live / Post-match / League) and the
  list is split into "On air now" and "Ready to show".
- **Resizable**: sidebar, studio side panel and Matches league list. Drag, arrow keys (Shift = bigger), double-click or Home to reset. Sizes are remembered.

## Matches
- League rail (counts, live dot, pin favourites; Ethiopian Premier League pinned by default).
- Date chips: Live, Today, Tomorrow, next 5 days, This week, This month, Next month, All upcoming (with counts).
- Group by league or by day; "Live now" strip; start/resume unchanged. `api.fixtures({from,to})` sends a window (backend may ignore it).

## Theme & translation
- Football palette: floodlit-night (dark) and daylight-chalk (light); condensed display font; pitch-stripe banners.
- Amharic refreshed to broadcast wording (ቅድመ ዳሰሳ, አቋም, ፊት ለፊት ግጥሚያ, የሊጉ ደረጃ …); more screens translated
  (Matches, Studio, Graphics, Show profiles, Automation, Log, Settings, overlay).

## Logos (still original artwork)
- Closer to real-world identity: country-style crest silhouettes (English shield, Spanish escudo, German roundel…),
  real kit colours/patterns, nickname emblems (lion, eagle, castle, trident, coffee bean, wave…), PL-style lion and UCL-style
  star-ball league motifs. For exact crests drop licensed SVGs in `public/crests/` and `public/leagues/`.

## Still English
Commentary desk, profile editor, automation rule cards, analysis panel.
