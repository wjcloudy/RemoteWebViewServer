import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { installNativeInput } from '../dist/nativeInput.js';
import { configureInjectedScript } from '../dist/config.js';
const browser=await chromium.launch({headless:true,...(process.env.KEYBOARD_TEST_CHROMIUM?{executablePath:process.env.KEYBOARD_TEST_CHROMIUM}:{})});
try {
  const page=await browser.newPage(); const cdp=await page.context().newCDPSession(page);
  await cdp.send('Page.enable'); await installNativeInput(cdp);
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:configureInjectedScript('globalThis.scriptReady = true;',{mode:'test'})});
  await page.goto('data:text/html,<input maxlength="1"><iframe srcdoc="<input>"></iframe>');
  assert.equal(await page.evaluate(()=>scriptReady && __rwvInjectedScriptConfig.mode==='test'),true);
  await page.locator('input').focus();
  await page.evaluate(()=>{
    document.querySelector('input').addEventListener('input',e=>globalThis.trusted=e.isTrusted);
    __rwvNativeInput(JSON.stringify({type:'text',text:'ab'}));
  });
  await page.waitForFunction(()=>document.querySelector('input').value==='a');
  assert.equal(await page.evaluate(()=>trusted),true);
  await page.frames()[1].evaluate(()=>__rwvNativeInput(JSON.stringify({type:'text',text:'z'})));
  await page.waitForTimeout(100); assert.equal(await page.locator('input').inputValue(),'a');
  await page.evaluate(()=>__rwvNativeInput(JSON.stringify({type:'key',key:'Backspace'})));
  await page.waitForFunction(()=>document.querySelector('input').value==='');
  console.log('PASS: external script configuration, native editing and iframe input isolation.');
} finally {await browser.close();}
