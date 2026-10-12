"""Offline browser smoke test. Needs Playwright + chromium, not part of CI."""
import os
import sys
import subprocess
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
subprocess.check_call([sys.executable, str(root / 'scripts/build.py'), '--date', '2026-10-09', '--site-url', 'https://example.org/hoshi-to-yohaku/'])
html = (root / 'dist/index.html').read_text(encoding='utf-8')
css = (root / 'dist/styles.css').read_text(encoding='utf-8')
js = (root / 'dist/app.js').read_text(encoding='utf-8')
# Inline assets to permit testing in networks that disallow even localhost navigation.
html = html.replace('<link rel="stylesheet" href="./styles.css">', '<style>' + css + '</style>')
html = html.replace('<script src="./app.js" defer></script>', '<script>' + js + '</script>')
with sync_playwright() as p:
    launch_options = {'headless': True}
    if os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE'):
        launch_options['executable_path'] = os.environ['PLAYWRIGHT_CHROMIUM_EXECUTABLE']
    if os.name != 'nt':
        launch_options['args'] = ['--no-sandbox']
    browser = p.chromium.launch(**launch_options)
    screenshot_dir = Path(tempfile.gettempdir()) / 'hoshi-to-yohaku-smoke'
    screenshot_dir.mkdir(parents=True, exist_ok=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content(html, wait_until='load')
    page.screenshot(path=str(screenshot_dir / 'desktop.png'), full_page=True)
    print('TITLE:', page.title())
    print('FORTUNE:', page.locator('.fortune-headings h3').inner_text())
    page.locator('[data-sign="pisces"]').click()
    assert 'うお座' in page.locator('.fortune-headings h3').inner_text()
    print('FORTUNE AFTER SELECT:', page.locator('.fortune-headings h3').inner_text())
    page.locator('[data-quiz="heart-weather"]').click()
    assert page.locator('#quiz-dialog').evaluate('(el) => el.open')
    for i in range(4): page.locator('.quiz-choice').first.click()
    print('QUIZ RESULT:', page.locator('.quiz-result h3').inner_text())
    page.locator('#quiz-close').click()
    page.locator('[data-card-position="0"]').click()
    print('TAROT RESULT:', page.locator('#tarot-result-name').inner_text())
    assert not errors, errors
    mobile = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    mobile.set_content(html, wait_until='load')
    mobile.screenshot(path=str(screenshot_dir / 'mobile.png'), full_page=True)
    assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), 'mobile page horizontal scroll'
    browser.close()
    print('BROWSER: passing')
