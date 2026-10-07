import { readFile } from 'node:fs/promises';
export const KEYBOARD_BINDING = '__rwvTouchKeyboardInput';
let asset;
export function parseKeyboardInput(payload) {
    if (typeof payload !== 'string' || payload.length > 128)
        return;
    try {
        const message = JSON.parse(payload);
        if (!message || typeof message !== 'object' || Array.isArray(message))
            return;
        if (message.type === 'text' && typeof message.text === 'string' && message.text.length > 0 &&
            message.text.length <= 16 && !/[\u0000-\u001f\u007f]/.test(message.text)) {
            return { type: 'text', text: message.text };
        }
        if (message.type === 'key' && ['Backspace', 'Tab', 'Enter'].includes(message.key)) {
            return { type: 'key', key: message.key };
        }
    }
    catch { /* Ignore malformed page messages without logging typed data. */ }
}
export async function getTouchKeyboardScript(config) {
    if (!config?.enabled)
        return;
    asset ?? (asset = readFile(new URL('../keyboard/keyboard.js', import.meta.url), 'utf8'));
    return `${await asset}\n(${JSON.stringify(config)});`;
}
export async function installTouchKeyboard(session, config) {
    const source = await getTouchKeyboardScript(config);
    if (!source)
        return;
    const { frameTree } = await session.send('Page.getFrameTree');
    const mainFrame = frameTree.frame.id;
    const contexts = new Set();
    session.on('Runtime.executionContextCreated', ({ context }) => {
        if (context.auxData?.isDefault && context.auxData.frameId === mainFrame)
            contexts.add(context.id);
    });
    session.on('Runtime.executionContextDestroyed', ({ executionContextId }) => contexts.delete(executionContextId));
    session.on('Runtime.executionContextsCleared', () => contexts.clear());
    let pending = 0, queue = Promise.resolve();
    session.on('Runtime.bindingCalled', event => {
        if (event.name !== KEYBOARD_BINDING || !contexts.has(event.executionContextId) || pending >= 128)
            return;
        const input = parseKeyboardInput(event.payload);
        if (!input)
            return;
        pending++;
        queue = queue.then(async () => {
            // Navigation invalidates queued input from the previous document.
            if (!contexts.has(event.executionContextId))
                return;
            if (input.type === 'text') {
                await session.send('Input.insertText', { text: input.text });
            }
            else {
                const code = { Backspace: 8, Tab: 9, Enter: 13 }[input.key];
                await session.send('Input.dispatchKeyEvent', {
                    type: 'keyDown', key: input.key, code: input.key,
                    windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
                    ...(input.key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}),
                });
                await session.send('Input.dispatchKeyEvent', {
                    type: 'keyUp', key: input.key, code: input.key,
                    windowsVirtualKeyCode: code, nativeVirtualKeyCode: code,
                });
            }
        }).catch(() => {
            // Browser teardown/navigation can race with typing. Never log key values,
            // browser error text or payloads, which may include credentials.
        }).finally(() => { pending--; });
    });
    await session.send('Runtime.enable');
    await session.send('Runtime.addBinding', { name: KEYBOARD_BINDING });
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source });
}
