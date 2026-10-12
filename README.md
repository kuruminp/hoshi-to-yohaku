# Hoshi to Yohaku (Star & Space)

A Japanese-language entertainment site with a daily 12-sign horoscope, three interactive four-question quizzes, daily tarot, archive pages, RSS, a sitemap, and optional affiliate and AdSense placements.

The site does not use AI APIs or collect personal information. Horoscope text is selected deterministically from the local editorial library and the current JST date. Quiz answers stay in the browser; the optional once-a-day tarot selection is stored in local storage. The content is entertainment, not a scientific forecast or psychological assessment.

## Build and preview locally

Requires Python 3.9 or newer. The build uses only the Python standard library.

```bash
python scripts/build.py
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000/`. For a reproducible build with a public URL:

```bash
python scripts/build.py --date 2026-10-09 --site-url https://example.com/hoshi/
```

## Daily automation and commercial hosting

GitHub is used for source control and GitHub Actions builds the static site daily at **06:17 JST** and whenever code is pushed to `main`. The workflow tests and builds the site, then stores `dist/` as a downloadable Actions artifact. It does not publish the business site on GitHub Pages.

For production, create a Cloudflare Pages project using **Direct Upload** and configure these GitHub repository settings:

| Setting | Type | Purpose |
| --- | --- | --- |
| `SITE_URL` | Actions variable | Public HTTPS URL used for canonical links, sitemap, RSS, and robots.txt |
| `CLOUDFLARE_PAGES_DEPLOY_ENABLED` | Actions variable | Set to `true` to enable production deployment |
| `CLOUDFLARE_PAGES_PROJECT` | Actions variable | Cloudflare Pages project name |
| `CLOUDFLARE_ACCOUNT_ID` | Actions secret | Cloudflare account used for deployment |
| `CLOUDFLARE_API_TOKEN` | Actions secret | Scoped token for Cloudflare Pages deployment |

Until these settings are added, the workflow still runs the tests and builds a downloadable artifact, but does not deploy to a public host. Secrets belong in GitHub Actions secrets, never in this repository or `config.json`. The build output directory is `dist/`; no database or application server is required.

The scheduled job also records its successful run in `.github/last-scheduled-build.txt` to keep the schedule active on a quiet repository. GitHub may delay scheduled runs during high load.

## Content and configuration

- `content/content.json`: zodiac signs, daily phrases, tarot cards, quiz questions, and quiz results.
- `config.json`: public site URL, operator name, contact email, AdSense IDs, and optional affiliate links.
- `site/index.html`, `site/styles.css`, `site/app.js`: existing page template, styles, and browser interactions.
- `scripts/build.py`: static site generator. Produces the home page, 12 sign pages, 14 daily archives, JSON data, `sitemap.xml`, `robots.txt`, `feed.xml`, `ads.txt` when AdSense is configured, and social post text.
- `dist/`: generated output; it is ignored by Git.

Example affiliate entry in `config.json`:

```json
"affiliate_links": [
  {"title": "Recommended book", "description": "A short description", "url": "https://example.com/affiliate-link"}
]
```

Affiliate items are labeled PR and use `rel="sponsored"`. AdSense stays disabled until valid publisher and slot IDs are configured. Apply for and obtain approval from each advertising or affiliate service separately, then update privacy and legal information before enabling it. Publishing the site does not itself generate revenue.

Set a public-facing operator name and contact email before commercial launch. Review disclosures whenever third-party services are added. Never put passwords, API keys, or other secrets in `config.json` or a public repository.

## Tests

```bash
python -m unittest discover -s tests -v
python scripts/build.py
python scripts/build.py --date 2026-10-09 --site-url https://example.com/hoshi/
```

The optional `tests/visual_smoke.py` browser check requires Playwright and Chromium and is not part of the standard-library test suite.

## Operating notes

- Daily text is template-driven; it is not AI-generated news or an astronomical ephemeris.
- The generator rebuilds the most recent 14 archive days. Older archives are not retained.
- The workflow does not post to social networks or automate advertising approvals.
- Review the public contact, terms, and privacy pages before launch; the operator fields in `config.json` are intentionally blank.
