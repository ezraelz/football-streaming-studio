# What changed (v2)

## Overlay (OBS)
- **Scoreboard** rebuilt: league cap with badge + name, team crests and names, big score with a goal "pop", LIVE dot + minute / HT / FT / upcoming, team-colour underline, "data delayed" pill.
- **Stats / Timeline / Player / Tactical** rebuilt on one shared panel (`components/overlay/panel.tsx`) at readable 1080p sizes (they were 12px before). Timeline now shows goals labelled, cards (yellow/red) and substitutions, coloured by team.
- **Editorial cards**: fully translated, Amharic team/competition names, light-card support, translated ticker labels.
- URL options: `?token=…&lang=am|en&tone=dark|light&lite=1` (Settings builds it for you).
- **Lite mode** (`lite=1`): no blur — for older PCs running OBS + browser source.

## Logos & league themes (all original artwork)
- Generated crests: shape + kit pattern + generic emblem + initials, stable per club. Not official crests.
- Generated league badges with motifs; new themes: Ethiopian Premier League, CAF Champions League, CAF Confederation Cup, AFCON, CECAFA.
- Licensed SVGs still override: `public/crests/<slug>.svg`, `public/leagues/<id>.svg`.

## Amharic
- `lib/i18n/en.ts` + `am.ts` (typed, keys must match). Switch in sidebar, login, Settings.
- Covered: shell, login, Matches, Studio (scenes, preview, suggestions, match data, Graphics panel), Settings, whole overlay.
- Amharic typography: Noto Sans Ethiopic, no letter-spacing / uppercase.
- Amharic names for popular clubs and leagues on the overlay.

## Light / dark
- System / Light / Dark (sidebar, login, Settings). No-flash boot script. Overlay never follows it.

## Audience changes
- Ethiopian calendar and Ethiopian 12-hour clock options (Settings → Appearance).
- Browser language "am" defaults the studio to Amharic.
- Real crests in the Matches list and match strip (they were plain colour dots).

## Not yet translated (still English; fall back gracefully)
Commentary desk, Automation, Log, Show profiles editor, Analysis panel, TTS player. Add keys to `en.ts`/`am.ts` and use `useT()`.

## Please check
- Amharic wording was written by an AI: have a native speaker review `am.ts` before going on air.
- `next/font/google` needs internet at build time for Noto Sans Ethiopic.
