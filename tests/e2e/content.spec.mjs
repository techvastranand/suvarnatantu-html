// Shared shell (header/nav/footer), API-backed Blog, FAQ and policies.
import { test, expect, IS_LIVE, settle, mockEngage, MOCK_POST } from './support.mjs';

const stateOf = (page, attr) => page.locator(`[${attr}]:not([hidden])`).first().getAttribute(attr);

test.describe('shell', () => {
  test('header, navigation and footer on the home page', async ({ page }, testInfo) => {
    await page.goto('/');
    await settle(page);
    const nav = page.locator('.site-nav');
    await expect(nav).toBeVisible();
    await expect(nav.locator('a.brand')).toHaveAttribute('href', '/');
    const toggle = nav.locator('.nav-toggle');
    if (testInfo.project.name === 'mobile-375') {
      await expect(toggle).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#site-menu')).toHaveClass(/open/);
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    } else {
      const products = nav.locator('details.nav-dropdown--products');
      await products.locator('summary').click();
      await expect(products).toHaveAttribute('open', '');
      await expect(products.locator('a[href="/products/"]')).toBeVisible();
    }
    const footer = page.locator('footer').last();
    await expect(footer).toBeAttached();
    for (const href of ['/privacy-policy/', '/terms/']) await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached();
  });

  test('shared shell renders on an inner page', async ({ page }) => {
    await page.goto('/about-us/');
    await settle(page);
    await expect(page.locator('.site-nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('footer a[href="/privacy-policy/"]').first()).toBeAttached();
  });
});

test.describe('blog', () => {
  test('list renders and opens a post', async ({ page }) => {
    await page.goto('/blog/');
    await expect.poll(() => stateOf(page, 'data-blog-state'), { timeout: 20_000 }).not.toBe('loading');
    const state = await stateOf(page, 'data-blog-state');
    if (!IS_LIVE) expect(state).toBe('ready');
    test.info().annotations.push({ type: 'blog-list-state', description: String(state) });
    if (state !== 'ready') { expect(['empty']).toContain(state); return; }
    const card = page.locator('[data-blog-grid] a[href*="/blog/"]').first();
    await expect(card).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/blog\/(post\/\?slug=|[a-z0-9-]+\/)/);
    await expect.poll(() => stateOf(page, 'data-blog-state'), { timeout: 20_000 }).toBe('ready');
    await expect(page.locator('[data-detail-title]')).not.toBeEmpty();
    await expect(page.locator('[data-detail-content]')).not.toBeEmpty();
    if (!IS_LIVE) {
      await expect(page.locator('[data-detail-title]')).toHaveText(MOCK_POST.title);
      expect(await page.evaluate(() => window.__bad)).toBeUndefined(); // API HTML is sanitised
      await expect(page.locator('[data-detail-content] script, [data-detail-content] [onclick]')).toHaveCount(0);
    }
  });

  test('unknown post shows not-found', async ({ page }) => {
    await page.goto('/blog/post/?slug=this-post-does-not-exist-e2e');
    await expect.poll(() => stateOf(page, 'data-blog-state'), { timeout: 20_000 }).toBe('not-found');
  });

  test('API outage shows the unavailable state (mocked)', async ({ page }) => {
    test.skip(IS_LIVE, 'needs a mocked outage');
    await mockEngage(page, { blogs: route => route.fulfill({ status: 503, body: '', headers: { 'Access-Control-Allow-Origin': '*' } }) });
    await page.goto('/blog/');
    await expect.poll(() => stateOf(page, 'data-blog-state'), { timeout: 20_000 }).toBe('unavailable');
  });
});

test.describe('faq', () => {
  test('search and accordion', async ({ page }) => {
    await page.goto('/faq/');
    await expect.poll(() => stateOf(page, 'data-faq-state'), { timeout: 20_000 }).not.toBe('loading');
    const state = await stateOf(page, 'data-faq-state');
    test.info().annotations.push({ type: 'faq-state', description: String(state) });
    if (IS_LIVE && state !== 'ready') {
      // Live FAQ can legitimately be empty; it must still show the fallback, not hang.
      expect(state).toBe('fallback');
      return;
    }
    expect(state).toBe('ready');
    const items = page.locator('[data-faq-list] details.sh-item');
    const total = await items.count();
    expect(total).toBeGreaterThan(0);
    const first = items.first();
    await first.locator('summary').click();
    await expect(first).toHaveAttribute('open', '');
    await expect(first.locator('.sh-answer')).toBeVisible();
    await first.locator('summary').click();
    await expect(first).not.toHaveAttribute('open', '');
    if (!IS_LIVE) {
      await page.fill('[data-faq-search]', 'denier');
      await expect(page.locator('[data-faq-list] details.sh-item:not([hidden])')).toHaveCount(1);
      await expect(page.locator('[data-faq-count]')).toContainText('1 question matches');
      await page.fill('[data-faq-search]', 'zzzz-no-match');
      await expect(page.locator('[data-faq-count]')).toContainText('No questions match');
      await page.locator('[data-faq-search]').press('Escape');
      await expect(page.locator('[data-faq-list] details.sh-item:not([hidden])')).toHaveCount(total);
      expect(await page.locator('script[data-faq-schema]').evaluate(el => el.textContent)).toContain('FAQPage');
    }
  });

  test('an empty FAQ shows the fallback and is noindex (mocked)', async ({ page }) => {
    test.skip(IS_LIVE, 'needs mocked data');
    await mockEngage(page, { faqs: route => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ message: 'ok', data: { site: 'suvarnatantu', categories: [] } }) }) });
    await page.goto('/faq/');
    await expect.poll(() => stateOf(page, 'data-faq-state'), { timeout: 20_000 }).toBe('fallback');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });
});

