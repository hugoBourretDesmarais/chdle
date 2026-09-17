"""Build src/data/teams.json and download the 32 NHL logos to public/logos/."""
import json
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
ROOT = HERE.parent
UA = {"User-Agent": "Mozilla/5.0 (Macintosh)"}
OUT = ROOT / "src" / "data" / "teams.json"
LOGOS = ROOT / "public" / "logos"

DIV_ORDER = ["Atlantic", "Metropolitan", "Central", "Pacific"]
FOUNDED = {
    "MTL": 1909, "TOR": 1917, "BOS": 1924, "NYR": 1926, "CHI": 1926, "DET": 1926,
    "LAK": 1967, "PHI": 1967, "PIT": 1967, "STL": 1967, "DAL": 1967, "BUF": 1970,
    "VAN": 1970, "NYI": 1972, "CGY": 1972, "WSH": 1974, "EDM": 1979, "CAR": 1979,
    "COL": 1979, "NJD": 1974, "SJS": 1991, "OTT": 1992, "TBL": 1992, "FLA": 1993,
    "ANA": 1993, "NSH": 1998, "CBJ": 2000, "MIN": 2000, "WPG": 1999, "VGK": 2017,
    "SEA": 2021, "UTA": 2024,
}
ALIASES = {
    "MTL": ["Habs", "CH", "Canadiens de Montréal"],
    "TOR": ["Leafs", "Buds"],
    "BOS": ["B's"],
    "NYR": ["Blueshirts"],
    "NYI": ["Isles"],
    "NJD": ["Devils"],
    "PHI": ["Broad Street Bullies"],
    "PIT": ["Pens"],
    "WSH": ["Caps"],
    "CAR": ["Canes"],
    "CBJ": ["Jackets", "CBJ"],
    "TBL": ["Bolts"],
    "FLA": ["Cats"],
    "DET": ["Wings"],
    "CHI": ["Hawks"],
    "STL": ["Blues"],
    "COL": ["Avs"],
    "DAL": ["Stars"],
    "MIN": ["Wild"],
    "NSH": ["Preds"],
    "WPG": ["Jets"],
    "UTA": ["Utah", "Mammoth"],
    "VGK": ["Knights", "Vegas"],
    "SJS": ["Sharks"],
    "LAK": ["Kings"],
    "ANA": ["Ducks"],
    "CGY": ["Flames"],
    "EDM": ["Oilers"],
    "VAN": ["Canucks"],
    "SEA": ["Kraken"],
    "OTT": ["Sens"],
    "BUF": ["Sabres"],
}


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    return data if binary else json.loads(data)


# Top scorer of last season who is still on this season's roster, so a traded
# star doesn't get named for his old club.
def star(ab):
    roster = get(f"https://api-web.nhle.com/v1/roster/{ab}/20262027")
    ids = {p["id"] for k in ("forwards", "defensemen", "goalies") for p in roster.get(k, [])}
    stats = get(f"https://api-web.nhle.com/v1/club-stats/{ab}/20252026/2")
    skaters = [x for x in stats["skaters"] if x["playerId"] in ids] or stats["skaters"]
    best = max(skaters, key=lambda x: (x["points"], x["goals"]))
    time.sleep(0.3)
    return {
        "id": best["playerId"],
        "name": f'{best["firstName"]["default"]} {best["lastName"]["default"]}',
        "position": best["positionCode"],
        "points": best["points"],
        "goals": best["goals"],
        "assists": best["assists"],
        "gp": best["gamesPlayed"],
        "season": "2025-26",
    }


def main():
    LOGOS.mkdir(parents=True, exist_ok=True)
    rows = get("https://api-web.nhle.com/v1/standings/now")["standings"]
    teams = []
    for t in rows:
        ab = t["teamAbbrev"]["default"]
        logo = LOGOS / f"{ab}.svg"
        if not logo.exists():
            logo.write_bytes(get(t["teamLogo"], binary=True))
            time.sleep(0.3)
        teams.append({
            "abbrev": ab,
            "name": t["teamName"]["default"],
            "nameFr": t["teamName"].get("fr"),
            "common": t["teamCommonName"]["default"],
            "place": t["placeName"]["default"],
            "conference": t["conferenceName"],
            "division": t["divisionName"],
            "founded": FOUNDED.get(ab),
            "aliases": ALIASES.get(ab, []),
            "logo": f"{ab}.svg",
            "star": star(ab),
        })
    teams.sort(key=lambda x: (DIV_ORDER.index(x["division"]), x["name"]))
    for i, t in enumerate(teams):
        t["order"] = i
    OUT.write_text(json.dumps(teams, indent=1, ensure_ascii=False) + "\n")
    print(len(teams), "teams;", len(list(LOGOS.glob("*.svg"))), "logos")


if __name__ == "__main__":
    main()
