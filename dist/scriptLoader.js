import { createHash } from "node:crypto";
let cachedKey;
let cachedScript;
function isAllowedProtocol(url, allowHttp) {
    if (url.protocol === "https:")
        return true;
    if (allowHttp && url.protocol === "http:")
        return true;
    return false;
}
export async function getInjectScriptFromUrl(cfg) {
    if (!cfg.url) {
        console.warn("[inject] INJECT_JS_URL is not set; script injection skipped");
        return undefined;
    }
    const cacheKey = JSON.stringify([cfg.url, cfg.allowHttp, cfg.sha256]);
    if (cachedKey === cacheKey && cachedScript) {
        return cachedScript;
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(cfg.url);
    }
    catch {
        console.warn("[inject] Invalid INJECT_JS_URL; script injection skipped");
        return undefined;
    }
    if (!isAllowedProtocol(parsedUrl, cfg.allowHttp)) {
        console.warn("[inject] INJECT_JS_URL must use https (or http when INJECT_JS_ALLOW_HTTP=true)");
        return undefined;
    }
    if (typeof fetch !== "function") {
        console.warn("[inject] fetch is not available in this Node runtime; script injection skipped");
        return undefined;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(parsedUrl, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "Accept": "application/javascript, text/javascript, text/plain;q=0.9, */*;q=0.8",
            },
        });
        if (!response.ok) {
            console.warn(`[inject] Failed to download script: HTTP ${response.status}; script injection skipped`);
            return undefined;
        }
        const finalUrl = new URL(response.url || cfg.url);
        if (!isAllowedProtocol(finalUrl, cfg.allowHttp))
            throw new Error('Disallowed redirect');
        const chunks = [];
        let length = 0;
        if (!response.body)
            throw new Error('No script body');
        for await (const chunk of response.body) {
            length += chunk.length;
            if (length > 262144) {
                controller.abort();
                throw new Error('Script exceeds limit');
            }
            chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        if (cfg.sha256 && createHash('sha256').update(bytes).digest('hex') !== cfg.sha256) {
            console.warn('[inject] Script checksum mismatch; injection skipped');
            return undefined;
        }
        const script = bytes.toString("utf8");
        if (!script.trim()) {
            console.warn("[inject] Downloaded script is empty; script injection skipped");
            return undefined;
        }
        cachedKey = cacheKey;
        cachedScript = script;
        return script;
    }
    catch (err) {
        console.warn("[inject] Script download failed; injection skipped");
        return undefined;
    }
    finally {
        clearTimeout(timeout);
    }
}
