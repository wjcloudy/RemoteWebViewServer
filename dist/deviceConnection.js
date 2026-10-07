import { MsgType } from './protocol.js';
export function attachDeviceInput(ws, ready, router) {
    let queue = Promise.resolve();
    let pending = 0;
    let closed = false;
    ws.on('close', () => { closed = true; });
    ws.on('message', (message, isBinary) => {
        if (!isBinary || closed)
            return;
        const buffer = Buffer.isBuffer(message) ? message :
            Array.isArray(message) ? Buffer.concat(message) : Buffer.from(message);
        if (!buffer.length)
            return;
        if (pending >= 256) {
            ws.close(1008, 'Input queue full');
            return;
        }
        pending++;
        queue = queue.then(async () => {
            const device = await ready;
            if (closed)
                return;
            switch (buffer.readUInt8(0)) {
                case MsgType.Touch:
                    await router.handleTouchPacketAsync(device, buffer);
                    break;
                case MsgType.OpenURL:
                    await router.handleOpenURLPacketAsync(device, buffer);
                    break;
                case MsgType.FrameStats:
                    await router.handleFrameStatsPacketAsync(device, buffer);
                    break;
                case MsgType.Keepalive:
                    device.lastActive = Date.now();
                    break;
            }
        }).catch(error => console.warn(`Failed to handle device input: ${error.message}`))
            .finally(() => { pending--; });
    });
}
