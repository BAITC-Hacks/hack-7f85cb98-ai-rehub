import { expect, test, type Page } from '@playwright/test';

async function choose(page: Page, slot: number, measure: string, district?: string) {
  const panel = page.locator('.plan-decision').nth(slot - 1);
  if (!(await panel.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await panel.locator('summary').click();
  }
  await page.getByRole('combobox', { name: `Мероприятие ${slot}`, exact: true }).selectOption(measure);
  if (district) await page.getByRole('combobox', { name: `Район ${slot}`, exact: true }).selectOption(district);
}

test('official plan, server fallback, best swap and recalculation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/analyze'));
  await page.goto('/');
  await expect(page.locator('.score-line')).toContainText('52,56');
  await expect(page.locator('.score-line strong')).toHaveText('56,54');
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect((await response.json()).source).toBe('fallback');
  await expect(page.locator('.analysis-panel')).toContainText('Локальный анализ');
  await expect(page.locator('.advisor-panel')).toContainText('57,21');
  await expect(page.locator('.advisor-panel')).toContainText('M5');
  await expect(page.locator('.advisor-panel')).toContainText('M3');
  await page.screenshot({ path: testInfo.outputPath('official-plan.png'), fullPage: true });
  const before = await page.locator('.plan-decision-code').allTextContents();
  await page.getByRole('button', { name: 'Применить замену', exact: true }).click();
  const after = await page.locator('.plan-decision-code').allTextContents();
  expect(after.filter((value, i) => value !== before[i])).toHaveLength(1);
  await expect(page.locator('.score-line strong')).toHaveText('—');
  await page.getByRole('button', { name: 'Рассчитать сценарий', exact: true }).click();
  await expect(page.locator('.score-line strong')).toHaveText('57,21');
  await expect(page.locator('.budget-heading')).toContainText('100');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('selection errors clear stale result and disable calculation', async ({ page }) => {
  await page.goto('/');
  await choose(page, 5, 'M4', 'nura');
  await expect(page.locator('.validation-note')).toContainText('M4');
  await expect(page.getByRole('button', { name: 'Рассчитать сценарий', exact: true })).toBeDisabled();
  await expect(page.locator('.score-line strong')).toHaveText('—');
  await page.getByRole('button', { name: 'Загрузить пример', exact: true }).click();
  await choose(page, 3, 'M1', 'yesil');
  await expect(page.locator('.validation-note')).toContainText(/бюджет|Бюджет/);
  await expect(page.getByRole('button', { name: 'Рассчитать сценарий', exact: true })).toBeDisabled();
  await choose(page, 3, '');
  await expect(page.locator('.decision-progress')).toContainText('4 / 5');
  await expect(page.getByRole('button', { name: 'Рассчитать сценарий', exact: true })).toBeDisabled();
  await choose(page, 3, 'M2');
  await expect(page.getByRole('combobox', { name: 'Район 3', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Мероприятие 3', exact: true }).locator('option[value="M7"]')).toHaveJSProperty('disabled', true);
});

test('local optimum shows signed candidate without claiming improvement', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await choose(page, 1, 'M2');
  await choose(page, 2, 'M3', 'nura');
  await choose(page, 3, 'M8', 'nura');
  await choose(page, 4, 'M9', 'nura');
  await choose(page, 5, 'M14');
  await page.getByRole('button', { name: 'Рассчитать сценарий', exact: true }).click();
  await expect(page.locator('.score-line strong')).toHaveText('57,24');
  await page.getByRole('button', { name: 'Найти лучшую замену', exact: true }).click();
  await expect(page.locator('.advisor-panel')).toContainText('Улучшение одной заменой не найдено');
  await expect(page.locator('.advisor-panel')).toContainText('57,23');
});

test('late AI response cannot overwrite edited plan', async ({ page }) => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let received!: () => void;
  const started = new Promise<void>(resolve => { received = resolve; });
  await page.route('**/api/analyze', async route => {
    received();
    await delayed;
    await route.fulfill({ json: {
      source: 'openai', summary: 'УСТАРЕВШИЙ АНАЛИЗ', strengths: [], risks: [], tradeoffs: [], recommendations: ['Не показывать старый результат.'],
    } }).catch(() => { /* The edited plan aborts this request. */ });
  });
  await page.goto('/');
  await started;
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  release();
  await expect(page.locator('.score-line strong')).toHaveText('—');
  await expect(page.getByText('УСТАРЕВШИЙ АНАЛИЗ', { exact: true })).toHaveCount(0);
  await expect(page.locator('.analysis-panel')).toContainText('после расчёта');
});

test('network failure has local analysis and working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/api/analyze', route => fail ? route.abort('failed') : route.continue());
  await page.goto('/');
  await expect(page.locator('.analysis-panel [role="alert"]')).toBeVisible();
  await expect(page.locator('.analysis-panel')).toContainText('56,54');
  fail = false;
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await expect(page.locator('.analysis-panel [role="alert"]')).toHaveCount(0);
  await expect(page.locator('.analysis-panel')).toContainText('Локальный анализ');
});
