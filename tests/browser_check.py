#!/usr/bin/env python3
"""Browser regressions against a locally served build; no live external services."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import threading

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / 'artifacts/browser'
AXE = ROOT / 'node_modules/axe-core/axe.min.js'
FIXTURES = [
    '/', '/projects.html', '/books-read.html',
    '/how-much-time-ive-spent-on-math-academy.html',
    '/a-curated-list-of-systems-thinking-resources.html',
    '/part-4-how-tiny-physical-switches-learn-to-follow-instructions.html',
    '/part-5-how-1-plus-1-becomes-2.html',
    '/unit-circle.html', '/llm-exposure-eu-jobs-interactive.html',
    '/geomake/', '/how-to-design-a-zachlike/', '/how-to-design-a-zachlike/mechanics.html',
]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    if not AXE.exists():
        raise SystemExit('Run npm ci and build the site before browser checks.')
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT / 'out')))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f'http://127.0.0.1:{server.server_port}'
    report = {'pages': [], 'errors': [], 'flows': []}
    with sync_playwright() as playwright:
        options = {'executable_path': os.environ['CHROMIUM_EXECUTABLE']} if os.environ.get('CHROMIUM_EXECUTABLE') else {}
        browser = playwright.chromium.launch(**options)

        def context(**options):
            ctx = browser.new_context(viewport={'width': 390, 'height': 844}, color_scheme='light', reduced_motion='reduce', **options)
            ctx.route('**/*', lambda route: route.continue_() if route.request.url.startswith(base + '/') else route.abort())
            return ctx

        def page_in(ctx):
            page = ctx.new_page()
            page.set_default_timeout(7000)
            page.on('pageerror', lambda error: report['errors'].append({'url': page.url, 'error': str(error)}))
            return page

        def visit(page, path):
            page.mouse.move(0, 0)
            response = page.goto(base + path)
            assert response.status == 200, (path, response.status)
            if path == '/llm-exposure-eu-jobs-interactive.html':
                expect(page.locator('#explorer')).to_be_visible()

        def inspect(page, path, width, theme, accessibility=False):
            page.set_viewport_size({'width': width, 'height': 844})
            page.emulate_media(color_scheme=theme)
            visit(page, path)
            metrics = page.evaluate('''() => ({viewport: innerWidth, width: document.documentElement.scrollWidth,
                headingTop: document.querySelector('h1').getBoundingClientRect().top})''')
            violations = []
            if accessibility:
                page.add_script_tag(path=str(AXE))
                violations = page.evaluate('''async () => (await axe.run(document, {
                    runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21aa','best-practice']}
                })).violations.map(v => ({id:v.id, impact:v.impact, nodes:v.nodes.map(n => ({target:n.target, summary:n.failureSummary}))}))''')
            result = {'path': path, 'width': width, 'theme': theme, 'metrics': metrics, 'violations': violations}
            report['pages'].append(result)
            slug = path.strip('/').replace('/', '-').replace('.html', '') or 'home'
            if metrics['width'] > width + 1 or violations:
                report['errors'].append(result)
                page.screenshot(path=str(ARTIFACTS / f'failure-{slug}-{width}-{theme}.png'))
            elif path in ['/', '/unit-circle.html', '/llm-exposure-eu-jobs-interactive.html'] and width in (390, 1440):
                page.screenshot(path=str(ARTIFACTS / f'{slug}-{width}-{theme}.png'))

        try:
            ctx = context()
            page = page_in(ctx)
            paths = ['/' + path.relative_to(ROOT / 'out').as_posix() for path in sorted((ROOT / 'out').rglob('*.html'))
                     if path.relative_to(ROOT / 'out').as_posix() != 'how-to-design-a-zachlike/guide.html']
            for path in paths:
                inspect(page, path, 390, 'light', accessibility=True)
            print(f'Inspected {len(paths)} pages at phone width, including accessibility.', flush=True)
            for width in (320, 768, 1440):
                for theme in ('light', 'dark'):
                    for path in FIXTURES:
                        inspect(page, path, width, theme, accessibility=theme == 'dark' and width in (320, 1440))
                print(f'Checked {width}px fixtures in light and dark themes.', flush=True)
            ctx.close()

            # Primary navigation precedes long content; the skip link moves focus.
            ctx = context()
            page = page_in(ctx)
            visit(page, '/books-read.html')
            page.keyboard.press('Tab')
            expect(page.locator('.skip-link')).to_be_focused()
            page.keyboard.press('Enter')
            expect(page.locator('#content')).to_be_focused()
            visit(page, '/books-read.html')
            for _ in range(5):
                page.keyboard.press('Tab')
            expect(page.get_by_role('navigation', name='Main navigation').get_by_role('link', name='Projects')).to_be_focused()
            visit(page, '/part-3-how-tiny-physical-switches-learn-to-remember.html')
            page.locator('.series-nav summary').click()
            links = page.locator('.series-nav a')
            assert links.count() == 5
            assert 'part-1-' in links.first.get_attribute('href')
            assert links.nth(2).get_attribute('aria-current') == 'page'
            visit(page, '/how-to-design-a-zachlike/guide.html#domain')
            expect(page).to_have_url(base + '/how-to-design-a-zachlike/#domain')
            report['flows'].append('Navigation, skip link, series order, hash-preserving guide redirect')
            ctx.close()

            # Follow repeated system changes until an explicit preference is set.
            for path in ('/', '/geomake/', '/how-to-design-a-zachlike/', '/llm-exposure-eu-jobs-interactive.html'):
                ctx = context()
                page = page_in(ctx)
                visit(page, path)
                for theme in ('dark', 'light', 'dark', 'light'):
                    page.emulate_media(color_scheme=theme)
                    expect(page.locator('html')).to_have_attribute('data-theme', theme)
                    assert page.evaluate("localStorage.getItem('theme')") is None
                page.locator('#theme-toggle').click()
                expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
                page.emulate_media(color_scheme='dark')
                page.emulate_media(color_scheme='light')
                expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
                other = page_in(ctx)
                visit(other, path)
                expect(other.locator('html')).to_have_attribute('data-theme', 'dark')
                other.locator('#theme-toggle').click()
                expect(page.locator('html')).to_have_attribute('data-theme', 'light')
                other.evaluate("localStorage.removeItem('theme')")
                page.emulate_media(color_scheme='dark')
                expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
                ctx.close()
                ctx = context()
                ctx.add_init_script("Object.defineProperty(window, 'localStorage', {get() {throw new Error('Storage disabled');}})")
                page = page_in(ctx)
                visit(page, path)
                page.locator('#theme-toggle').click()
                expect(page.locator('html')).to_have_attribute('data-theme', 'dark')
                ctx.close()
            report['flows'].append('System appearance, explicit choice, cross-tab updates, blocked storage on four page types')
            print('Navigation and theme flows passed.', flush=True)

            ctx = context()
            page = page_in(ctx)
            visit(page, '/unit-circle.html')
            angle = page.locator('#angle-input')
            angle.focus()
            angle.press('ArrowRight')
            expect(angle).to_have_value('46')
            page.get_by_role('button', name='Tangent curve', exact=True).click()
            expect(page.get_by_role('button', name='Tangent curve', exact=True)).to_have_attribute('aria-pressed', 'true')
            page.get_by_role('button', name='Tutorial', exact=True).click()
            expect(page.locator('#tutorial-title')).to_be_focused()
            expect(page.locator('#tutorial-card')).to_be_visible()
            expect(angle).to_be_disabled()
            titles = []
            for step in range(1, 11):
                expect(page.locator('#tutorial-progress')).to_have_text(f'Step {step} of 10')
                titles.append(page.locator('#tutorial-title').inner_text())
                if step == 3:
                    page.locator('#tutorial-prev').click()
                    expect(page.locator('#tutorial-progress')).to_have_text('Step 2 of 10')
                    page.locator('#tutorial-next').click()
                    # Arrow keys on a native button do not consume a tutorial step.
                    page.locator('#tutorial-next').press('ArrowRight')
                    expect(page.locator('#tutorial-progress')).to_have_text('Step 3 of 10')
                    page.add_script_tag(path=str(AXE))
                    assert not page.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations")
                    page.screenshot(path=str(ARTIFACTS / 'unit-circle-tutorial-390.png'))
                page.locator('#tutorial-next').click()
            assert len(set(titles)) == 10
            expect(page.locator('#tutorial-card')).to_be_hidden()
            expect(angle).to_have_value('46')
            expect(angle).to_be_enabled()
            expect(page.get_by_role('button', name='Tangent curve', exact=True)).to_have_attribute('aria-pressed', 'true')
            page.get_by_role('button', name='Tutorial', exact=True).click()
            page.keyboard.press('Escape')
            expect(page.locator('#tutorial-card')).to_be_hidden()
            report['flows'].append('Unit circle: angle keys, toggles, all 10 tutorial steps, previous, exit, state restoration')
            ctx.close()

            # Table and chart use the same data, including zero-employment rows.
            data = json.loads((ROOT / 'static/data/job_market_data.json').read_text())
            ctx = context(has_touch=True)
            page = page_in(ctx)
            visit(page, '/llm-exposure-eu-jobs-interactive.html')
            expect(page.locator('#stat-avg')).to_have_text('4.4 / 10')
            cells = page.locator('.cell')
            assert cells.count() == sum(row['eu'] > 0 for row in data)
            cells.first.focus()
            expect(page.locator('#tooltip')).to_be_visible()
            cells.first.press('ArrowRight')
            expect(cells.nth(1)).to_be_focused()
            page.keyboard.press('Escape')
            expect(page.locator('#tooltip')).to_be_hidden()
            cells.nth(5).tap()
            expect(page.locator('#tooltip')).to_be_visible()
            box = page.locator('#tooltip').bounding_box()
            assert box['x'] >= 0 and box['x'] + box['width'] <= 390
            assert box['y'] >= 0 and box['y'] + box['height'] <= 844
            page.keyboard.press('Escape')
            page.get_by_role('button', name='Netherlands', exact=True).click()
            expect(page.locator('#stat-avg')).to_have_text('5.0 / 10')
            assert cells.count() == sum(row['nl'] > 0 for row in data)
            page.get_by_role('button', name='Table', exact=True).click()
            rows = page.locator('#occupation-rows tr')
            assert rows.count() == len(data)
            expect(rows.first.locator('th')).to_contain_text(max(data, key=lambda row: row['nl'])['title'])
            page.locator('#sort-select').select_option('exposure')
            assert rows.first.locator('td').nth(1).inner_text() == str(max(row['exposure'] for row in data))
            page.get_by_label('Search occupations').fill('teaching')
            assert rows.count() == 1
            expect(rows.first).to_contain_text('Teaching professionals')
            page.get_by_label('Search occupations').fill('no-such-occupation')
            expect(page.locator('#row-count')).to_contain_text('0 of 43')
            page.get_by_label('Search occupations').fill('')
            page.screenshot(path=str(ARTIFACTS / 'jobs-table-390.png'))
            report['flows'].append('Jobs: EU/NL totals, keyboard and tap details, bounded tooltip, complete/searchable/sortable table')
            ctx.close()

            for failure in ('data', 'chart'):
                ctx = context()
                pattern = '**/job_market_data.json' if failure == 'data' else '**/d3.v7.9.0.min.js*'
                ctx.route(pattern, lambda route: route.fulfill(status=503, body='Unavailable'))
                page = page_in(ctx)
                page.goto(base + '/llm-exposure-eu-jobs-interactive.html')
                if failure == 'data':
                    expect(page.locator('#load-status')).to_contain_text('could not load')
                    expect(page.locator('#retry')).to_be_visible()
                    ctx.unroute(pattern)
                    page.locator('#retry').click()
                    expect(page.locator('#explorer')).to_be_visible()
                else:
                    expect(page.locator('#table-panel')).to_be_visible()
                    assert page.locator('#occupation-rows tr').count() == len(data)
                ctx.close()
            report['flows'].append('Jobs: data failure and retry; chart-library failure retains the table')
            print('Visualization flows passed.', flush=True)

            ctx = context()
            page = page_in(ctx)
            for day in range(1, 8):
                path = '/geomake/' if day == 1 else f'/geomake/day-{day:02}.html'
                visit(page, path)
                directory = ROOT / f'apps/geomake/data/baca39e909561c5a/day-{day:02}'
                expected_answer = json.loads((directory / 'check.json').read_text())
                page.locator('#answer').fill(str(expected_answer))
                page.locator('#check').click()
                expect(page.locator('#feedback')).to_have_text('Correct.')
                for _ in range(3):
                    page.locator('#hint').click()
                    expect(page.locator('#hints li')).to_have_count(_ + 1)
                expect(page.locator('#hint')).to_be_disabled()
                page.locator('#explain').click()
                expect(page.locator('#solution')).to_be_visible()
                assert page.locator('#solution li').count() > 0
                page.locator('#explain').click()
                expect(page.locator('#solution')).to_be_hidden()
                page.reload()
                expect(page.locator('#answer')).to_have_value(str(expected_answer))
            report['flows'].append('Geomake: all seven answers, hints, solutions, and persisted input')
            ctx.close()

            # Observe lazy loading with a local fixture, never a live presence service.
            ctx = context()
            requests = []
            fail_widget = [True]
            def widget(route):
                requests.append(route.request.url)
                if fail_widget[0]:
                    route.fulfill(status=503, body='Unavailable', headers={'Access-Control-Allow-Origin': '*'})
                elif '.mjs' in route.request.url:
                    route.fulfill(body='export function mountTownSquare(root) { root.textContent = "Community fixture loaded"; }', content_type='text/javascript', headers={'Access-Control-Allow-Origin': '*'})
                else:
                    route.fulfill(body='#townsquare-root { min-height: 40px; }', content_type='text/css', headers={'Access-Control-Allow-Origin': '*'})
            ctx.route('https://townsquare.cauenapier.com/**', widget)
            page = page_in(ctx)
            visit(page, '/books-read.html')
            assert requests == []
            page.locator('#townsquare-root').scroll_into_view_if_needed()
            expect(page.locator('#townsquare-retry')).to_be_visible()
            fail_widget[0] = False
            page.locator('#townsquare-retry').click()
            expect(page.locator('#townsquare-root')).to_have_text('Community fixture loaded')
            expect(page.locator('#townsquare-retry')).to_be_hidden()
            report['flows'].append('TownSquare: stays unloaded above footer, isolated failure, explicit successful retry')
            ctx.close()
            print('Puzzle and widget flows passed.', flush=True)
        except Exception as error:
            report['errors'].append({'flow_error': str(error)})
            if 'page' in locals() and not page.is_closed():
                page.screenshot(path=str(ARTIFACTS / 'flow-failure.png'))
            raise
        finally:
            (ARTIFACTS / 'report.json').write_text(json.dumps(report, indent=2))
            browser.close()
            server.shutdown()
    if report['errors']:
        raise SystemExit(f'{len(report["errors"])} browser check failures; see {ARTIFACTS / "report.json"}')
    print(f'Browser checks passed: {len(report["pages"])} page/viewport/theme checks and {len(report["flows"])} interaction groups.')


if __name__ == '__main__':
    main()
