const defaults = {
    enabled: false, layout: 'qwerty', theme: 'dark', position: 'bottom-right', autoOpen: false,
    longPress: false, longPressMs: 650,
};
// Device parameters override server defaults, as with rendering settings.
// Invalid values are rejected instead of silently selecting another option.
export function readTouchKeyboardConfig(params = new URLSearchParams(), environment = process.env) {
    const value = (parameter, variable) => params.get(parameter) ?? environment[variable];
    function boolean(raw, fallback) {
        if (raw == null || raw.trim() === '')
            return fallback;
        if (/^(1|true|yes|on)$/i.test(raw.trim()))
            return true;
        if (/^(0|false|no|off)$/i.test(raw.trim()))
            return false;
        throw new Error('Invalid touch keyboard boolean');
    }
    function option(raw, choices, fallback) {
        if (raw == null || raw.trim() === '')
            return fallback;
        const normalized = raw.trim().toLowerCase();
        if (!choices.includes(normalized))
            throw new Error('Invalid touch keyboard option');
        return normalized;
    }
    function holdDelay(raw) {
        if (raw == null || raw.trim() === '')
            return defaults.longPressMs;
        const delay = Number(raw);
        if (!Number.isInteger(delay) || delay < 300 || delay > 2000)
            throw new Error('Invalid touch keyboard hold delay');
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
export function touchKeyboardConfigsEqual(a, b) {
    // Optional field preserves compatibility with existing DeviceConfig callers.
    const left = a ?? defaults, right = b ?? defaults;
    return left.enabled === right.enabled && left.layout === right.layout && left.theme === right.theme &&
        left.position === right.position && left.autoOpen === right.autoOpen &&
        left.longPress === right.longPress && left.longPressMs === right.longPressMs;
}
