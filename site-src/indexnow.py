"""Tell Bing (and the other IndexNow search engines: Yandex, Seznam, Naver) which pages changed, so they read them
again within minutes instead of waiting for their next visit. ChatGPT and Copilot search through Bing.

  python3 site-src/indexnow.py <before> <after>   pages changed between two commits (run after each publish)
  python3 site-src/indexnow.py --all              every page in sitemap.xml (first time, or to catch up)
  add --dry to print the pages without sending

The key is public by design: Bing checks that https://ambs.co.nz/<key>.txt holds it, which proves the site is ours.
Only pages listed in sitemap.xml are sent (never the editor, drafts or the 404 page)."""
import json, os, re, subprocess, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = "ambs.co.nz"
KEY = "9951515280924afe83b4c493631012d8"
ENDPOINT = "https://api.indexnow.org/indexnow"
# a change in any of these is a change to the homepage, whose words and pictures live outside index.html
HOME_PARTS = re.compile(r"^(index\.html|assets/home\.(js|css)|assets/i18n/|assets/uploads/|logo|og-image)")


def sitemap_urls():
    xml = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf8").read()
    return re.findall(r"<loc>([^<]+)</loc>", xml)


def url_of(path):
    if not path.endswith(".html"): return None
    p = path[:-5]
    if p == "index": return "https://%s/" % HOST
    if p.endswith("/index"): p = p[:-6]
    return "https://%s/%s" % (HOST, p)


def changed_urls(before, after):
    if not before or set(before) == {"0"}: return []
    out = subprocess.run(["git", "diff", "--name-only", before, after], cwd=ROOT, capture_output=True, text=True)
    if out.returncode: print("indexnow: could not compare commits:", out.stderr.strip()[:200]); return []
    files = [f for f in out.stdout.split("\n") if f]
    urls = {u for u in map(url_of, files) if u}
    if any(HOME_PARTS.match(f) for f in files): urls.add("https://%s/" % HOST)
    # a guide or service page that changed often changes its section page's card too; the sitemap keeps the list honest
    return [u for u in sitemap_urls() if u in urls]


def send(urls):
    body = json.dumps({"host": HOST, "key": KEY, "keyLocation": "https://%s/%s.txt" % (HOST, KEY), "urlList": urls}).encode()
    for attempt in range(3):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "ambs-website-indexnow"})
            with urllib.request.urlopen(req, timeout=30) as r:
                print("indexnow: sent %d page%s, answer %s" % (len(urls), "" if len(urls) == 1 else "s", r.status)); return True
        except urllib.error.HTTPError as e:
            # 403 = key file not reachable yet (the new version may still be deploying); 429 = too many at once
            print("indexnow: answer %s %s" % (e.code, e.read()[:200].decode("utf8", "replace")))
            if e.code not in (403, 429, 500, 503): return False
        except Exception as e:
            print("indexnow: could not reach it:", e)
        time.sleep(60)
    return False


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if x != "--dry"]
    urls = sitemap_urls() if a[:1] == ["--all"] else changed_urls(*(a + ["", ""])[:2])
    if not urls: print("indexnow: no public pages changed"); sys.exit(0)
    print("\n".join(urls))
    if "--dry" not in sys.argv: send(urls)
