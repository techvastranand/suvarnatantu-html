// axe-core: zero critical/serious violations. Every page on desktop; key templates at 375px.
import AxeBuilder from '@axe-core/playwright';
import { test, expect, PAGES, settle } from './support.mjs';

const MOBILE_PAGES = ['/', '/products/', '/metallic-yarn/m-type/', '/blog/', '/blog/post/?slug=practical-metallic-yarn-guide', '/faq/', '/policies/', '/policies/refund-policy/', '/request-quote/', '/samples/', '/zari-lab/', '/contact/', '/about-us/'];

for (const url of [...new Set([...PAGES, ...MOBILE_PAGES])]) {
  test(`a11y ${url}`, async ({ page }, testInfo) => {
    const desktopOnly = !MOBILE_PAGES.includes(url);
    test.skip(desktopOnly && testInfo.project.name !== 'desktop-chrome', 'mobile axe runs on key templates only');
    test.skip(url.startsWith('/blog/post/') && !!process.env.BASE_URL && !/127\.0\.0\.1|localhost/.test(process.env.BASE_URL), 'mock post only exists locally');
    await page.goto(url);
    await settle(page);
    // Reveal-on-scroll content must be in its final state before colour checks.
    await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('on')));
    await page.waitForTimeout(1100);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
    const summary = blocking.map(v => `${v.impact} ${v.id}: ${v.nodes.slice(0, 4).map(n => n.target.join(' ')).join(' | ')}${v.nodes.length > 4 ? ` (+${v.nodes.length - 4})` : ''}`);
    const minor = results.violations.filter(v => !['critical', 'serious'].includes(v.impact)).map(v => `${v.impact} ${v.id} (${v.nodes.length})`);
    if (minor.length) testInfo.annotations.push({ type: 'axe-moderate-minor', description: minor.join('; ') });
    expect(summary, `critical/serious axe violations on ${url}`).toEqual([]);
  });
}
