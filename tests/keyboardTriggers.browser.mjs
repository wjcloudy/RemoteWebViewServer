import assert from 'node:assert/strict';
import { getTouchKeyboardScript, installTouchKeyboard } from '../dist/touchKeyboard.js';

export async function checkKeyboardTriggers(browser, defaults) {
  async function create(options) {
    const page = await browser.newPage({viewport:{width:480,height:480},hasTouch:true,isMobile:true});
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Page.enable');
    await installTouchKeyboard(cdp,{...defaults,...options});
    await page.goto(new URL('./keyboard.html',import.meta.url).href);
    const field = page.locator('demo-field[label="Username"] input');
    const open = () => page.locator('#rwv-touch-keyboard').evaluate(el => !el.shadowRoot.querySelector('.panel').hidden);
    async function begin() {
      const box = await field.boundingBox(); assert(box);
      const point = {x:box.x+box.width/2,y:box.y+box.height/2,id:1};
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
      return point;
    }
    const end = () => cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    return {page,cdp,field,open,begin,end};
  }

  const focus = await create({autoOpen:true,longPress:false});
  try {
    await focus.field.tap(); assert.equal(await focus.open(),true);
    await focus.page.getByRole('button',{name:'Close',exact:true}).tap();
    assert.equal(await focus.open(),false);
    await focus.field.tap(); assert.equal(await focus.open(),true,'tap of still-focused field reopens after Close');
    await focus.page.getByRole('button',{name:'Close',exact:true}).tap();
    await focus.field.evaluate(el=>{el.blur();el.readOnly=true;});
    await focus.field.tap(); assert.equal(await focus.open(),false,'read-only focus does not open');
  } finally {await focus.page.close();}

  const hold = await create({autoOpen:false,longPress:true,longPressMs:650});
  try {
    await hold.begin();
    await hold.page.waitForTimeout(250); assert.equal(await hold.open(),false,'does not open before hold threshold');
    await hold.page.waitForFunction(()=>!document.getElementById('rwv-touch-keyboard').shadowRoot.querySelector('.panel').hidden,{},{timeout:2000});
    await hold.end();
    assert.equal(await hold.open(),true,'native sustained touch opens shadow-root field');
    await hold.page.getByRole('button',{name:'a',exact:true}).tap();
    assert.equal(await hold.field.inputValue(),'a');
    await hold.page.getByRole('button',{name:'Close',exact:true}).tap();

    await hold.begin(); await hold.page.waitForTimeout(100); await hold.end();
    await hold.page.waitForTimeout(700); assert.equal(await hold.open(),false,'short tap cancels hold');

    const point=await hold.begin();
    await hold.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+30}]});
    await hold.page.waitForTimeout(700); await hold.end();
    assert.equal(await hold.open(),false,'drag cancels hold');

    await hold.begin();
    await hold.cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
    await hold.page.waitForTimeout(700); assert.equal(await hold.open(),false,'cancelled touch does not open');

    const first=await hold.begin();
    await hold.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[first,{...first,x:first.x+40,id:2}]});
    await hold.page.waitForTimeout(700); await hold.end();
    assert.equal(await hold.open(),false,'second finger cancels hold');

    await hold.begin(); await hold.field.evaluate(el=>el.readOnly=true);
    await hold.page.waitForTimeout(700); await hold.end();
    assert.equal(await hold.open(),false,'field becoming read-only cancels activation');
  } finally {await hold.page.close();}

  const delayed = await create({autoOpen:false,longPress:true,longPressMs:1100});
  try {
    await delayed.begin(); await delayed.page.waitForTimeout(750);
    assert.equal(await delayed.open(),false,'configured longer threshold is respected');
    await delayed.page.waitForFunction(()=>!document.getElementById('rwv-touch-keyboard').shadowRoot.querySelector('.panel').hidden,{},{timeout:1500});
    await delayed.end(); assert.equal(await delayed.open(),true);
  } finally {await delayed.page.close();}

  const manual = await create({autoOpen:false,longPress:false});
  try {
    await manual.begin(); await manual.page.waitForTimeout(800); await manual.end();
    assert.equal(await manual.open(),false,'disabled triggers preserve button-only behavior');
    await manual.page.getByRole('button',{name:'Open touch keyboard',exact:true}).tap();
    assert.equal(await manual.open(),true);
  } finally {await manual.page.close();}

  const initial = await browser.newPage({viewport:{width:480,height:480}});
  try {
    await initial.setContent('<input aria-label="Already focused">');
    await initial.getByLabel('Already focused').focus();
    await initial.addScriptTag({content:await getTouchKeyboardScript({...defaults,autoOpen:true})});
    assert.equal(await initial.getByRole('button',{name:'Close',exact:true}).isVisible(),true);
  } finally {await initial.close();}
  console.log('PASS: focus/reopen, existing focus, native hold/delay, short tap, drag, cancellation, multiple touches, read-only fields and button-only activation.');
}
