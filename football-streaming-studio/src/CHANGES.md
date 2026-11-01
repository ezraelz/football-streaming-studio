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
