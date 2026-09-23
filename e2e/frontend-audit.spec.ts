import { expect, test, type Page } from '@playwright/test';

const example = [
  { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
];

async function seed(page: Page, plan: unknown, language = 'ru', theme = 'light') {
  await page.addInitScript(({ plan, language, theme }) => {
    localStorage.setItem('akim-saved-plan', typeof plan === 'string' ? plan : JSON.stringify(plan));
    localStorage.setItem('akim-language', language);
    localStorage.setItem('akim-theme', theme);
  }, { plan, language, theme });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', language);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

test('responsive layouts, languages and themes stay usable', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const widths = testInfo.project.name === 'mobile' ? [320, 390] : [768, 1366];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const language of ['ru', 'kk', 'en']) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(({ language, theme }) => {
          localStorage.setItem('akim-language', language);
          localStorage.setItem('akim-theme', theme);
        }, { language, theme });
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('lang', language);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('.analysis-panel')).toContainText(/56[,.]54/);
        await expect(page.locator('.analysis-panel')).toHaveAttribute('aria-busy', 'false');
        expect(await page.evaluate(() => ({
          page: document.documentElement.scrollWidth <= innerWidth,
          panels: [...document.querySelectorAll('.plan-panel, .scenario-summary, .district-detail, .advisor-panel, .analysis-panel')]
            .every(element => element.scrollWidth <= element.clientWidth + 1),
          labelledSelects: [...document.querySelectorAll('select')].every(element => !!element.getAttribute('aria-label')),
        })), `${width}/${language}/${theme}`).toEqual({ page: true, panels: true, labelledSelects: true });
        await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({ path: testInfo.outputPath(`${width}-${language}-${theme}.png`) });
        if ((width === 320 && language === 'kk' && theme === 'light') ||
            (width === 1366 && language === 'ru' && theme === 'light') ||
            (width === 390 && language === 'en' && theme === 'dark') ||
            (width === 768 && language === 'en' && theme === 'dark')) {
          await page.locator('.analysis-panel').screenshot({ path: testInfo.outputPath(`${width}-${language}-${theme}-analysis.png`) });
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test('keyboard can open decision editors and select a district', async ({ page }) => {
  await page.goto('/');
  const summary = page.locator('.plan-decision summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.plan-decision').first()).toHaveJSProperty('open', true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: 'Мероприятие 1', exact: true })).toBeFocused();
  expect(await page.locator(':focus').evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
  const district = page.locator('.district-card').first();
  await district.focus();
  await page.keyboard.press('Enter');
  await expect(district).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.detail-heading h3')).toContainText('Есиль');
});

test('saved plan and preferences survive reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Применить замену', exact: true }).click();
  await page.getByRole('button', { name: 'Рассчитать сценарий', exact: true }).click();
  await page.locator('.control-select select').selectOption('en');
  await page.locator('.theme-switch').click();
  await page.locator('.topbar-save').click();
  await expect(page.locator('.topbar-save')).toContainText('Plan saved');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.score-line strong')).toHaveText('57.21');
  await expect(page.locator('.budget-heading')).toContainText('100');
  await expect(page.locator('.topbar-save')).toContainText('Plan saved');
});

test('corrupt saved JSON falls back to a working example', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await seed(page, '{broken');
  await expect(page.locator('.score-line strong')).toHaveText('56,54');
  await expect(page.locator('.calculate-button')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('invalid saved timestamp is ignored without losing a valid plan', async ({ page }) => {
  await seed(page, { decisions: example, savedAt: 'broken' });
  await expect(page.locator('.score-line strong')).toHaveText('56,54');
  await expect(page.locator('.topbar-save')).toHaveText('Сохранить план');
  await expect(page.locator('body')).not.toContainText('Invalid Date');
});

test('all simultaneous violations remain visible', async ({ page }) => {
  await seed(page, { decisions: [
    { measureId: 'M1', districtId: 'nura' }, { measureId: 'M3', districtId: 'yesil' },
    { measureId: 'M4', districtId: 'nura' }, { measureId: 'M7', districtId: 'nura' },
    { measureId: 'M13', districtId: 'nura' },
  ] });
  await expect(page.locator('.validation-note li')).toHaveCount(3);
  await expect(page.locator('.validation-note')).toContainText('115');
  await expect(page.locator('.validation-note')).toContainText('M1 / M3');
  await expect(page.locator('.validation-note')).toContainText('M4 / M7');
  await expect(page.locator('.calculate-button')).toBeDisabled();
  await expect(page.locator('.score-line strong')).toHaveText('—');
});

for (const language of ['kk', 'en']) {
  test(`missing district identifies its measure in ${language}`, async ({ page }) => {
    await seed(page, { decisions: [{ measureId: 'M1' }, ...example.slice(1)] }, language);
    await expect(page.locator('.validation-note')).toContainText('M1');
    await expect(page.locator('.calculate-button')).toBeDisabled();
  });

  test(`negative indicator and remaining critical metric are explained in ${language}`, async ({ page }) => {
    await seed(page, { decisions: [
      { measureId: 'M4', districtId: 'yesil' }, { measureId: 'M9', districtId: 'nura' },
      { measureId: 'M10', districtId: 'nura' }, { measureId: 'M11', districtId: 'nura' },
      { measureId: 'M12' },
    ] }, language);
    await expect(page.locator('.analysis-panel')).toContainText(/55[,.]00 → 53[,.]25/);
    await expect(page.locator('.analysis-panel')).toContainText(/−1[,.]75/);
    await expect(page.locator('.analysis-panel')).toContainText(/S2: 37[,.]63/);
    await expect(page.locator('.analysis-panel')).not.toContainText('OpenAI');
  });
}

test('delayed advisor cannot restore an obsolete plan', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Найти лучшую замену', exact: true }).click();
  await page.getByRole('button', { name: 'Сбросить', exact: true }).click();
  await page.clock.runFor(300);
  await expect(page.locator('.score-line strong')).toHaveText('—');
  await expect(page.locator('.advisor-apply')).toHaveCount(0);
  await expect(page.locator('.advisor-panel')).not.toContainText('57,21');
});
