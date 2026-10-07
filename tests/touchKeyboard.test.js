import { expect, test, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { getTouchKeyboardScript, installTouchKeyboard, parseKeyboardInput, KEYBOARD_BINDING } from '../src/touchKeyboard.ts';
import { readTouchKeyboardConfig } from '../src/touchKeyboardConfig.ts';

const config = readTouchKeyboardConfig(new URLSearchParams('keyboard=true'), {});
function session() {
  const events = new EventEmitter();
  events.send = vi.fn(async (method) => {
    if (method === 'Page.getFrameTree') return {frameTree:{frame:{id:'main'}}};
    if (method === 'Runtime.enable') events.emit('Runtime.executionContextCreated',
      {context:{id:1,auxData:{isDefault:true,frameId:'main'}}});
    return {};
  });
  return events;
}
const input = (s, payload, context = 1) => s.emit('Runtime.bindingCalled',
  {name:KEYBOARD_BINDING,payload:JSON.stringify(payload),executionContextId:context});
const inputs = s => s.send.mock.calls.filter(([method]) => method.startsWith('Input.'));

test('disabled keyboard installs no bindings or scripts', async () => {
  const s = session(); await installTouchKeyboard(s); expect(s.send).not.toHaveBeenCalled();
  expect(await getTouchKeyboardScript({...config,enabled:false})).toBeUndefined();
});
test('bundled asset is configured locally without network, storage or reading field values', async () => {
  const script = await getTouchKeyboardScript({...config,layout:'azerty',theme:'light'});
  expect(script).toContain('"layout":"azerty"');
  expect(script).not.toMatch(/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\b|\b(?:el|target)\.value\b/);
});
test.each([null, [], {}, {type:'text',text:''}, {type:'text',text:'a'.repeat(17)},
  {type:'text',text:'\n'}, {type:'key',key:'F12'}, {type:'command',method:'Page.navigate'}])(
  'rejects non-keyboard payload %j', value => expect(parseKeyboardInput(JSON.stringify(value))).toBeUndefined());
test('rejects malformed and oversized messages', () => {
  expect(parseKeyboardInput('{')).toBeUndefined();
  expect(parseKeyboardInput(' '.repeat(129))).toBeUndefined();
});
test('accepts Unicode text and only the supported native keys', () => {
  expect(parseKeyboardInput('{"type":"text","text":"ü"}')).toEqual({type:'text',text:'ü'});
  for (const key of ['Backspace','Tab','Enter']) expect(parseKeyboardInput(JSON.stringify({type:'key',key}))).toEqual({type:'key',key});
});
test('types native events in order, never accepting an arbitrary CDP command', async () => {
  const s = session(); await installTouchKeyboard(s, config);
  input(s,{type:'text',text:'a'}); input(s,{type:'key',key:'Enter'}); input(s,{type:'text',text:'b'});
  await vi.waitFor(() => expect(inputs(s)).toHaveLength(4));
  expect(inputs(s).map(([method]) => method)).toEqual(['Input.insertText','Input.dispatchKeyEvent','Input.dispatchKeyEvent','Input.insertText']);
  expect(inputs(s)[1][1]).toMatchObject({key:'Enter',type:'keyDown',text:'\r'});
});
test('ignores iframe and destroyed-document inputs', async () => {
  const s = session(); await installTouchKeyboard(s, config);
  s.emit('Runtime.executionContextCreated',{context:{id:2,auxData:{isDefault:true,frameId:'iframe'}}});
  input(s,{type:'text',text:'a'},2);
  input(s,{type:'text',text:'b'});
  s.emit('Runtime.executionContextDestroyed',{executionContextId:1});
  await Promise.resolve(); await Promise.resolve();
  expect(inputs(s)).toHaveLength(0);
});
test('queue is bounded while browser input is blocked', async () => {
  const s = session(); await installTouchKeyboard(s, config);
  let release; const wait = new Promise(resolve => release = resolve);
  s.send.mockImplementation(async method => method.startsWith('Input.') ? wait : {});
  for (let i=0;i<200;i++) input(s,{type:'text',text:'a'});
  release(); await vi.waitFor(() => expect(inputs(s)).toHaveLength(128));
});
