import http from 'http';
import { WebSocketServer } from "ws";
import env from "env-var";
import { makeConfigFromParams, setConfigFor, logDeviceConfig } from "./config.js";
import { broadcaster, ensureDeviceAsync, cleanupIdleAsync } from './deviceManager.js';
import { InputRouter } from "./inputRouter.js";
import { bootstrapAsync } from './browser.js';
import { attachDeviceInput } from './deviceConnection.js';
const WS_PORT = env.get("WS_PORT").default("8081").asIntPositive();
const HEALTH_PORT = env.get("HEALTH_PORT").default("18080").asIntPositive();
const inputRouter = new InputRouter();
await bootstrapAsync();
// Do not accept a display connection before its browser can be prepared.
const wss = new WebSocketServer({ port: WS_PORT, perMessageDeflate: false });
wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `ws://localhost:${WS_PORT}`);
    const id = url.searchParams.get("id") || "default";
    let cfg;
    try {
        cfg = makeConfigFromParams(url.searchParams);
    }
    catch {
        ws.close(1008, 'Invalid device configuration');
        return;
    }
    setConfigFor(id, cfg);
    logDeviceConfig(id, cfg);
    broadcaster.addClient(id, ws);
    const ready = ensureDeviceAsync(id, cfg);
    attachDeviceInput(ws, ready, inputRouter);
    ready.catch(error => {
        console.warn(`Failed to prepare device: ${error.message}`);
        ws.close(1011, 'Device initialization failed');
    });
    ws.on("close", () => {
        broadcaster.removeClient(id, ws);
        ready.then(dev => { dev.lastActive = Date.now(); }).catch(() => { });
    });
});
http.createServer(async (req, res) => {
    try {
        res.writeHead(200);
        res.end('ok');
    }
    catch (e) {
        res.writeHead(500);
        res.end('err');
    }
}).listen(HEALTH_PORT);
setInterval(() => cleanupIdleAsync(), 60000);
console.log(`[server] WebSocket listening on :${WS_PORT}`);
