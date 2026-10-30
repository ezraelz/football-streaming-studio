# Logos and league themes

Nothing in this app ships official crests or league logos (they are trademarked artwork).
Instead:

* **Generated crests** — original designs: a shape (shield / arch / hex / round) in the club colour and kit
  pattern, a generic emblem (star, ball, crown, bolt, chevron) and the club initials. The shape and emblem
  are derived from the club name, so a club always looks the same. See `clubs.ts` and `components/overlay/crest.tsx`.
* **Generated league badges** — a medallion in the league palette with a generic symbol and a monogram
  (`leagues.ts`, `components/overlay/league-badge.tsx`).
* **Drop-in licensed assets** — put SVGs in your Next.js `public/` folder and they are used automatically:
  * `public/crests/<club-slug>.svg`   e.g. `public/crests/saint-george.svg`
  * `public/leagues/<league-id>.svg`  e.g. `public/leagues/ethiopian-premier-league.svg`

Obtain official artwork from your data provider (many return a `crest_url`) or the club / league under licence.

## Adding things
* **League**: append to `LEAGUE_THEMES` (order matters — specific names such as "Ethiopian Premier League"
  must come before generic ones such as "Premier League"). Add `am` for the Amharic name and `flag` for a 3-band stripe.
* **Club**: add to `CLUB_STYLES` with `match` fragments, optional `am` (Amharic name shown on the Amharic overlay),
  and optional `shape` / `emblem` overrides.
* Colours of the crest come from the team colour in your data feed; `CLUB_STYLES` only adds the second colour and pattern.
