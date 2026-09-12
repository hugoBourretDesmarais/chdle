#!/usr/bin/env python3
"""Fetch Bell Centre photos from Wikimedia Commons and encode them for the web.

Centre-cropped to 16:9 at 1920px, written as WebP with a JPEG fallback, and listed
in src/data/backgrounds.json with the photographer and licence for the credit line.
"""
import html
import io
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
DEST = HERE.parent / "public" / "backgrounds"
MANIFEST = HERE.parent / "src" / "data" / "backgrounds.json"
UA = {"User-Agent": "CHdleFanProject/1.0 (personal, low-volume)"}

# slug -> (Commons file, short label)
SOURCES = {
    "bell-centre": ("Bell Centre Montreal April 2016.JPG", "Bell Centre"),
    "rink": ("Intérieur du Centre Bell Center Inside.JPG", "Bell Centre bowl"),
    "crease": ("Mike Condon, Montreal Canadiens 3, Ottawa Senators 4, Centre Bell, Montreal, Quebec (29773407730).jpg", "The crease"),
    "scoreboard": ("Huge Centre Bell and Bright Scoreboard TV Panels, Montreal Canadiens 3, Ottawa Senators 4, Centre Bell, Montreal, Quebec (30033589926).jpg", "Bell Centre scoreboard"),
}
TARGET_W = 1920
RATIO = 16 / 9


def api(params):
    q = urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + q, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=60))


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def main():
    from PIL import Image

    DEST.mkdir(parents=True, exist_ok=True)
    titles = "|".join(f"File:{v[0]}" for v in SOURCES.values())
    d = api({"action": "query", "titles": titles, "prop": "imageinfo",
             "iiprop": "url|extmetadata", "iiurlwidth": 2400})
    by_title = {p["title"][5:]: p["imageinfo"][0] for p in d["query"]["pages"].values() if p.get("imageinfo")}

    manifest = []
    for slug, (file, label) in SOURCES.items():
        ii = by_title.get(file)
        if not ii:
            print(f"SKIP {slug}: {file} not found")
            continue
        em = ii.get("extmetadata", {})
        artist = strip_tags(em.get("Artist", {}).get("value"))
        licence = em.get("LicenseShortName", {}).get("value", "")
        raw = urllib.request.urlopen(urllib.request.Request(ii["thumburl"], headers=UA), timeout=180).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        w, h = im.size
        if w / h > RATIO:
            nw = int(h * RATIO)
            im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = int(w / RATIO)
            top = (h - nh) // 2
            im = im.crop((0, top, w, top + nh))
        im = im.resize((TARGET_W, int(TARGET_W / RATIO)), Image.LANCZOS)
        im.save(DEST / f"{slug}.jpg", quality=82, optimize=True, progressive=True)
        im.save(DEST / f"{slug}.webp", quality=78, method=6)
        manifest.append({"slug": slug, "label": f"{label} · {artist} ({licence}) via Wikimedia Commons",
                         "file": file, "url": ii["descriptionurl"]})
        print(f"{slug}: {artist} {licence}")
        time.sleep(1)
    MANIFEST.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
