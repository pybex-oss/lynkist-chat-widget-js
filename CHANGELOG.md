# Changelog

## 0.2.0

- `offset({ bottom })` lifts the launcher above a bar at the bottom of the page (a cookie banner, a sticky cart); `offset(null)` resets. React: `useChatOffset(px)`, `requestOffset(px)` and the `offsetBottom` prop; the largest request wins. The CSS variable `--lynkist-chat-offset-bottom` (`OFFSET_VARIABLE`) does the same without code.
- `error` event (`ChatError`: `not_loaded` or `unavailable`) when the chat does not show; the widget also writes the reason to the console.
- `nonce` option on `loadLynkistChat` and `LynkistChat`, for a CSP with a nonce but no `'strict-dynamic'`.
- README: testing on localhost, troubleshooting, CSP with `'strict-dynamic'`.

## 0.1.0

- `loadLynkistChat`, `getLynkistChat`: load the widget once; typed `open`, `close`, `toggle`, `show`, `hide`, `identify`, `setAttributes`, `logout`, `on`, `off`. Calls before load are queued; no-op on the server.
- React: `LynkistChat`, `useHideChat` (counted hide requests), `requestHide`, `useLynkistChat`, `useChatEvent`.
