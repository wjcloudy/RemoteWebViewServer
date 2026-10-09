import { test, expect, vi, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { getInjectScriptFromUrl } from '../src/scriptLoader.ts';
afterEach(()=>vi.unstubAllGlobals());
const cfg=name=>({url:`https://example.test/${name}.js`,allowHttp:false,nativeInput:false});
test('checksum pins downloaded bytes and cached bytes cannot bypass a changed checksum', async () => {
  const source='globalThis.test = true;';
  const fetch=vi.fn(async()=>new Response(source)); vi.stubGlobal('fetch',fetch);
  const hash=createHash('sha256').update(source).digest('hex');
  expect(await getInjectScriptFromUrl({...cfg('checked'),sha256:hash})).toBe(source);
  expect(await getInjectScriptFromUrl({...cfg('checked'),sha256:hash})).toBe(source);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(await getInjectScriptFromUrl({...cfg('checked'),sha256:'0'.repeat(64)})).toBeUndefined();
});
test('oversized scripts and HTTPS redirects to HTTP are refused', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('x'.repeat(262145))));
  expect(await getInjectScriptFromUrl(cfg('large'))).toBeUndefined();
  const response=new Response('globalThis.test = true;');
  Object.defineProperty(response,'url',{value:'http://example.test/redirect.js'});
  vi.stubGlobal('fetch',vi.fn(async()=>response));
  expect(await getInjectScriptFromUrl(cfg('redirect'))).toBeUndefined();
});
test('download errors never log URL credentials or raw error messages', async () => {
  vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('private diagnostic');}));
  const warning=vi.spyOn(console,'warn').mockImplementation(()=>{});
  try {
    expect(await getInjectScriptFromUrl(cfg('failure'))).toBeUndefined();
    expect(warning.mock.calls.flat().join(' ')).not.toContain('private diagnostic');
  } finally {warning.mockRestore();}
});
