import { test, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { readInjectedOptions, readScriptHash, configureInjectedScript, makeConfigFromParams, deviceConfigsEqual } from '../src/config.ts';
test('configuration is bounded JSON data and errors do not disclose values', () => {
  for (const raw of ['[]','null','42','{private:secret}','x'.repeat(4097)]) {
    expect(()=>readInjectedOptions(raw)).toThrow(/Injected script configuration|injected script configuration/);
  }
  const raw=JSON.stringify({...JSON.parse('{"__proto__":{"private":true}}'),text:'";throw new Error(); //'});
  const options=readInjectedOptions(raw);
  const context={}; context.window=context; context.top=context;
  runInNewContext(configureInjectedScript('globalThis.installed = true;',options), context);
  expect(context.installed).toBe(true);
  expect(context.__rwvInjectedScriptConfig.text).toBe(options.text);
  expect(Object.hasOwn(context.__rwvInjectedScriptConfig,'__proto__')).toBe(true);
});
test('per-device options override defaults and trigger reconfiguration', () => {
  const a=makeConfigFromParams(new URLSearchParams('w=480&h=480&injectJsConfig=%7B%22mode%22%3A1%7D'));
  const b={...a,injectJsConfig:{mode:2}};
  expect(a.injectJsConfig).toEqual({mode:1});
  expect(deviceConfigsEqual(a,b)).toBe(false);
  expect(deviceConfigsEqual(a,{...a})).toBe(true);
});
test('only complete SHA-256 digests are accepted', () => {
  expect(readScriptHash('A'.repeat(64))).toBe('a'.repeat(64));
  expect(readScriptHash('')).toBeUndefined();
  expect(()=>readScriptHash('abc')).toThrow('Invalid injected script SHA-256');
});
