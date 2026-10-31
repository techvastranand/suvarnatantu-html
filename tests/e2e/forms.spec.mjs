// Enquiry forms: validation, error state and successful submit — network MOCKED only.
// Live runs only check that the forms render; nothing is ever submitted.
import { test, expect, IS_LIVE, INTAKE_URL, mockIntake, settle } from './support.mjs';

const FORMS = [
  {
    name: 'home business enquiry', url: '/', type: 'business',
    fill: { full_name: 'E2E Buyer', company: 'E2E Textiles', email: 'buyer@example.com', requirement: 'Gold zari for weaving' },
  },
  {
    name: 'request a quote', url: '/request-quote/', type: 'quote',
    fill: { company: 'E2E Textiles', contact: 'E2E Buyer', email: 'buyer@example.com', phone: '+91 99999 99999', country: 'India', state: 'Gujarat', city: 'Surat', product: 'M Type Metallic Yarn', productType: 'Metallic Yarn', quantity: '100' },
  },
  {
    name: 'request samples', url: '/samples/', type: 'sample',
    fill: { company: 'E2E Textiles', contact: 'E2E Buyer', email: 'buyer@example.com', phone: '9999999999', country: 'India', state: 'Gujarat', city: 'Surat', product: 'M Type Metallic Yarn', productType: 'Metallic Yarn', address: '1 Test Road', postalCode: '394230' },
  },
];

async function openForm(page, url) {
  await page.goto(url);
  await settle(page);
  const form = page.locator('form[data-enquiry-form]');
  await expect(form).toBeAttached();
  await expect(form.locator('[type=submit]')).toBeEnabled();
  return form;
}
async function fillForm(form, values) {
  for (const [name, value] of Object.entries(values)) {
    const control = form.locator(`[name="${name}"]`).first();
    if (await control.evaluate(el => el.tagName) === 'SELECT') await control.selectOption(value);
    else await control.fill(value);
  }
  await form.locator('[name="consent"]').check();
}
// Submit a filled form and wait until the mocked API has actually received it.
async function submitValid(form, captured) {
  const invalid = await form.evaluate(el => [...el.elements].filter(c => c.willValidate && !c.checkValidity()).map(c => c.name));
  expect(invalid, 'fields still invalid before submit').toEqual([]);
  await form.locator('[type=submit]').click();
  await expect.poll(() => captured.length, { timeout: 15_000 }).toBe(1);
}

