"""Translations waiting after an edit in the website editor (/admin).

When the owner changes English wording in the editor, the other languages are
removed for that line (the site shows the English) and marked "needs" in
site-src/content/translation-status.json. Claude writes them in a chat.

  python3 site-src/pending_translations.py            list what is waiting
  python3 site-src/pending_translations.py --apply F  save translations from F, a JSON file:
        {"key": {"zh": "...", "hi": "...", "pa": "...", "mi": "..."}, ...}

--apply writes both copies of each language file (site-src/assets/i18n and
assets/i18n) and marks the lines "auto". Then run build.py and push as usual.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["zh", "hi", "pa", "mi"]
STATUS = os.path.join(ROOT, "site-src", "content", "translation-status.json")


def english():
    js = open(os.path.join(ROOT, "site-src", "assets", "home.js"), encoding="utf8").read()
    start = js.index("const I18N = {\nen:{") + len("const I18N = {\nen:{")
    body = js[start:js.index("\n}", start)]
    en = {m.group(1): json.loads(m.group(2)) for m in re.finditer(r'"([A-Za-z0-9_.-]+)":("(?:[^"\\]|\\.)*")', body)}
    # wording added in the editor's menus and homepage sections (keys starting "ed.")
    extra = os.path.join(ROOT, "site-src", "content", "ed-strings.json")
    if os.path.exists(extra):
        en.update(json.load(open(extra, encoding="utf8")))
    return en


def status():
    return json.load(open(STATUS, encoding="utf8")) if os.path.exists(STATUS) else {}


def pending():
    st, en = status(), english()
    return {k: {"en": en.get(k, ""), "langs": [l for l in LANGS if v.get(l) == "needs"]}
            for k, v in st.items() if any(v.get(l) == "needs" for l in LANGS)}


def apply(path):
    new = json.load(open(path, encoding="utf8"))
    st = status()
    for l in LANGS:
        src = os.path.join(ROOT, "site-src", "assets", "i18n", l + ".json")
        d = json.load(open(src, encoding="utf8"))
        for k, v in new.items():
            if l in v:
                d[k] = v[l]
                st.setdefault(k, {})[l] = "auto"  # "_en" (the English it was translated from) is kept
        text = json.dumps(d, ensure_ascii=False, separators=(",", ":"))
        for out in (src, os.path.join(ROOT, "assets", "i18n", l + ".json")):
            open(out, "w", encoding="utf8").write(text)
    open(STATUS, "w", encoding="utf8").write(json.dumps(st, ensure_ascii=False, indent=1) + "\n")
    print("Saved translations for", len(new), "line(s).")


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--apply":
        apply(sys.argv[2])
    else:
        p = pending()
        if not p:
            print("No translations waiting.")
        for k, v in p.items():
            print(f"{k}  [{', '.join(v['langs'])}]\n   {v['en']}")
