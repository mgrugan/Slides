import re, json, unicodedata

CATS = ["EDUCATIONAL", "COMPARISON", "MYTH BUSTING", "STORYTELLING",
        "AUTHORITY", "DAY IN THE LIFE", "RANDOM"]
PRETTY = {"EDUCATIONAL": "Educational", "COMPARISON": "Comparison",
          "MYTH BUSTING": "Myth Busting", "STORYTELLING": "Storytelling",
          "AUTHORITY": "Authority", "DAY IN THE LIFE": "Day In The Life",
          "RANDOM": "Random"}

raw = open("raw.txt").read()
raw = re.sub(r"=== PAGE \d+ ===", "\n", raw)
raw = raw.replace("ﬁ", "fi").replace("ﬂ", "fl")
raw = raw.replace("’", "'").replace("‘", "'")
raw = raw.replace("“", '"').replace("”", '"')
raw = raw.replace("–", "-").replace("—", "-")
raw = unicodedata.normalize("NFKC", raw)
# URLs act as record separators
raw = re.sub(r"https?://\S+", "\n", raw)
raw = re.sub(r"1000\s+VIRAL\s+HOOKS", "\n", raw)

stats = {"segments": 0, "dropped_short": 0, "dropped_empty": 0,
         "dropped_dupe": 0, "dropped_meta": 0}

hooks = []
seen = {}
current = "Educational"

def norm_spaces(s):
    return re.sub(r"\s+", " ", s).strip()

def dedupe_key(s):
    k = s.lower()
    k = re.sub(r"\((?:insert|Insert)[^)]*\)", "(x)", k)
    k = re.sub(r"[^a-z0-9() ]+", "", k)
    return re.sub(r"\s+", " ", k).strip()

for line in raw.split("\n"):
    seg = norm_spaces(line)
    if not seg:
        continue
    # pull out category headings wherever they appear in the segment
    changed = True
    while changed:
        changed = False
        for cat in CATS:
            m = re.search(r"(?<![A-Za-z])" + re.escape(cat) + r"(?![A-Za-z])", seg)
            if m:
                current = PRETTY[cat]
                seg = norm_spaces(seg[:m.start()] + " || " + seg[m.end():])
                changed = True
    for part in seg.split("||"):
        text = norm_spaces(part)
        if not text:
            continue
        stats["segments"] += 1
        text = re.sub(r"^INSPO\s+HOOK:\s*", "", text, flags=re.I)
        # scrub surviving URL detritus (URLs wrapped across lines in the PDF)
        text = re.sub(r"\S*(?:igsh=|utm_source=|utm_medium=|igshid=|instagram\.com|tiktok\.com)\S*", " ", text, flags=re.I)
        text = re.sub(r"(?:^|\s)[A-Za-z0-9_\-]{0,4}/\?\S*", " ", text)
        text = norm_spaces(text)
        # strip stray leading punctuation / bullets
        text = text.lstrip("-•*·.,: ").strip()
        if len(text) < 18:
            stats["dropped_short"] += 1
            continue
        # meaningful survival check: words outside placeholders
        outside = re.sub(r"\([^)]*\)", " ", text)
        words = [w for w in re.findall(r"[A-Za-z']+", outside) if len(w) > 1]
        if len(words) < 4:
            stats["dropped_empty"] += 1
            continue
        if re.match(r"^(page|copyright|all rights)", text, re.I):
            stats["dropped_meta"] += 1
            continue
        if not re.search(r"[A-Za-z]{3}", text):
            stats["dropped_meta"] += 1
            continue
        # trailing junk cleanup
        text = re.sub(r"\s+([.,!?])", r"\1", text).strip()
        k = dedupe_key(text)
        if k in seen:
            stats["dropped_dupe"] += 1
            continue
        seen[k] = True
        hooks.append({"t": text, "c": current})

from collections import Counter
print(json.dumps(stats, indent=1))
print(Counter(h["c"] for h in hooks))
print("kept:", len(hooks))
json.dump(hooks, open("hooks.json", "w"), indent=0)
for h in hooks[:5] + hooks[-5:]:
    print(h["c"], "|", h["t"][:110])

# Usage:
#   pip install pypdf
#   python3 -c "from pypdf import PdfReader; r=PdfReader('1000_Viral_Hooks_PBL.pdf'); open('raw.txt','w').write('\n'.join((p.extract_text() or '') for p in r.pages))"
#   python3 parse_hooks.py     -> hooks.json, which is inlined into index.html as HOOK_DATA
