# CHdle (fan game)

Guess the daily *Montréal Canadiens* player, one guess at a time, using colour-coded property
comparisons. A sibling of [OnePieceDle](../onepiecedle) and [AvatarDle](../avatardle) that shares
their engine and look, retargeted to the 2026-27 roster.

Built with Vue 3 + Vite. Fully responsive — all ten columns fit on a phone screen.

## Play

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## How the game works

Type a player name and submit. Each guess reveals a row of tiles:

| Colour | Meaning |
| --- | --- |
| 🟩 Green | exact match |
| 🟨 Yellow | partial match (both forwards; same draft round *or* same drafting club) |
| 🟥 Red | no match |

| Column | Values |
| --- | --- |
| Position | C, LW, RW, D, G — forwards are yellow against each other |
| Shoots | L or R (catching hand for goalies) |
| Country | country of birth |
| Number | sweater number at camp, with ▲/▼ arrows; unassigned shows — |
| Age | age today, with arrows |
| Height | feet and inches, with arrows |
| Draft | round and drafting club (`R1` over `MTL · 2022`), arrows by round; undrafted players only match each other |
| Cap hit | 2026-27 salary-cap hit with arrows (`$7.88M`); an unsigned RFA would show `RFA` and only match another one |
| With CH since | first regular season with the Canadiens; newcomers and prospects count as 2026-27 |

Clues unlock as you guess: **Birthplace** after 5 tries, **Last Season** (most recent stat line)
after 8, **Draft** (year, round, overall pick and club) after 10. The daily player resets at local
midnight; stats live in `localStorage`.

Modes: 🏒 **Classic** (one shared daily player), 🎲 **Practice** (unlimited, honours the roster's
practice pool), 📋 **Roster** (browse and search the roster, open a card for full details and a
link to the NHL.com player page), 🛡️ **Logo quiz** and 🃏 **Flashcards**.

### Logo quiz

Name the NHL club from its logo, all 32 of them. Each miss unlocks a hint (conference, division,
founding year, first letter); a solve extends the streak, showing the answer ends it. Best streak and
totals live under `chdle:logos`. Team data and logos come from `tools/fetch_teams.py`, which reads the
NHL standings feed into `src/data/teams.json` and saves the SVG logos to `public/logos/`.

### Flashcards

Two decks — **Numbers** (sweater numbers) and **Logos** (team names) — with spaced repetition scheduled like Anki's SM-2 (`src/game/anki.js`): each
card keeps an ease factor and an interval; **Again** resets it to today and re-queues it in the
session, **Hard** stretches the interval ×1.2 and lowers the ease, **Good** multiplies by the ease,
**Easy** by the ease ×1.3 and raises it. New cards start at 1 day (Good) or 4 days (Easy), and eight
new players enter the deck per day, most NHL games played first, so the regulars come before the call-ups. The deck, the daily log and the recall rate live in
`localStorage` under `chdle:anki` (numbers) and `chdle:anki:logos`; the roster scope also narrows the numbers deck. New logo cards arrive by division, Atlantic first.

### Roster scope

⚙️ Settings lets you play with **NHL veterans only** — players with at least one NHL game — instead
of the full training-camp roster with its prospects. Players on the same scope share the same daily
player. Over the wire the scope travels under the original `arcLimit`/`arc_limit` names and holds
`nhl` or the empty string.

## Data

The Canadiens' 2026-27 roster as the NHL API lists it at training camp, minus camp invitees without a
sweater number and a short `EXCLUDE` list in `tools/fetch_nhl.py` (29 players at the time of
writing). Roster moves are picked up by rerunning the fetch:

```bash
rm -rf tools/cache                   # forget the cached API responses
python3 tools/fetch_nhl.py           # roster + player pages -> src/data/players.json, public/portraits/
python3 tools/download_backgrounds.py  # Bell Centre photos -> public/backgrounds/, src/data/backgrounds.json
python3 tools/make_textures.py       # wear map for the logo -> public/textures/
node api/tools/gen_data.mjs          # regenerate the worker's copy of the roster
```

`fetch_nhl.py` reads `/v1/roster/MTL/20262027` and each player's `/v1/player/{id}/landing` for the
draft record, birthplace, NHL games played,
cap hit (hand-kept in `tools/salaries.json` from CapWages and HighDanger, since the NHL API has no contracts), the first regular season with the club and the last
season's stat line. Headshots are the NHL's official mugs. Age is computed in the browser from the
birth date so it never goes stale.

## Look and feel

Same engine as the other two: panels with an inline SVG grain (ice white and sweater blue here
instead of parchment), a drawn SVG wordmark (a red crest with the blue band, crossed sticks and a
puck in front of letters cycling *bleu, blanc, rouge* under a generated wear map), a streak flame,
drawn toolbar icons, and a slowly panning backdrop. Backdrops are Bell Centre photographs from
Wikimedia Commons (CC BY-SA, credited in the corner), fetched and encoded by
`tools/download_backgrounds.py`; `?bg=1`–`?bg=3` previews the alternates. The wordmark is the club's public-domain CH mark from Wikimedia Commons followed by "DLE" and a small drawn crest.

## Backend (solve counter + leaderboard)

`api/` is the same Cloudflare Worker + D1 setup as the other games (pseudonym + password accounts,
PBKDF2 in the browser, verified solves, streaks derived from stored days), deployed as `chdle-api`
against the shared `onepiecedle` D1 database with `ch_`-prefixed game tables and an `IP_SALT` secret.

```bash
node api/tools/gen_data.mjs                        # after changing players.json
cd api && npx wrangler d1 execute onepiecedle --remote --file=./schema.sql   # first time only
cd api && npx wrangler deploy
```

`VITE_API_URL` in `.env.production` points the site at the worker; it is a public endpoint, not a
secret, and every call fails soft.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.
Enable it once under **Settings → Pages → Source: GitHub Actions**.

## Credits

Roster data and headshots from [NHL.com](https://www.nhl.com/canadiens/). Backdrops from Wikimedia
Commons photographers (CC BY-SA). Not affiliated with the Montréal Canadiens or the NHL. Fan project.
