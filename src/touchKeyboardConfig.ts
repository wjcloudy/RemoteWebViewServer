export type TouchKeyboardConfig = {
  enabled: boolean;
  layout: 'qwerty' | 'qwertz' | 'azerty';
  theme: 'dark' | 'light' | 'auto';
  position: 'bottom-right' | 'bottom-left';
  autoOpen: boolean;
  longPress: boolean;
  longPressMs: number;
};

const defaults: TouchKeyboardConfig = {
  enabled: false, layout: 'qwerty', theme: 'dark', position: 'bottom-right', autoOpen: false,
  longPress: false, longPressMs: 650,
};

// Device parameters override server defaults, as with rendering settings.
// Invalid values are rejected instead of silently selecting another option.
export function readTouchKeyboardConfig(
  params = new URLSearchParams(), environment: NodeJS.ProcessEnv = process.env,
): TouchKeyboardConfig {
  const value = (parameter: string, variable: string) => params.get(parameter) ?? environment[variable];
  function boolean(raw: string | null | undefined, fallback: boolean): boolean {
    if (raw == null || raw.trim() === '') return fallback;
    if (/^(1|true|yes|on)$/i.test(raw.trim())) return true;
    if (/^(0|false|no|off)$/i.test(raw.trim())) return false;
    throw new Error('Invalid touch keyboard boolean');
  }
  function option<T extends string>(raw: string | null | undefined, choices: readonly T[], fallback: T): T {
    if (raw == null || raw.trim() === '') return fallback;
    const normalized = raw.trim().toLowerCase() as T;
    if (!choices.includes(normalized)) throw new Error('Invalid touch keyboard option');
    return normalized;
  }
  function holdDelay(raw: string | null | undefined): number {
    if (raw == null || raw.trim() === '') return defaults.longPressMs;
    const delay = Number(raw);
    if (!Number.isInteger(delay) || delay < 300 || delay > 2000) throw new Error('Invalid touch keyboard hold delay');
    return delay;
  }
  return {
    enabled: boolean(value('keyboard', 'TOUCH_KEYBOARD_ENABLED'), defaults.enabled),
    layout: option(value('keyboardLayout', 'TOUCH_KEYBOARD_LAYOUT'), ['qwerty', 'qwertz', 'azerty'], defaults.layout),
    theme: option(value('keyboardTheme', 'TOUCH_KEYBOARD_THEME'), ['dark', 'light', 'auto'], defaults.theme),
    position: option(value('keyboardPosition', 'TOUCH_KEYBOARD_POSITION'), ['bottom-right', 'bottom-left'], defaults.position),
    autoOpen: boolean(value('keyboardAutoOpen', 'TOUCH_KEYBOARD_AUTO_OPEN'), defaults.autoOpen),
    longPress: boolean(value('keyboardLongPress', 'TOUCH_KEYBOARD_LONG_PRESS'), defaults.longPress),
    longPressMs: holdDelay(value('keyboardLongPressMs', 'TOUCH_KEYBOARD_LONG_PRESS_MS')),
  };
}

export function touchKeyboardConfigsEqual(a?: TouchKeyboardConfig, b?: TouchKeyboardConfig): boolean {
  // Optional field preserves compatibility with existing DeviceConfig callers.
  const left = a ?? defaults, right = b ?? defaults;
  return left.enabled === right.enabled && left.layout === right.layout && left.theme === right.theme &&
    left.position === right.position && left.autoOpen === right.autoOpen &&
    left.longPress === right.longPress && left.longPressMs === right.longPressMs;
}
