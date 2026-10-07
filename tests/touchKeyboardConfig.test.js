import { expect, test } from 'vitest';
import { readTouchKeyboardConfig } from '../src/touchKeyboardConfig.ts';
import { makeConfigFromParams, deviceConfigsEqual } from '../src/config.ts';

test('keyboard is opt-in and reads documented defaults', () => {
  expect(readTouchKeyboardConfig(new URLSearchParams(), {})).toEqual({
    enabled: false, layout: 'qwerty', theme: 'dark', position: 'bottom-right', autoOpen: false,
    longPress: false, longPressMs: 650,
  });
});

test('device options override environment, including disabling an enabled server default', () => {
  const config = readTouchKeyboardConfig(new URLSearchParams(
    'keyboard=false&keyboardLayout=azerty&keyboardTheme=light&keyboardPosition=bottom-left&keyboardAutoOpen=true&keyboardLongPress=true&keyboardLongPressMs=900'), {
    TOUCH_KEYBOARD_ENABLED: 'true', TOUCH_KEYBOARD_LAYOUT: 'qwertz', TOUCH_KEYBOARD_THEME: 'auto',
    TOUCH_KEYBOARD_LONG_PRESS: 'false', TOUCH_KEYBOARD_LONG_PRESS_MS: '1000',
  });
  expect(config).toEqual({enabled:false,layout:'azerty',theme:'light',position:'bottom-left',autoOpen:true,longPress:true,longPressMs:900});
});

test.each(['1', 'true', 'YES', ' on '])('enables using %s', value => {
  expect(readTouchKeyboardConfig(new URLSearchParams(), {TOUCH_KEYBOARD_ENABLED:value}).enabled).toBe(true);
});
test.each(['0', 'false', 'NO', ' off '])('disables using %s', value => {
  expect(readTouchKeyboardConfig(new URLSearchParams(), {TOUCH_KEYBOARD_ENABLED:value}).enabled).toBe(false);
});
test.each(['keyboard=invalid', 'keyboardLayout=invalid', 'keyboardTheme=invalid',
  'keyboardPosition=invalid', 'keyboardAutoOpen=invalid', 'keyboardLongPress=invalid',
  'keyboardLongPressMs=299', 'keyboardLongPressMs=2001', 'keyboardLongPressMs=NaN',
  'keyboardLongPressMs=650.5'])('rejects invalid settings: %s', query => {
  expect(() => readTouchKeyboardConfig(new URLSearchParams(query), {})).toThrow();
});

test('reconnect changes to any keyboard option recreate the device session', () => {
  const base = makeConfigFromParams(new URLSearchParams('w=480&h=480&keyboard=true'));
  for (const query of ['keyboard=false','keyboardLayout=qwertz','keyboardTheme=auto',
    'keyboardPosition=bottom-left','keyboardAutoOpen=true','keyboardLongPress=true','keyboardLongPressMs=900']) {
    const params = new URLSearchParams('w=480&h=480&keyboard=true');
    const [key,value] = query.split('='); params.set(key,value);
    expect(deviceConfigsEqual(base, makeConfigFromParams(params))).toBe(false);
  }
});

test.each([300,650,2000])('allows hold delay %i ms', delay => {
  expect(readTouchKeyboardConfig(new URLSearchParams(), {TOUCH_KEYBOARD_LONG_PRESS_MS:String(delay)}).longPressMs).toBe(delay);
});
