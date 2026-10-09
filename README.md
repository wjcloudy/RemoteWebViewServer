[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner-direct-single.svg)](https://stand-with-ukraine.pp.ua)

# Remote WebView Server

**Homestead fork:** see [FORK.md](FORK.md) for packaging and the separately
maintained startup fix and generic native input bridge. The touch keyboard is
maintained in its own project and loaded through the upstream external-script hook.

Headless browser that renders target web pages (e.g., Home Assistant dashboards) and streams them as image tiles over WebSocket to lightweight [clients](https://github.com/strange-v/RemoteWebViewClient) (ESP32 displays). The server supports multiple simultaneous clients, each with its own screen resolution, orientation, and per-device settings.

![Remote WebView](/images/tiled_preview.png)

## Features

- Renders pages in a headless Chromium environment and streams diffs as tiles over WebSocket.
- Tile merging with change detection to reduce packet count and CPU load
- Full-frame fallback on cadence/threshold or on demand
- Configurable tile size, JPEG quality, WS message size, and min frame interval
- Per-client settings: each connection can supply its own width, height, tileSize, jpegQuality, maxBytesPerMessage, etc.
- Hot reconfigure: reconnecting with new params reconfigures the device session and triggers a full-frame refresh.
- Smarter frame gating: throttling + content-hash dedup (skip identical frames)
- No viewers = no work: frames are ACK’d to keep Chromium streaming, but tiles aren’t encoded/queued when there are no listeners.
- Touch event bridging (down/move/up) — scrolling supported (no gestures yet)
- Client-driven navigation: the client can control which page to open.
- Built-in self-test page to visualize and measure render time
- Health endpoint for container orchestration
- Optional DevTools access via TCP proxy

## External scripts and touch keyboard

The [touch keyboard](https://github.com/wjcloudy/RemoteWebViewKeyboard) is a
separate MIT-licensed component loaded through the upstream `INJECT_JS_URL`
hook. Its layout, theme and opening gestures are maintained outside this server.
Existing display firmware does not need an update.

```yaml
INJECT_JS_URL: https://raw.githubusercontent.com/wjcloudy/RemoteWebViewKeyboard/v1.0.0/dist/keyboard.js
INJECT_JS_NATIVE_INPUT: 'true'
INJECT_JS_CONFIG: '{"keyboard":{"showButton":false,"cornerHold":true,"shortcutCorner":"bottom-right","longPressMs":650}}'
```

Tap a field, then hold the bottom-right corner for 650 ms. Close hides it.
See the component's README for other opening modes and settings.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `INJECT_JS_URL` | Empty | Direct HTTPS script URL; pin a release or full commit |
| `INJECT_JS_ALLOW_HTTP` | `false` | Allow HTTP for trusted local scripts |
| `INJECT_JS_SHA256` | Empty | Expected SHA-256 of the downloaded file |
| `INJECT_JS_CONFIG` | `{}` | JSON object exposed as `globalThis.__rwvInjectedScriptConfig` |
| `INJECT_JS_NATIVE_INPUT` | `false` | Enable the optional native text/key bridge |

Configuration is limited to 4096 UTF-8 bytes. The per-display `injectJsConfig`
URL parameter replaces the default JSON object; reconnect to apply changes.
Invalid JSON closes that display connection with code 1008. Do not put secrets
in script configuration. Configuration and typed input are not logged.

Scripts are limited to 256 KiB and fetched with a five-second timeout. Failed
fetches or checksum mismatches skip injection, preserving ordinary streaming.
The script is cached within the process; restart to apply a new URL/hash.
The native input bridge is installed only when a script loads and is explicitly
opted in. It accepts short text (1-16 UTF-16 units, no control characters) and
Backspace/Tab/Enter through `__rwvNativeInput(JSON.stringify(message))`, where
message is `{type:'text',text:'a'}` or `{type:'key',key:'Enter'}`. Inputs from
iframes or obsolete documents are ignored; the ordered queue is bounded at 128.
The bridge exposes no arbitrary browser commands and never logs input payloads.

The former `TOUCH_KEYBOARD_*` settings have moved to the keyboard object's JSON
configuration. This server contains no keyboard asset or keyboard-specific
configuration. Stock upstream has the external-script hook but does not supply
this optional native input bridge.

> [!CAUTION]
>
> Injected scripts have access to the rendered page and its authenticated session.
> Only install code you trust. Use a pinned URL and SHA-256 for reproducibility.

## Accessing the server’s tab with Chrome DevTools

1. Make sure your server exposes the DevTools (CDP) port (e.g., 9222).
   - If you use a pure Docker container, make sure you have configured and started `debug-proxy`
   - If HA OS addon is used, enable `expose_debug_proxy`
1. In Chrome, go to chrome://inspect/#devices → Configure… → add your host: hostname_or_ip:9222.
1. You should see the page the server opened (the one you want to log into, e.g., Home Assistant). Click inspect to open a full DevTools window for that tab.

## Image Tags & Versioning

- latest — newest stable release
- beta — newest pre-release (rolling)
- Semantic versions: X.Y.Z, plus convenience tags X.Y, X on stable releases

You can pin a stable release (`1.4.0`) or track channels (`latest`, `beta`) depending on your deployment strategy.

## Docker Compose Example

```yaml
services:
  rwvserver:
    image: strangev/remote-webview-server:latest  # use :beta for pre-release
    container_name: remote-webview-server
    restart: unless-stopped
    environment:
      TILE_SIZE: 32
      FULL_FRAME_TILE_COUNT: 4
      FULL_FRAME_AREA_THRESHOLD: 0.5
      FULL_FRAME_EVERY: 50
      EVERY_NTH_FRAME: 1
      MIN_FRAME_INTERVAL_MS: 80
      JPEG_QUALITY: 85
      MAX_BYTES_PER_MESSAGE: 14336
      WS_PORT: 8081
      DEBUG_PORT: 9221 # internal debug port
      HEALTH_PORT: 18080
      PREFERS_REDUCED_MOTION: false
      TOUCH_KEYBOARD_ENABLED: false  # enable for touch-only displays
      TOUCH_KEYBOARD_LAYOUT: qwerty
      TOUCH_KEYBOARD_THEME: dark
      TOUCH_KEYBOARD_POSITION: bottom-right
      TOUCH_KEYBOARD_AUTO_OPEN: false
      TOUCH_KEYBOARD_LONG_PRESS: false
      TOUCH_KEYBOARD_LONG_PRESS_MS: 650
      INJECT_JS_URL: "https://example.com/keyboard.js"
      INJECT_JS_ALLOW_HTTP: false
      USER_DATA_DIR: /pw-data
      BROWSER_LOCALE: "en-US"
    ports:
      - "8081:8081"                   # WebSocket stream
      - "9222:9222"                   # external DevTools via socat
    expose:
      - "18080"                       # health endpoint (internal)
      - "9221"                        # internal DevTools port
    volumes:
      - /opt/volumes/esp32-rdp/pw-data:/pw-data
    shm_size: 1gb
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:18080 || exit 1"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 10s

  debug-proxy:
    image: alpine/socat
    container_name: remote-webview-server-debug
    restart: unless-stopped
    network_mode: "service:rwvserver"
    depends_on:
      rwvserver:
        condition: service_healthy
    command:
      - "-d"
      - "-d"
      - "TCP-LISTEN:9222,fork,reuseaddr,keepalive" # external DevTools port
      - "TCP:127.0.0.1:9221"
```

## Keyboard development and testing

Run `npm ci`, `npm run build`, `npm run test:run` and `npm run test:browser`.
The browser tests use Playwright's Chromium. Set `KEYBOARD_TEST_CHROMIUM` to an
installed Chromium executable if needed. They exercise native editing through
the same CDP binding as the server, multiple device sessions, configuration,
touch events and 320×240, 480×480 and 1024×600 viewports. Optional
`KEYBOARD_TEST_SCREENSHOTS` selects a local directory for generic preview images.
Test data is synthetic; do not put login credentials in fixtures.
