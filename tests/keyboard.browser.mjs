import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const browser = await chromium.launch({headless: true,
  ...(process.env.KEYBOARD_TEST_CHROMIUM ? {executablePath: process.env.KEYBOARD_TEST_CHROMIUM} : {})});
try {
  const page = await browser.newPage({viewport: {width: 480, height: 480}});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(new URL('./keyboard.html', import.meta.url).href);
  const username = page.locator('demo-field[label="Username"] input');
  const password = page.locator('demo-field[label="Password"] input');
  const key = text => page.getByRole('button', {name: text, exact: true}).click();
  await username.click(); await key('Open touch keyboard'); await key('Shift');
  for (const c of ['T','e','s','t']) await key(c);
  assert.equal(await username.inputValue(), 'Test');
  await key('Tab'); await key('a'); await key('123');
  for (const c of ['1','@','+']) await key(c);
  await key('#+='); for (const c of ['{','~']) await key(c); await key('⌫');
  assert.equal(await password.inputValue(), 'a1@+{');
  assert.equal(await page.locator('#rwv-touch-keyboard').evaluate(el =>
    el.shadowRoot.textContent.includes('a1@+{')), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await key('ABC');
  await password.evaluate(el => el.setSelectionRange(1, 4)); await key('b');
  assert.equal(await password.inputValue(), 'ab{');
  await password.evaluate(el => {el.value = 'a😀'; el.setSelectionRange(3,3);});
  await key('⌫'); assert.equal(await password.inputValue(), 'a');
  await password.evaluate(el => el.addEventListener('beforeinput', e => e.preventDefault(), {once: true}));
  await key('z'); assert.equal(await password.inputValue(), 'a');
  await password.evaluate(el => {el.maxLength = 1;}); await key('z');
  assert.equal(await password.inputValue(), 'a');
  await password.evaluate(el => el.addEventListener('keydown', e => {
    if (e.key === 'Enter') {window.keyboardEnter = true; e.preventDefault();}
  }, {once:true}));
  await key('Enter'); assert.equal(await page.evaluate(() => window.keyboardEnter), true);
  await password.evaluate(el => el.readOnly = true); await key('z');
  assert.equal(await password.inputValue(), 'a');
  await key('Close');
  assert.equal(await page.getByRole('button', {name:'Open touch keyboard', exact:true}).isVisible(), true);
  await page.addScriptTag({path: fileURLToPath(new URL('../keyboard/keyboard.js', import.meta.url))});
  assert.equal(await page.locator('#rwv-touch-keyboard').count(), 1);
  assert.deepEqual(errors, []);
  console.log('Keyboard browser checks passed: shadow roots, case, symbols, Tab, selection, Unicode deletion, cancelled input, maxlength, Enter, read-only fields, password masking and bounds.');
} finally {
  await browser.close();
}
