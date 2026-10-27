# Logos and league themes

Nothing in this app ships official crests or league logos (they are trademarked artwork).
Instead:

* **Generated crests** — original shields drawn from the club colour + kit pattern (`clubs.ts`).
* **Generated league badges** — shield + monogram in the league palette (`leagues.ts`).
* **Drop-in licensed assets** — put SVGs in your Next.js `public/` folder and they are used automatically:
  * `public/crests/<club-slug>.svg`   e.g. `public/crests/manchester-city.svg`
  * `public/leagues/<league-id>.svg`  e.g. `public/leagues/premier-league.svg`

Obtain official artwork from your data provider (many return a `crest_url`) or the club / league under licence.
To add a league, append an entry to `LEAGUE_THEMES`; to refine a club's look, add one to `CLUB_STYLES`.
