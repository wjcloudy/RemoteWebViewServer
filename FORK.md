# Homestead touch keyboard

This fork of [strange-v/RemoteWebViewServer](https://github.com/strange-v/RemoteWebViewServer)
adds a built-in touch keyboard for streamed displays. Upstream code retains its
MIT licence and attribution. The keyboard's MIT notice is in `keyboard/LICENSE.txt`.

Tap a text field and then the keyboard button in the lower-right corner. The
keyboard includes uppercase letters, numbers, symbols, Backspace, Tab, Space
and Enter. Tab selects the next visible editable field, including fields inside
open web-component shadow roots. Passwords stay masked in the original input;
the keyboard does not copy their values into its own UI, store them or log them.
Close returns to the page. Closed shadow roots and cross-origin embedded frames
are not supported.

The keyboard is drawn by Chromium and streamed with the page. Existing clients
send their normal touch events: no display firmware change or helper container
is needed. The asset is bundled in the image and loaded locally before every
new device page navigates. Set `BUILTIN_KEYBOARD=false` to disable it. The upstream
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
