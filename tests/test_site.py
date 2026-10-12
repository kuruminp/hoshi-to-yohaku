import json
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import build


class SiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(build.CONTENT.read_text(encoding='utf-8'))

    def test_content_schema(self):
        build.validate_content(self.data)
        self.assertEqual(len(self.data['signs']), 12)

    def test_daily_fortune_is_repeatable(self):
        items = build.fortunes_for('2026-10-09', self.data)
        self.assertEqual(items, build.fortunes_for('2026-10-09', self.data))
        self.assertEqual({x['id'] for x in items}, {x['id'] for x in self.data['signs']})
        self.assertTrue(all(64 <= item['score'] <= 98 for item in items))

    def test_next_day_changes_fortune(self):
        current = build.fortunes_for('2026-10-09', self.data)
        next_day = build.fortunes_for('2026-10-10', self.data)
        self.assertNotEqual(current, next_day)

    def test_pages_base_url(self):
        self.assertEqual(build.effective_url({'site_url': 'https://example.org/a/'}, None), 'https://example.org/a/')
        self.assertEqual(build.effective_url({'site_url': ''}, 'https://example.org/a'), 'https://example.org/a/')

    def test_html_escapes_dynamic_text(self):
        self.assertEqual(build.h('<script>'), '&lt;script&gt;')
        self.assertNotIn('</script>', build.json_safe_for_script({'test': '</script>'}))

    def test_full_build_smoke(self):
        build.build(date(2026, 10, 9), 'https://example.org/hoshi-to-yohaku/')
        required = [
            'index.html', 'styles.css', 'app.js', 'assets/favicon.svg', 'assets/og.png',
            'privacy.html', 'about.html', 'terms.html', 'contact.html',
            'sitemap.xml', 'feed.xml', 'robots.txt', 'social/today.txt',
            'signs/aries/index.html', 'archive/2026-10-09/index.html',
            'data/today.json'
        ]
        for part in required:
            self.assertTrue((build.DIST / part).is_file(), part)
        homepage = (build.DIST / 'index.html').read_text(encoding='utf-8')
        self.assertNotIn('{{', homepage)
        self.assertIn('https://example.org/hoshi-to-yohaku/', homepage)
        self.assertIn('こころのかたち', homepage) if 'こころのかたち' in homepage else self.assertIn('心のかたち', homepage)
        self.assertEqual(len(list((build.DIST / 'signs').glob('*/index.html'))), 12)
        self.assertEqual(len(list((build.DIST / 'archive').glob('*/index.html'))), 14)
        payload = json.loads((build.DIST / 'data/today.json').read_text(encoding='utf-8'))
        self.assertEqual(payload['date'], '2026-10-09')
        self.assertEqual(len(payload['signs']), 12)


if __name__ == '__main__':
    unittest.main()
