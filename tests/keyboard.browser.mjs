import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getTouchKeyboardScript, installTouchKeyboard } from '../dist/touchKeyboard.js';
import { readTouchKeyboardConfig } from '../dist/touchKeyboardConfig.js';
import { checkKeyboardTriggers } from './keyboardTriggers.browser.mjs';

const browser = await chromium.launch({headless: true,
  ...(process.env.KEYBOARD_TEST_CHROMIUM ? {executablePath: process.env.KEYBOARD_TEST_CHROMIUM} : {})});
try {
  const page = await browser.newPage({viewport: {width: 480, height: 480}, hasTouch: true, isMobile: true});
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const session = await page.context().newCDPSession(page);
  await session.send('Page.enable');
  const config = readTouchKeyboardConfig(new URLSearchParams('keyboard=true'), {});
  await installTouchKeyboard(session, config);
  await page.goto(new URL('./keyboard.html', import.meta.url).href);
  const username = page.locator('demo-field[label="Username"] input');
  const password = page.locator('demo-field[label="Password"] input');
  const key = async text => {await page.getByRole('button', {name: text, exact: true}).tap();};
  await username.evaluate(el => el.addEventListener('input',e => {window.nativeKeyboardInput = e.isTrusted;}));
  await username.tap(); await key('Open touch keyboard'); await key('Shift');
  for (const c of ['T','e','s','t']) await key(c);
  assert.equal(await username.inputValue(), 'Test');
  assert.equal(await page.evaluate(() => window.nativeKeyboardInput), true);
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
  await page.addScriptTag({content:await getTouchKeyboardScript(config)});
  assert.equal(await page.locator('#rwv-touch-keyboard').count(), 1);
  await page.setContent(`<form><input aria-label="Plain input"><button type="submit">Submit</button></form>
    <textarea aria-label="Notes"></textarea><input type="number" aria-label="Number">
    <div contenteditable="true" role="textbox" aria-label="Editor"></div>`);
  await page.addScriptTag({content:await getTouchKeyboardScript(config)});
  await page.locator('form').evaluate(el => el.addEventListener('submit', e => {e.preventDefault();window.submits=(window.submits||0)+1;}));
  await page.getByLabel('Plain input').focus(); await key('Open touch keyboard'); await key('a'); await key('Enter');
  assert.equal(await page.evaluate(() => window.submits),1);
  await page.getByLabel('Notes').focus(); await key('a'); await key('Enter'); await key('b');
  assert.equal(await page.getByLabel('Notes').inputValue(),'a\nb');
  await page.getByLabel('Number').focus(); await key('123'); await key('1'); await key('ABC'); await key('.'); await key('123'); await key('5');
  assert.equal(await page.getByLabel('Number').inputValue(),'1.5');
  await page.getByLabel('Editor').focus(); await key('ABC'); await key('c'); await key('d'); await key('⌫');
  assert.equal(await page.getByLabel('Editor').textContent(),'c');
  await key('Close');
  console.log('PASS: native form submission occurs once, textarea Enter, numeric editing and contenteditable.');

  // Independent page/session settings must not leak between displays.
  for (const [layout,theme,position,viewport] of [
    ['qwertz','light','bottom-left',{width:320,height:240}],
    ['azerty','auto','bottom-right',{width:480,height:480}],
    ['qwerty','dark','bottom-left',{width:1024,height:600}],
  ]) {
    const other = await browser.newPage({viewport,hasTouch:true,isMobile:true});
    const cdp = await other.context().newCDPSession(other); await cdp.send('Page.enable');
    const settings = {...config,layout,theme,position,autoOpen:true};
    await installTouchKeyboard(cdp,settings);
    await other.goto(new URL('./keyboard.html', import.meta.url).href);
    const input = other.locator('demo-field[label="Username"] input');
    await input.focus();
    assert.equal(await other.getByRole('button',{name:'Close',exact:true}).isVisible(),true);
    assert.equal(await other.locator('#rwv-touch-keyboard').getAttribute('data-position'),position);
    assert.equal(await other.locator('#rwv-touch-keyboard').getAttribute('data-theme'),theme === 'auto' ? 'light' : theme);
    const firstRow = await other.locator('#rwv-touch-keyboard').evaluate(el =>
      [...el.shadowRoot.querySelector('.row').children].map(b=>b.textContent).join(''));
    assert.equal(firstRow,{qwerty:'qwertyuiop',qwertz:'qwertzuiopü',azerty:'azertyuiop'}[layout]);
    const bounds = await other.locator('#rwv-touch-keyboard').evaluate(el => {
      const r=el.shadowRoot.querySelector('.panel').getBoundingClientRect();
      return {inside:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,width:r.width};
    });
    assert.equal(bounds.inside,true); assert.ok(bounds.width<=720);
    if (theme==='auto') {
      await other.emulateMedia({colorScheme:'dark'});
      await other.waitForFunction(() => document.getElementById('rwv-touch-keyboard').dataset.theme==='dark');
    }
    await other.getByRole('button',{name:layout === 'qwertz' ? 'ü' : 'a',exact:true}).tap();
    assert.equal(await input.inputValue(),layout === 'qwertz' ? 'ü' : 'a');
    assert.equal(await page.getByLabel('Plain input').inputValue(),'a');
    if (process.env.KEYBOARD_TEST_SCREENSHOTS) {
      await mkdir(process.env.KEYBOARD_TEST_SCREENSHOTS,{recursive:true});
      await other.screenshot({path:join(process.env.KEYBOARD_TEST_SCREENSHOTS,layout+'.png')});
    }
    await other.keyboard.press('Escape');
    assert.equal(await other.getByRole('button',{name:'Open touch keyboard',exact:true}).isVisible(),true);
    await other.close();
  }
  const disabled = await browser.newPage();
  await installTouchKeyboard(await disabled.context().newCDPSession(disabled),{...config,enabled:false});
  await disabled.goto(new URL('./keyboard.html',import.meta.url).href);
  assert.equal(await disabled.locator('#rwv-touch-keyboard').count(),0); await disabled.close();
  console.log('PASS: opt-in, per-display isolation, layouts, themes, position, automatic opening, Escape and 320×240 / 480×480 / 1024×600 bounds.');
  assert.deepEqual(errors, []);
  await checkKeyboardTriggers(browser,config);
  console.log('PASS: native input, shadow roots, case, symbols, Tab, selection, Unicode deletion, cancelled input, maxlength, Enter, read-only fields, password masking and bounds.');
} finally {
  await browser.close();
}
