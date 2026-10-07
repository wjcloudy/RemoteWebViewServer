# Homestead touch keyboard

This fork of [strange-v/RemoteWebViewServer](https://github.com/strange-v/RemoteWebViewServer)
adds a configurable built-in touch keyboard for streamed displays. Upstream code retains its
MIT licence and attribution. The keyboard's MIT notice is in `keyboard/LICENSE.txt`.

Tap a text field and then the keyboard button in the lower-right corner. The
keyboard includes uppercase letters, numbers, symbols, Backspace, Tab, Space
and Enter. Tab follows the page's native browser focus order. Passwords stay masked in the original input;
the keyboard does not copy their values into its own UI, store them or log them.
Close returns to the page. Automatic opening detects controls in the main document and open shadow roots;
other focused controls can use the manual button.

The keyboard is drawn by Chromium and streamed with the page. Existing clients
send their normal touch events: no display firmware change or helper container
is needed. The asset is bundled in the image and loaded locally before every
new device page navigates. It is now opt-in: set `TOUCH_KEYBOARD_ENABLED=true` to enable it. The earlier
`BUILTIN_KEYBOARD` flag is replaced by the documented `TOUCH_KEYBOARD_*` settings
in README.md. Layout, theme, position and automatic opening can also be selected
per display using URL parameters. The upstream
`INJECT_JS_URL` hook remains available independently for other extensions.

The fork also retains navigation and touch requests received while a device's
browser session is being prepared. The WebSocket listener starts after browser
bootstrap, and input is handled in order with a bounded queue. This prevents a
display from reconnecting to a blank page after its initial URL was missed.

The regular `dockerfile` builds and tests from source. `dockerfile.keyboard`
packages the changed compiled modules on the pinned upstream runtime, keeping
browser and dependency versions unchanged. Run `npm ci`, `npm run test:run`,
`npm run build` and `npm run test:keyboard` before using this variant. Compiled
modules in `dist/` are tracked, matching upstream's repository structure.

Keep `/pw-data` mounted to persistent storage to retain the browser profile.
This does not share the login session from your phone or computer: log in on
the display's own streamed browser page. No Home Assistant credentials belong
in display YAML, this repository or image environment variables.

The generalized implementation is maintained separately on
`codex/upstream-touch-keyboard`, based directly on current upstream main. That
branch excludes fork-specific image publishing and the separate startup fix.
It has not been submitted upstream pending physical-display tests.

## Fork image updates

The fork publishes an immutable `keyboard-<commit>` image and a rolling
`keyboard-test` tag in `ghcr.io/homestead-lab/remote-webview-server`. The latter
follows tested keyboard builds; it is not an upstream stable release channel.
Upstream's `strangev/remote-webview-server:latest` and `:beta` remain independent.

For a deployment pinned to a digest, Homestead needs the source tag recorded in
its deployment metadata to check for future updates. Preserve the digest and
record `ghcr.io/homestead-lab/remote-webview-server:keyboard-test` in
`homestead.io/update-sources`, keyed by the actual container name. For example:

```yaml
metadata:
  annotations:
    homestead.io/update-sources: '{"rwvserver":"ghcr.io/homestead-lab/remote-webview-server:keyboard-test"}'
```

A numbered upstream tag can be compared with newer numbered releases. An
immutable commit tag alone cannot identify the next keyboard build; use the
rolling test tag for discovery and the digest for the running image.
The publish workflow can promote an existing `keyboard-<commit>` tag without
rebuilding it, retaining the exact tested manifest digest.
