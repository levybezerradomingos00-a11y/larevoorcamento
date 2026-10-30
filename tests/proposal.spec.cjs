const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const { PDFDocument } = require('pdf-lib');

test('nome e valores atualizam todas as páginas, inclusive centavos e zero', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.locator('#clientName').fill('Bianca & Família');
  await page.locator('#setupPrice').fill('4.500,50');
  await page.locator('#housePrice').fill('2.200,25');
  await expect(page.locator('[data-client]')).toHaveText(Array(3).fill('Bianca & Família'));
  await expect(page.locator('[data-amount="setup"]')).toHaveText(['4.500,50', '4.500,50']);
  await expect(page.locator('[data-amount="house"]')).toHaveText(['2.200,25', '2.200,25']);
  await expect(page.locator('[data-amount="total"]')).toHaveText('6.700,75');
  await page.locator('#setupPrice').fill('0,10');
  await page.locator('#housePrice').fill('0,20');
  await expect(page.locator('[data-amount="total"]')).toHaveText('0,30');
  await page.locator('#setupPrice').fill('0');
  await page.locator('#housePrice').fill('0');
  await expect(page.locator('[data-amount="total"]')).toHaveText('0');
  await expect(page.locator('#pdfButton')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('entradas inválidas não geram PDF nem mantêm um total desatualizado', async ({ page }) => {
  await page.goto('/');
  for (const value of ['', '-1', '3.0', '1,234', '1e3', '100.000.000,00']) {
    await page.locator('#setupPrice').fill(value);
    await expect(page.locator('#pdfButton')).toBeDisabled();
    await expect(page.locator('[data-amount="total"]')).toHaveText('—');
  }
  await page.locator('#setupPrice').fill('R$ 3.500,50');
  await page.locator('#housePrice').focus();
  await expect(page.locator('#setupPrice')).toHaveValue('3.500,50');
  await page.locator('#clientName').fill('   ');
  await expect(page.locator('#pdfButton')).toBeDisabled();
});

test('impressão tem três páginas e nenhum conteúdo invade o rodapé', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.toolbar')).toBeHidden();
  const bounds = await page.locator('.page').evaluateAll(pages => pages.map(page => {
    const footer = page.querySelector('.foot').getBoundingClientRect();
    const children = Array.from(page.children).filter(el => !el.classList.contains('foot'));
    return { height: page.getBoundingClientRect().height, maxBottom: Math.max(...children.map(el => el.getBoundingClientRect().bottom)), footer: footer.top };
  }));
  expect(bounds).toHaveLength(3);
  for (const box of bounds) {
    expect(box.height).toBeCloseTo(793.69, 0);
    expect(box.maxBottom).toBeLessThan(box.footer - 5);
  }
  const path = testInfo.outputPath('impressao-nativa.pdf');
  await page.pdf({ path, preferCSSPageSize: true, printBackground: true });
  const pdf = await PDFDocument.load(await fs.readFile(path));
  expect(pdf.getPageCount()).toBe(3);
  for (let i = 0; i < 3; i++) await page.locator('.page').nth(i).screenshot({ path: testInfo.outputPath(`pagina-${i + 1}.png`) });
});

test('Baixar PDF gera arquivo real de três páginas sem chamar impressão', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { window.print = () => { throw new Error('O download não deve chamar window.print'); }; });
  await page.goto('/');
  await page.locator('#clientName').fill('Bianca');
  await page.locator('#setupPrice').fill('3.500,50');
  await page.locator('#housePrice').fill('2.100,25');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF', exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('LAREVO HOME - Proposta - Bianca.pdf');
  const path = testInfo.outputPath('proposta-bianca.pdf');
  await download.saveAs(path);
  const bytes = await fs.readFile(path);
  expect(bytes.length).toBeGreaterThan(100000);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(3);
  for (const page of pdf.getPages()) {
    expect(page.getWidth()).toBeCloseTo(841.89, 1);
    expect(page.getHeight()).toBeCloseTo(595.28, 1);
  }
  await expect(page.locator('#pdfButton')).toBeEnabled();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.locator('#editStatus')).toContainText('PDF gerado');
  await expect(page.getByRole('button', { name: 'Imprimir', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('celular mantém campos acessíveis e baixa as mesmas três páginas', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.locator('#clientName').fill('Residencial Jardim das Palmeiras');
  await page.locator('#setupPrice').fill('6.000');
  await expect(page.locator('[data-amount="total"]')).toHaveText('8.000');
  const width = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: innerWidth }));
  expect(width.body).toBeLessThanOrEqual(width.viewport);
  const downloaded = page.waitForEvent('download');
  await page.locator('#pdfButton').click();
  const download = await downloaded;
  const path = testInfo.outputPath('proposta-mobile.pdf');
  await download.saveAs(path);
  const pdf = await PDFDocument.load(await fs.readFile(path));
  expect(pdf.getPageCount()).toBe(3);
});

test('falha no carregamento do PDF exibe erro e permite tentar novamente', async ({ page }) => {
  await page.route('**/vendor/jspdf.umd.min.js', route => route.abort());
  await page.goto('/');
  await page.locator('#pdfButton').click();
  await expect(page.locator('#editStatus')).toContainText('As bibliotecas de PDF não carregaram');
  await expect(page.locator('#pdfButton')).toBeEnabled();
  await expect(page.locator('#clientName')).toBeEnabled();
});

test('exporta mesmo com folha de estilos de outra origem injetada na prévia', async ({ page }, testInfo) => {
  await page.route('https://preview-styles.invalid/extra.css', route => route.fulfill({
    status: 200, contentType: 'text/css', body: ':root { --preview-marker: 1; }'
  }));
  await page.goto('/');
  const blocked = await page.evaluate(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://preview-styles.invalid/extra.css';
    await new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; document.head.append(link); });
    try { void link.sheet.cssRules; return false; } catch (error) { return error.name === 'SecurityError'; }
  });
  expect(blocked).toBe(true);
  const downloaded = page.waitForEvent('download', { timeout: 10000 });
  await page.locator('#pdfButton').click();
  const download = await downloaded;
  const path = testInfo.outputPath('proposta-css-bloqueado.pdf');
  await download.saveAs(path);
  const bytes = await fs.readFile(path);
  expect(bytes.length).toBeGreaterThan(100000);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
  await expect(page.locator('#editStatus')).toContainText('PDF gerado');
});
