# Remote WebView Server fork

This MIT-licensed fork retains the startup navigation fix and adds a generic,
opt-in native input bridge for external scripts. The upstream licence and
attribution remain in `LICENSE`.

The keyboard UI is maintained separately in
[RemoteWebViewKeyboard](https://github.com/wjcloudy/RemoteWebViewKeyboard).
It is loaded with upstream's `INJECT_JS_URL`, with bounded JSON configuration
and an optional SHA-256 check. See `README.md` for installation and migration
from the former `TOUCH_KEYBOARD_*` settings. There is no bundled keyboard UI.

The regular `dockerfile` builds from source. `dockerfile.keyboard` retains its
name for the existing image channel and layers the changed compiled server
modules onto the pinned upstream runtime used for validation. Run `npm ci`,
`npm run build`, `npm run test:run` and `npm run test:browser`; compiled `dist`
modules are committed. The image startup test fetches an external synthetic
script and exercises configuration and native input on the actual runtime.

The fork publishes an immutable `keyboard-<commit>` image and a rolling
`keyboard-test` tag in `ghcr.io/wjcloudy/remote-webview-server`. The latter
follows tested keyboard builds; it is not an upstream stable release channel.
Upstream's `strangev/remote-webview-server:latest` and `:beta` remain independent.

For a deployment pinned to a digest, Homestead needs the source tag recorded in
its deployment metadata to check for future updates. Preserve the digest and
record `ghcr.io/wjcloudy/remote-webview-server:keyboard-test` in
`homestead.io/update-sources`, keyed by the actual container name. For example:

```yaml
metadata:
  annotations:
    homestead.io/update-sources: '{"rwvserver":"ghcr.io/wjcloudy/remote-webview-server:keyboard-test"}'
```

A numbered upstream tag can be compared with newer numbered releases. An
immutable commit tag alone cannot identify the next keyboard build; use the
rolling test tag for discovery and the digest for the running image.
The publish workflow can promote an existing `keyboard-<commit>` tag without
rebuilding it, retaining the exact tested manifest digest.