test.describe('policies', () => {
  test('policy index lists the legal pages', async ({ page }) => {
    await page.goto('/policies/');
    await expect.poll(() => stateOf(page, 'data-policy-state'), { timeout: 20_000 }).toBe('ready');
    const list = page.locator('[data-policy-list] a');
    await expect(list.filter({ hasText: /^Privacy Policy/ })).toHaveCount(1);
    await expect(list.filter({ hasText: /^Terms & Conditions/ })).toHaveCount(1);
    if (!IS_LIVE) await expect(list).toHaveCount(8); // 2 static + 6 API policies (privacy/terms de-duplicated)
    test.info().annotations.push({ type: 'policy-index-count', description: String(await list.count()) });
  });

  for (const handle of ['refund-policy', 'shipping-policy', 'contact-information', 'legal-notice', 'sample-policy', 'payment-terms']) {
    test(`policy page /policies/${handle}/`, async ({ page }) => {
      await page.goto(`/policies/${handle}/`);
      await expect.poll(() => stateOf(page, 'data-policy-state'), { timeout: 20_000 }).not.toBe('loading');
      const state = await stateOf(page, 'data-policy-state');
      test.info().annotations.push({ type: 'policy-state', description: `${handle}: ${state}` });
      await expect(page.locator('h1')).not.toBeEmpty();
      if (!IS_LIVE) {
        expect(state).toBe('ready');
        await expect(page.locator('[data-policy-body]')).toContainText(`Mock body for ${handle}`);
      } else {
        expect(['ready', 'not-found', 'unavailable']).toContain(state);
      }
    });
  }

  test('unknown generic policy is not-found and noindex', async ({ page }) => {
    await page.goto('/policies/view/?handle=no-such-policy-e2e');
    await expect.poll(() => stateOf(page, 'data-policy-state'), { timeout: 20_000 }).toBe('not-found');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  });

  for (const url of ['/privacy-policy/', '/terms/']) {
    test(`static legal page ${url}`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('main')).toContainText(/Suvarnatantu/);
    });
  }
});
