[![Stand With Ukraine](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner-direct-single.svg)](https://stand-with-ukraine.pp.ua)

# Remote WebView Server

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

## On-screen keyboard

The optional built-in touch keyboard lets existing clients type into the page
without a firmware change. It is disabled by default. Enable it with
`TOUCH_KEYBOARD_ENABLED=true`, tap a field, then tap the keyboard button. Close
hides it; Tab and Enter follow the page's normal browser behavior.

| Environment variable | Client URL parameter | Default | Accepted values |
| --- | --- | --- | --- |
| `TOUCH_KEYBOARD_ENABLED` | `keyboard` | `false` | `true`, `false` |
| `TOUCH_KEYBOARD_LAYOUT` | `keyboardLayout` | `qwerty` | `qwerty`, `qwertz`, `azerty` |
| `TOUCH_KEYBOARD_THEME` | `keyboardTheme` | `dark` | `dark`, `light`, `auto` |
| `TOUCH_KEYBOARD_POSITION` | `keyboardPosition` | `bottom-right` | `bottom-right`, `bottom-left` |
| `TOUCH_KEYBOARD_AUTO_OPEN` | `keyboardAutoOpen` | `false` | `true`, `false` |

Client URL parameters override environment defaults for that device. For example,
`ws://server:8081/?id=display&w=480&h=480&keyboard=true&keyboardLayout=azerty`.
Reconnect to apply changed settings. Existing client firmware can use the server
environment settings without adding URL parameters. Invalid options close that
connection with WebSocket code 1008. No new client protocol messages are needed.

Layouts include uppercase, numbers and symbols; QWERTZ includes German umlauts,
and AZERTY includes French accents on the second symbol page. `auto` follows the
browser's color scheme. Automatic opening detects editable controls in the main
page and open shadow roots; the manual button remains available for other focus
targets. The keyboard adapts to the viewport and moves above lower-page fields.
Control labels are currently English; these are Latin layouts, not an IME.

The server uses Chromium's native text/key input, so selection, Backspace,
maxlength, number fields, textarea newlines, contenteditable and normal form
events work through the browser. Page scripts can still cancel editing or form
submission. Fields inside closed shadow roots or embedded frames may need the
manual button because their focus cannot be detected from the main document.

The bundled script does not read field values, store credentials, log input or
fetch external code. Its server binding accepts only short text and Backspace,
Tab or Enter from the current main document, with an ordered, bounded queue.
Each device has its own session and configuration. The keyboard is not an access
control mechanism: protect the server and stream as you would without it.
The asset's MIT notice is in [keyboard/LICENSE.txt](keyboard/LICENSE.txt).

You can also inject custom JavaScript into rendered pages using the independent
external-script hook:

- `INJECT_JS_URL` (empty by default): direct HTTPS URL to a JavaScript file. If set, the script is fetched once on startup and injected into every new page via `Page.addScriptToEvaluateOnNewDocument`.
- `INJECT_JS_ALLOW_HTTP` (`false` by default): allow plain HTTP URLs (HTTPS is strongly recommended).

> [!CAUTION]
>
> The injected script runs with full access to every page the server renders, including any active sessions, credentials, and cookies. Only use scripts from sources you fully trust. Never point this at a URL controlled by a third party.

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

Run `npm ci`, `npm run build`, `npm run test:run` and `npm run test:keyboard`.
The browser tests use Playwright's Chromium. Set `KEYBOARD_TEST_CHROMIUM` to an
installed Chromium executable if needed. They exercise native editing through
the same CDP binding as the server, multiple device sessions, configuration,
touch events and 320×240, 480×480 and 1024×600 viewports. Optional
`KEYBOARD_TEST_SCREENSHOTS` selects a local directory for generic preview images.
Test data is synthetic; do not put login credentials in fixtures.
