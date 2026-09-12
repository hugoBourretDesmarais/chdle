#!/usr/bin/env python3
"""Build src/data/players.json from the NHL API.

Pulls the Canadiens' roster for SEASON, then each player's landing page for draft,
birthplace and season-by-season history. Raw responses are cached under
tools/cache so a rerun after a hand edit doesn't hit the API again; delete the
cache to pick up roster moves. Headshots land in public/portraits.
"""
import json
import re
import time
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / "cache"
PORTRAITS = HERE.parent / "public" / "portraits"
OUT = HERE.parent / "src" / "data" / "players.json"
SEASON = "20262027"
TEAM = "MTL"
UA = {"User-Agent": "CHdleFanProject/1.0 (personal, low-volume)"}

# Camp invitees without a sweater number are dropped, plus anyone listed here.
EXCLUDE = {"Alex Belzile", "Filip Mesar", "Owen Protz"}

POSITIONS = {"C": "Centre", "L": "Left wing", "R": "Right wing", "D": "Defence", "G": "Goalie"}
COUNTRIES = {
    "CAN": "Canada", "USA": "United States", "SWE": "Sweden", "FIN": "Finland", "RUS": "Russia",
    "CZE": "Czechia", "SVK": "Slovakia", "AUT": "Austria", "FRA": "France", "POL": "Poland",
    "DEU": "Germany", "CHE": "Switzerland", "DNK": "Denmark", "LVA": "Latvia", "BLR": "Belarus",
    "NOR": "Norway", "GBR": "United Kingdom", "SVN": "Slovenia", "KAZ": "Kazakhstan",
}
TEAM_NAMES = {
    "ANA": "Anaheim", "ARI": "Arizona", "BOS": "Boston", "BUF": "Buffalo", "CGY": "Calgary",
    "CAR": "Carolina", "CHI": "Chicago", "COL": "Colorado", "CBJ": "Columbus", "DAL": "Dallas",
    "DET": "Detroit", "EDM": "Edmonton", "FLA": "Florida", "LAK": "Los Angeles", "MIN": "Minnesota",
    "MTL": "Montréal", "NSH": "Nashville", "NJD": "New Jersey", "NYI": "NY Islanders", "NYR": "NY Rangers",
    "OTT": "Ottawa", "PHI": "Philadelphia", "PIT": "Pittsburgh", "SJS": "San Jose", "SEA": "Seattle",
    "STL": "St. Louis", "TBL": "Tampa Bay", "TOR": "Toronto", "UTA": "Utah", "VAN": "Vancouver",
    "VGK": "Vegas", "WSH": "Washington", "WPG": "Winnipeg",
}


def get(url, cache_name, binary=False):
    CACHE.mkdir(exist_ok=True)
    f = CACHE / cache_name
    if not f.exists():
        for attempt in range(4):
            try:
                req = urllib.request.Request(url, headers=UA)
                f.write_bytes(urllib.request.urlopen(req, timeout=30).read())
                break
            except Exception as e:  # noqa: BLE001
                if attempt == 3:
                    raise
                time.sleep(2 * (attempt + 1))
        time.sleep(0.4)
    return f.read_bytes() if binary else json.loads(f.read_text())


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def season_label(s):
    return f"{str(s)[:4]}-{str(s)[6:]}"


def place(p):
    parts = [p.get("birthCity", {}).get("default"), p.get("birthStateProvince", {}).get("default"),
             COUNTRIES.get(p["birthCountry"], p["birthCountry"])]
    return ", ".join(x for x in parts if x)


def last_season(landing, pos):
    """The most recent regular season on record, NHL first."""
    rows = [s for s in landing.get("seasonTotals", []) if s["gameTypeId"] == 2]
    if not rows:
        return None
    top = max(s["season"] for s in rows)
    rows = [s for s in rows if s["season"] == top]
    rows.sort(key=lambda s: (s["leagueAbbrev"] != "NHL", -s.get("gamesPlayed", 0)))
    s = rows[0]
    out = {"season": season_label(s["season"]), "league": s["leagueAbbrev"],
           "team": s.get("teamName", {}).get("default") or s.get("teamCommonName", {}).get("default"),
           "gp": s.get("gamesPlayed", 0)}
    if pos == "G":
        out.update(wins=s.get("wins"), gaa=s.get("goalsAgainstAvg"), svPct=s.get("savePctg"))
    else:
        out.update(goals=s.get("goals"), assists=s.get("assists"), points=s.get("points"))
    return out


def main():
    roster = get(f"https://api-web.nhle.com/v1/roster/{TEAM}/{SEASON}", f"roster-{SEASON}.json")
    PORTRAITS.mkdir(parents=True, exist_ok=True)
    players = []
    for group in ("forwards", "defensemen", "goalies"):
        for p in roster[group]:
            pid = p["id"]
            first, last = p["firstName"]["default"], p["lastName"]["default"]
            name = f"{first} {last}"
            if p.get("sweaterNumber") is None or name in EXCLUDE:
                continue
            landing = get(f"https://api-web.nhle.com/v1/player/{pid}/landing", f"player-{pid}.json")
            portrait = f"{slug(name)}.png"
            dest = PORTRAITS / portrait
            if not dest.exists():
                dest.write_bytes(get(p["headshot"], f"mug-{pid}.png", binary=True))

            nhl = [s for s in landing.get("seasonTotals", [])
                   if s["leagueAbbrev"] == "NHL" and s["gameTypeId"] == 2]
            mtl = [s["season"] for s in nhl if s.get("teamCommonName", {}).get("default") == "Canadiens"]
            other = sorted({s.get("teamCommonName", {}).get("default") for s in nhl
                            if s.get("teamCommonName", {}).get("default") not in (None, "Canadiens")})
            dd = landing.get("draftDetails")
            pos = p["positionCode"]
            players.append({
                "id": pid,
                "name": name,
                "aliases": [],
                "number": p.get("sweaterNumber"),
                "position": {"L": "LW", "R": "RW"}.get(pos, pos),
                "positionName": POSITIONS[pos],
                "shoots": p["shootsCatches"],
                "country": COUNTRIES.get(p["birthCountry"], p["birthCountry"]),
                "birthplace": place(p),
                "birthDate": p["birthDate"],
                "heightIn": p["heightInInches"],
                "weightLb": p["weightInPounds"],
                "draft": {
                    "year": dd["year"], "round": dd["round"], "overall": dd["overallPick"],
                    "team": dd["teamAbbrev"], "teamName": TEAM_NAMES.get(dd["teamAbbrev"], dd["teamAbbrev"]),
                } if dd else None,
                # First regular season with the club; a newcomer's is the season being built.
                "sinceSeason": int(str(min(mtl))[:4]) if mtl else int(SEASON[:4]),
                "nhlGames": sum(s.get("gamesPlayed", 0) for s in nhl),
                "otherTeams": other,
                "lastSeason": last_season(landing, pos),
                "portrait": portrait,
            })
    players.sort(key=lambda x: x["name"])
    OUT.write_text(json.dumps(players, indent=1, ensure_ascii=False) + "\n")
    print(f"wrote {len(players)} players -> {OUT.relative_to(HERE.parent)}")
    dup = [n for n in {p['number'] for p in players if p['number']} if sum(1 for p in players if p['number'] == n) > 1]
    if dup:
        print("shared sweater numbers:", dup)


if __name__ == "__main__":
    main()
