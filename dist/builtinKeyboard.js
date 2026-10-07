// Homestead fork: bundled touch keyboard, loaded without network access.
// MIT licensed; see keyboard/LICENSE.txt. Upstream retains its own MIT notice.
import { readFile } from 'node:fs/promises';
let script;
export function getBuiltinKeyboard() {
    if (!/^(1|true|yes|on)$/i.test(process.env.BUILTIN_KEYBOARD ?? 'true'))
        return;
    // A missing bundled asset is a packaging error. Do not silently publish an
    // image whose displays have no way to type their login credentials.
    script ?? (script = readFile(new URL('../keyboard/keyboard.js', import.meta.url), 'utf8'));
    return script;
}
