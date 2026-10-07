import { afterEach, expect, test, vi } from 'vitest';
import { getBuiltinKeyboard } from '../src/builtinKeyboard.ts';

afterEach(() => vi.unstubAllEnvs());

test('bundled keyboard is available with no URL or network configuration', async () => {
  vi.stubEnv('BUILTIN_KEYBOARD', 'true');
  const script = await getBuiltinKeyboard();
  expect(script).toContain('rwv-touch-keyboard');
  expect(script).toContain('Password');
  expect(script).not.toMatch(/\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage)\b/);
});

test.each(['false', '0', 'off'])('operator can disable the keyboard with %s', value => {
  vi.stubEnv('BUILTIN_KEYBOARD', value);
  expect(getBuiltinKeyboard()).toBeUndefined();
});
