#!/usr/bin/env python3
"""Build a deployable zero-dependency daily horoscope site.

Run: python scripts/build.py [--date 2026-10-09] [--site-url https://example.com/]
Same seeded algorithm as site/app.js; all content is local and editable.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
from datetime import datetime, date, timedelta, timezone
from html import escape
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "site"
DIST = ROOT / "dist"
CONTENT = ROOT / "content" / "content.json"
CONFIG = ROOT / "config.json"
ARCHIVE_DAYS = 14


def h(text: object) -> str:
    return escape(str(text), quote=True)


def stable_hash(value: str) -> int:
    """FNV-1a 32-bit; input keys are intentionally ASCII (parity with JS)."""
    result = 2166136261
    for item in value.encode("ascii"):
        result = ((result ^ item) * 16777619) & 0xFFFFFFFF
    return result


def pick(values: list[str], seed: str) -> str:
    return values[stable_hash(seed) % len(values)]


def fortune_for(day: str, sign: dict, index: int, data: dict) -> dict:
    sign_id = sign["id"]
    return {
        **sign,
        "score": 64 + stable_hash(f"{day}|{sign_id}|score") % 35,
        "overall": data["overall"][(stable_hash(f"{day}|overall") + index * 11) % len(data["overall"])],
        "action": pick(data["actions"], f"{day}|{sign_id}|action"),
        "love": pick(data["love"], f"{day}|{sign_id}|love"),
        "work": pick(data["work"], f"{day}|{sign_id}|work"),
        "money": pick(data["money"], f"{day}|{sign_id}|money"),
        "color": pick(data["colors"], f"{day}|{sign_id}|color"),
        "item": pick(data["items"], f"{day}|{sign_id}|item"),
    }


def fortunes_for(day: str, data: dict) -> list[dict]:
    return [fortune_for(day, sign, i, data) for i, sign in enumerate(data["signs"])]


def long_date(day: str) -> str:
    value = date.fromisoformat(day)
    weekday = "月火水木金土日"[value.weekday()]
    return f"{value.year}年{value.month}月{value.day}日 {weekday}曜日"


def short_date(day: str) -> str:
    return day.replace("-", ".")


def effective_url(config: dict, site_url_arg: str | None) -> str:
    """Use the production URL when configured; keep local builds self-contained."""
    raw = site_url_arg or os.environ.get("SITE_URL") or config.get("site_url", "")
    if raw:
        parsed = urlsplit(raw)
        if parsed.scheme not in ("https", "http") or not parsed.netloc or parsed.query or parsed.fragment:
            raise ValueError("site_url は http(s):// から始まる公開URLにしてください")
        return raw.rstrip("/") + "/"
    return "http://localhost:8000/"


def sign_buttons(data: dict) -> str:
    return "".join(
        f'<button type="button" class="sign-option" data-sign="{h(s["id"])}" aria-pressed="{str(i==0).lower()}" aria-label="{h(s["name"])}の今日の運勢を読む">'
        f'<span class="sign-symbol" aria-hidden="true">{h(s["symbol"])}</span><span class="sign-name">{h(s["name"])}</span>'
        f'<span class="sign-birth">{h(s["date"])}</span></button>'
        for i, s in enumerate(data["signs"])
    )


def fortune_html(f: dict) -> str:
    """Pre-rendered first result: meaningful, indexable even without JS."""
    return f'''
    <div class="fortune-left">
      <div class="fortune-topline"><div class="fortune-emblem" aria-hidden="true">{h(f['symbol'])}</div><div class="fortune-headings"><span class="micro">{h(f['en'])} · TODAY</span><h3>{h(f['name'])}の運勢</h3></div><div class="fortune-rating"><strong>{f['score']}</strong><span>/ 100</span></div></div>
      <p class="fortune-message">{h(f['overall'])}</p><div class="fortune-mini-head">TODAY'S LITTLE STEP</div><p class="fortune-action">{h(f['action'])}</p>
      <div class="fortune-buttons"><button type="button" class="plain-action" id="fortune-share">この運勢をシェアする ↗</button><a class="plain-action" href="./signs/{h(f['id'])}/">{h(f['name'])}のページを見る →</a></div>
    </div>
    <div class="fortune-right"><div class="reading-row"><span class="reading-label"><span aria-hidden="true">♡</span> 恋愛運</span><p>{h(f['love'])}</p></div><div class="reading-row"><span class="reading-label"><span aria-hidden="true">✎</span> 仕事運</span><p>{h(f['work'])}</p></div><div class="reading-row"><span class="reading-label"><span aria-hidden="true">✧</span> 金運</span><p>{h(f['money'])}</p></div><div class="lucky-box"><span class="lucky-tag"><b>LUCKY COLOR</b>{h(f['color'])}</span><span class="lucky-tag"><b>LUCKY ITEM</b>{h(f['item'])}</span></div></div>
    '''


def quiz_cards(data: dict) -> str:
    icons = {"heart-weather": "☾", "love-distance": "♡", "story-role": "✧"}
    result = []
    for q in data["quizzes"]:
        result.append(f'''
        <button class="quiz-card tone-{h(q['tone'])}" type="button" data-quiz="{h(q['id'])}" aria-label="{h(q['title'])}の診断をはじめる">
          <span class="quiz-card-top"><span class="quiz-number">{h(q['number'])} / 03</span><span class="quiz-tag">{h(q['tag'])}</span></span>
          <span class="quiz-art" aria-hidden="true"><span class="quiz-art-main">{icons[q['id']]}</span><span class="quiz-art-dot a">✦</span><span class="quiz-art-dot b">✧</span></span>
          <span class="quiz-card-body"><span class="quiz-eyebrow">{h(q['eyebrow'])}</span><h3>{h(q['title'])}</h3><span class="quiz-card-desc">{h(q['desc'])}</span><span class="quiz-card-bottom"><span>{h(q['duration'])} · 4つの質問</span><strong>診断する <i aria-hidden="true">↗</i></strong></span></span>
        </button>''')
    return "".join(result)


def archive_links(today: date) -> str:
    result = []
    for back in range(ARCHIVE_DAYS):
        day = (today - timedelta(days=back)).isoformat()
        text = "今日の星の便り" if back == 0 else f"{day[5:7]}月{day[8:10]}日の12星座占い"
        result.append(f'<a class="archive-link" href="./archive/{day}/"><time datetime="{day}">{day.replace("-", ".")}</time><span>{h(text)}</span><i aria-hidden="true">↗</i></a>')
    return "".join(result)


def affiliate_html(links: list[dict]) -> str:
    if not links:
        return ""
    cards = []
    for item in links[:6]:
        title, desc, url = item.get("title", ""), item.get("description", ""), item.get("url", "")
        scheme = urlsplit(url)
        if scheme.scheme != "https" or not scheme.netloc:
            continue
        cards.append(f'<a class="affiliate-item" href="{h(url)}" target="_blank" rel="sponsored noopener noreferrer"><span class="affiliate-label">PR · AFFILIATE LINK</span><h3>{h(title)} ↗</h3><p>{h(desc)}</p></a>')
    if not cards:
        return ""
    return f'<section class="affiliate-section" aria-label="おすすめ・広告"><div class="container"><p class="section-kicker">PR <span class="kicker-line"></span> HANDPICKED FOR YOU</p><h2 style="font:500 27px var(--serif);margin:0 0 8px">日々のくらしに，小さな楽しみを．</h2><p class="section-note" style="margin:0 0 23px">このエリアにはアフィリエイト広告を含みます．</p><div class="affiliate-grid">{"".join(cards)}</div></div></section>'


def adsense_html(config: dict) -> tuple[str, str]:
    publisher_id = config.get("adsense_publisher_id", "")
    slot = config.get("adsense_slot_id", "")
    if not publisher_id:
        return "", ""
    if not re.fullmatch(r"ca-pub-[0-9]{10,20}", publisher_id):
        raise ValueError("adsense_publisher_id は ca-pub- で始まる有効なIDにしてください")
    script = (f'<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={h(publisher_id)}" crossorigin="anonymous"></script>')
    if not slot:
        return script, ""
    if not re.fullmatch(r"[0-9]{5,20}", slot):
        raise ValueError("adsense_slot_id は数字で設定してください")
    block = (f'<section class="affiliate-section" aria-label="広告"><div class="container"><p class="section-note" style="text-align:center">広告</p>'
             f'<ins class="adsbygoogle" style="display:block" data-ad-client="{h(publisher_id)}" data-ad-slot="{h(slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>'
             f'<script>(adsbygoogle=window.adsbygoogle||[]).push({{}});</script></div></section>')
    return script, block


def json_safe_for_script(obj: dict) -> str:
    result = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return result.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


def page_wrapper(*, title: str, description: str, body: str, base: str, root_rel: str, path: str) -> str:
    """Minimal standalone HTML for indexable archive and each sign page."""
    canonical = base + path
    return f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#17233c"><title>{h(title)}</title><meta name="description" content="{h(description)}"><link rel="canonical" href="{h(canonical)}"><meta property="og:title" content="{h(title)}"><meta property="og:description" content="{h(description)}"><meta property="og:url" content="{h(canonical)}"><meta property="og:image" content="{h(base+'assets/og.png')}"><link rel="icon" href="{root_rel}assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="{root_rel}styles.css"></head><body class="simple-page"><header class="site-header"><div class="nav-shell container"><a class="brand" href="{root_rel}"><span class="brand-mark">✳</span><span>星と余白</span><small>HOSHI TO YOHAKU</small></a><nav class="main-nav"><a href="{root_rel}#horoscope">今日の運勢</a><a href="{root_rel}#diagnosis">こころ診断</a><a href="{root_rel}#tarot">タロット</a></nav></div></header><main class="container simple-layout archive-page">{body}</main><footer class="simple-footer"><div class="container"><span>© {date.today().year} 星と余白</span><nav><a href="{root_rel}about.html">このサイトについて</a><a href="{root_rel}privacy.html">プライバシー</a><a href="{root_rel}terms.html">ご利用にあたって</a><a href="{root_rel}contact.html">お問い合わせ</a></nav></div></footer></body></html>'''


def make_archive_page(day: str, fortunes: list[dict], base: str) -> str:
    entries = []
    for f in fortunes:
        entries.append(f'''<article class="archive-entry"><span class="archive-badge">{h(f['en'])} · {f['score']} / 100</span><h2><span class="archive-icon">{h(f['symbol'])}</span>{h(f['name'])}</h2><p>{h(f['overall'])}</p><p class="archive-action">今日の小さな一歩：{h(f['action'])}</p><a href="../../signs/{h(f['id'])}/">{h(f['name'])}の最新の運勢 ↗</a></article>''')
    body = (f'<p class="section-kicker">DAILY STAR LETTER / {h(day)}</p><h1>{h(long_date(day))}の12星座占い</h1>'
            f'<p class="archive-sum">その日の星の便りを読み返すためのアーカイブです．星を選ぶと，最新の日付の運勢ページに移動します．</p>'
            f'<div class="archive-grid">{"".join(entries)}</div><a class="btn btn-dark" href="../../#archives">別の日の運勢を探す <span aria-hidden="true">↗</span></a>')
    return page_wrapper(title=f'{long_date(day)}の12星座占い | 星と余白',description=f'{long_date(day)}の12星座占い．各星座の運勢と今日の小さな一歩を読む．',body=body,base=base,root_rel="../../",path=f'archive/{day}/')


def make_sign_page(day: str, f: dict, base: str) -> str:
    body = f'''<p class="section-kicker">TODAY'S HOROSCOPE / {h(f['en'])}</p><h1>{h(f['symbol'])} {h(f['name'])}の今日の運勢</h1><p class="archive-sum">{h(long_date(day))} · {h(f['date'])} · 今日のスコア {f['score']} / 100</p><article class="single-sign-hero"><h2>今日の総合運</h2><p>{h(f['overall'])}</p><p><strong>今日の小さな一歩：</strong>{h(f['action'])}</p></article><div class="archive-grid"><article class="archive-entry"><h2>♡ 恋愛運</h2><p>{h(f['love'])}</p></article><article class="archive-entry"><h2>✎ 仕事運</h2><p>{h(f['work'])}</p></article><article class="archive-entry"><h2>✧ 金運</h2><p>{h(f['money'])}</p></article><article class="archive-entry"><h2>小さなラッキー</h2><p>ラッキーカラー：{h(f['color'])}</p><p>ラッキーアイテム：{h(f['item'])}</p></article></div><p class="section-note">※運勢はエンターテインメントです．日付が変わるとサイトのトップページでは新しい運勢が表示されます．</p><a class="btn btn-dark" href="../../?sign={h(f['id'])}#horoscope">トップで今日の運勢を読む <span aria-hidden="true">↗</span></a>'''
    return page_wrapper(title=f'{f["name"]}の今日の運勢 {day} | 星と余白',description=f'{long_date(day)}の{f["name"]}の運勢．恋愛運，仕事運，金運，ラッキーカラーを無料でチェック．',body=body,base=base,root_rel="../../",path=f'signs/{f["id"]}/')


def make_feed(day: date, data: dict, base: str) -> str:
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    for tag, value in (("title", "星と余白 | 毎日の星占い"), ("link", base), ("description", "毎日更新される12星座占いと物語の便り．"), ("language", "ja")):
        ET.SubElement(channel, tag).text = value
    for back in range(ARCHIVE_DAYS):
        d = day - timedelta(days=back)
        iso = d.isoformat()
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = f'{long_date(iso)}の12星座占い'
        ET.SubElement(item, "link").text = base + f'archive/{iso}/'
        ET.SubElement(item, "guid", isPermaLink="true").text = base + f'archive/{iso}/'
        ET.SubElement(item, "description").text = fortunes_for(iso, data)[0]["overall"]
        ET.SubElement(item, "pubDate").text = datetime(d.year, d.month, d.day, 6, 0, tzinfo=timezone(timedelta(hours=9))).strftime("%a, %d %b %Y %H:%M:%S %z")
    return ET.tostring(rss, encoding="unicode", xml_declaration=True)


def make_sitemap(today: date, data: dict, base: str) -> str:
    namespace = "http://www.sitemaps.org/schemas/sitemap/0.9"
    ET.register_namespace("", namespace)
    root = ET.Element(f"{{{namespace}}}urlset")
    urls = [("", today.isoformat()), ("about.html", "2026-10-09"), ("privacy.html", "2026-10-09"), ("terms.html", "2026-10-09"), ("contact.html", "2026-10-09")]
    for sign in data["signs"]:
        urls.append((f'signs/{sign["id"]}/', today.isoformat()))
    for back in range(ARCHIVE_DAYS):
        d = (today - timedelta(days=back)).isoformat()
        urls.append((f'archive/{d}/', d))
    for path, changed in urls:
        el = ET.SubElement(root, f"{{{namespace}}}url")
        ET.SubElement(el, f"{{{namespace}}}loc").text = base + path
        ET.SubElement(el, f"{{{namespace}}}lastmod").text = changed
    return ET.tostring(root, encoding="unicode", xml_declaration=True)


def validate_content(data: dict) -> None:
    assert len(data["signs"]) == 12 and len({x["id"] for x in data["signs"]}) == 12
    assert len(data["overall"]) == 36  # the +11 index stride makes each day distinct
    assert len(data["quizzes"]) >= 3
    for quiz in data["quizzes"]:
        assert len(quiz["questions"]) == 4
        assert all(len(q["choices"]) == 3 for q in quiz["questions"])
        assert all(c["type"] in quiz["results"] for q in quiz["questions"] for c in q["choices"])


def build(today: date, base: str) -> None:
    data = json.loads(CONTENT.read_text(encoding="utf-8"))
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    validate_content(data)
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SRC, DIST)
    current = today.isoformat()
    fortunes = fortunes_for(current, data)
    payload = {"content": data, "build_date": current, "fortunes": fortunes}
    homepage = (SRC / "index.html").read_text(encoding="utf-8")
    json_ld = json_safe_for_script({"@context": "https://schema.org", "@type": "WebSite", "name": "星と余白", "url": base, "description": "今日の星座占い・タロット・物語のような無料診断"})
    replacements = {
        "{{HOME_URL}}": h(base),
        "{{OG_IMAGE_URL}}": h(base + "assets/og.png"),
        "{{JSON_LD}}": json_ld,
        "{{TODAY_LONG}}": h(long_date(current)),
        "{{TODAY_SHORT}}": h(short_date(current)),
        "{{TODAY_QUOTE}}": h(pick(data["quotes"], f"{current}|quote")),
        "{{SIGN_GRID}}": sign_buttons(data),
        "{{FORTUNE_DETAIL}}": fortune_html(fortunes[0]),
        "{{QUIZ_CARDS}}": quiz_cards(data),
        "{{ARCHIVE_LIST}}": archive_links(today),
        "{{INLINE_JSON}}": json_safe_for_script(payload),
    }
    ad_script, ad_block = adsense_html(config)
    sponsored = affiliate_html(config.get("affiliate_links", []))
    replacements["{{AFFILIATE_SECTION}}"] = ad_block + sponsored
    for mark, replacement in replacements.items():
        homepage = homepage.replace(mark, replacement)
    if ad_script:
        homepage = homepage.replace("</head>", ad_script + "</head>", 1)
    homepage = homepage.replace("© 2026", f"© {today.year}")
    (DIST / "index.html").write_text(homepage, encoding="utf-8")

    # Google AdSense requires an ads.txt file at the site root for publishers
    # that use the authorized digital sellers file. Keep it generated from the
    # same config value so the public ID never needs to be duplicated by hand.
    if config.get("adsense_publisher_id"):
        (DIST / "ads.txt").write_text(
            f"google.com, {h(config['adsense_publisher_id']).removeprefix('ca-pub-')}, DIRECT, f08c47fec0942fa0\\n",
            encoding="utf-8",
        )

    operator = (h(config["operator_name"]) if config.get("operator_name") else "運営者の名称は公開前に設定します．")
    email = config.get("contact_email", "").strip()
    if email and re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        contact = f'メール：<a href="mailto:{h(email)}">{h(email)}</a>'
    elif email:
        raise ValueError("contact_email を有効なメールアドレスにしてください")
    else:
        contact = "お問い合わせ先は公開前に設定します．運営開始前に <code>config.json</code> の contact_email を設定してください．"
    if config.get("adsense_publisher_id"):
        ads_privacy = "当サイトではGoogle AdSenseによる広告を配信する場合があります．Googleなどの広告配信事業者は，広告の配信や測定のためCookie等の技術を使用する場合があります．詳細はGoogleの広告に関するポリシーをご確認ください．"
    else:
        ads_privacy = "現在，このサンプルサイトではアクセス解析ツールや第三者配信広告を組み込んでいません．広告や解析ツールを導入する場合は，実際の運用に合わせて本ページを更新します．"
    if sponsored:
        ads_privacy += " 当サイトにはアフィリエイト広告を含む場合があり，リンク先で購入が行われると運営者が紹介料を受け取ることがあります．"
    for filename in ("about.html", "privacy.html", "contact.html", "terms.html"):
        doc = (SRC / filename).read_text(encoding="utf-8")
        doc = doc.replace("{{OPERATOR_INFO}}", operator).replace("{{CONTACT_CONTENT}}", contact).replace("{{ADS_PRIVACY_TEXT}}", h(ads_privacy))
        doc = doc.replace("© 2026", f"© {today.year}")
        (DIST / filename).write_text(doc, encoding="utf-8")

    (DIST / "archive").mkdir()
    (DIST / "signs").mkdir()
    (DIST / "data").mkdir()
    for i, f in enumerate(fortunes):
        page_path = DIST / "signs" / f["id"]
        page_path.mkdir()
        (page_path / "index.html").write_text(make_sign_page(current, f, base), encoding="utf-8")
    for back in range(ARCHIVE_DAYS):
        archive_day = (today - timedelta(days=back)).isoformat()
        fortunes_day = fortunes_for(archive_day, data)
        archive_dir = DIST / "archive" / archive_day
        archive_dir.mkdir()
        (archive_dir / "index.html").write_text(make_archive_page(archive_day, fortunes_day, base), encoding="utf-8")
        (DIST / "data" / f"{archive_day}.json").write_text(json.dumps({"date": archive_day, "signs": fortunes_day}, ensure_ascii=False, indent=2), encoding="utf-8")
    (DIST / "data" / "today.json").write_text(json.dumps({"date": current, "signs": fortunes}, ensure_ascii=False, indent=2), encoding="utf-8")
    (DIST / "feed.xml").write_text(make_feed(today, data, base), encoding="utf-8")
    (DIST / "sitemap.xml").write_text(make_sitemap(today, data, base), encoding="utf-8")
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {base}sitemap.xml\n", encoding="utf-8")
    (DIST / ".nojekyll").touch()
    (DIST / "404.html").write_text(f'''<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ページが見つかりません | 星と余白</title><link rel="stylesheet" href="{h(base)}styles.css"></head><body class="simple-page"><main class="container simple-layout"><p class="section-kicker">LOST AMONG THE STARS</p><h1>ページが見つかりませんでした．</h1><p class="simple-lead">星の便りは，こちらから探してみてください．</p><a class="btn btn-dark" href="{h(base)}">トップへ戻る ↗</a></main></body></html>''', encoding="utf-8")
    (DIST / "social").mkdir()
    best = sorted(fortunes, key=lambda x: x["score"], reverse=True)[:3]
    lines = [f"【{long_date(current)} 今日の12星座占い】", "✧ 今日の星のことば", pick(data["quotes"], f"{current}|quote"), "", "ラッキーな星座 TOP 3（本日のエンタメスコア）"]
    lines.extend(f'{i + 1}．{f["name"]} {f["score"]}点' for i, f in enumerate(best))
    lines.extend(["", "今日の運勢はこちら", base, "", "#星占い #今日の運勢 #星と余白"])
    (DIST / "social" / "today.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Build complete: {DIST} | date={current} | url={base} | 12 zodiac pages + {ARCHIVE_DAYS} archives")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build 星と余白 to dist/")
    parser.add_argument("--date", type=date.fromisoformat, default=datetime.now(timezone(timedelta(hours=9), name="JST")).date())
    parser.add_argument("--site-url", default=None)
    args = parser.parse_args()
    config = json.loads(CONFIG.read_text(encoding="utf-8"))
    build(args.date, effective_url(config, args.site_url))


if __name__ == "__main__":
    main()