for (const f of FORMS) {
  test.describe(`form: ${f.name}`, () => {
    test('renders with required fields and an enabled submit', async ({ page }) => {
      const form = await openForm(page, f.url);
      await form.scrollIntoViewIfNeeded();
      await expect(form).toBeVisible();
      expect(await form.locator('[required]').count()).toBeGreaterThan(2);
      await expect(form.locator('[name="consent"]')).toHaveAttribute('required', '');
      await expect(form.locator('.form-errors')).toHaveAttribute('aria-live', 'polite');
    });

    test('blocks an incomplete or invalid submission (no request sent)', async ({ page }) => {
      test.skip(IS_LIVE, 'live runs never interact with submit');
      const captured = await mockIntake(page);
      const form = await openForm(page, f.url);
      await form.locator('[type=submit]').click();
      expect(await form.evaluate(el => el.checkValidity())).toBe(false);
      await fillForm(form, { ...f.fill, email: 'not-an-email' });
      await form.locator('[type=submit]').click();
      expect(await form.locator('[name="email"]').evaluate(el => el.validity.typeMismatch)).toBe(true);
      await page.waitForTimeout(300);
      expect(captured).toEqual([]);
      await expect(page).toHaveURL(new RegExp(`${f.url.replace(/\//g, '\\/')}$`));
    });

    test('shows the error state when the API fails (mocked 500)', async ({ page }) => {
      test.skip(IS_LIVE, 'live runs never submit');
      const captured = await mockIntake(page, { status: 500, body: { detail: 'mock failure' } });
      const form = await openForm(page, f.url);
      await fillForm(form, f.fill);
      await submitValid(form, captured);
      await expect(form.locator('.form-errors')).toContainText('couldn’t submit your enquiry');
      await expect(form.locator('[type=submit]')).toBeEnabled();
      expect(captured).toHaveLength(1);
      await expect(page).toHaveURL(new RegExp(`${f.url.replace(/\//g, '\\/')}$`));
    });

    test('honeypot submissions are never sent', async ({ page }) => {
      test.skip(IS_LIVE, 'live runs never submit');
      const captured = await mockIntake(page);
      const form = await openForm(page, f.url);
      await fillForm(form, f.fill);
      await form.locator('[name="honeypot"]').evaluate(el => { el.value = 'bot'; });
      await form.locator('[type=submit]').click();
      await page.waitForTimeout(300);
      expect(captured).toEqual([]);
    });

    test('submits successfully and lands on the thank-you page (mocked)', async ({ page, diagnostics }) => {
      test.skip(IS_LIVE, 'live runs never submit');
      const captured = await mockIntake(page);
      const form = await openForm(page, f.url);
      await fillForm(form, f.fill);
      await submitValid(form, captured);
      await expect(page).toHaveURL(/\/enquiry-thank-you\/$/);
      expect(captured).toHaveLength(1);
      const [payload] = captured;
      expect(payload.enquiry_type).toBe(f.type);
      expect(payload.email).toBe('buyer@example.com');
      expect(payload.submission_uuid).toMatch(/^[0-9a-f-]{36}$/);
      expect(payload.honeypot).toBe('');
      expect(diagnostics.blocked).toEqual([]);
    });
  });
}

test('product configurator hands the requirement to the quote form', async ({ page }) => {
  await page.goto('/metallic-yarn/m-type/');
  await settle(page);
  const builder = page.locator('form[data-configurator]');
  await expect(builder).toBeAttached();
  if (IS_LIVE) return;
  await builder.locator('[name="colour"]').selectOption('Gold');
  await builder.locator('[name="quantity"]').fill('25');
  await expect(builder.locator('[data-whatsapp]')).toHaveAttribute('href', /wa\.me\/918154000962\?text=.*Gold/);
  await builder.locator('[data-go="/request-quote/"]').click();
  await expect(page).toHaveURL(/\/request-quote\/$/);
  const form = page.locator('form[data-enquiry-form]');
  await expect(form.locator('[name="product"]')).toHaveValue('M Type Metallic Yarn');
  await expect(form.locator('[name="colour"]')).toHaveValue('Gold');
});

test('product finder validates and recommends', async ({ page }) => {
  await page.goto('/products/');
  await settle(page);
  const finder = page.locator('form[data-product-finder]');
  await expect(finder).toBeVisible();
  if (IS_LIVE) return;
  await finder.locator('[type=submit]').click();
  await expect(page.locator('#product-finder-validation')).not.toBeEmpty();
  await finder.locator('[name="application"]').selectOption('saree');
  await finder.locator('[name="requirement"]').selectOption('metallic-yarn');
  await finder.locator('[name="knowledge"]').selectOption('yes');
  await finder.locator('[type=submit]').click();
  await expect(page.locator('[data-product-finder-secondary]')).toHaveAttribute('href', /\//);
});

test('guard: a real POST to the intake API can never leave the browser', async ({ page, diagnostics }) => {
  await page.goto('/');
  // No intake mock registered: the guard must abort it (this is the safety net for every test).
  const result = await page.evaluate(async url => {
    try { await fetch(url, { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }); return 'sent'; }
    catch { return 'blocked'; }
  }, INTAKE_URL);
  expect(result).toBe('blocked');
  expect(diagnostics.blocked.some(entry => entry.startsWith(`POST ${INTAKE_URL}`))).toBe(true);
});
