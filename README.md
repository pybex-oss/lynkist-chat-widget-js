# @lynkist/chat-widget

Add [Lynkist Website Chat](https://lynkist.io/website-chat) to any website, with a typed API and React bindings.

- Loads the same widget as the snippet in the Lynkist dashboard, from `chat.lynkist.io`. The widget is not bundled, so it is always up to date.
- Safe to call before the widget loads: calls wait in a queue and run in order.
- Safe on the server (Next.js, Remix, Astro): every function does nothing outside a browser.
- No dependencies. React 17+ is optional.

## Install

```bash
npm install @lynkist/chat-widget
```

Get your widget key in the dashboard: **Channels → Website Chat → your widget → Install**. Add your site to **Security → Allowed websites**, or the chat does not show.

## Any site

```ts
import { loadLynkistChat } from '@lynkist/chat-widget'

const chat = loadLynkistChat({ widgetKey: 'wk_…' })

chat.open()        // open the chat window
chat.close()
chat.hide()        // no launcher on this page until show()
chat.show()
chat.on('unread', (count) => updateBadge(count))
```

Load the widget once per page. The chat follows route changes of a single-page app (React Router, Next.js, Vue Router) by itself.

## Test on your own computer

The chat shows only on the sites in the widget's **Security → Allowed websites**, on `https`. To try it on a dev server, switch on **Allow localhost for testing** there: it allows `http` and `https`, any port, on `localhost` and `127.0.0.1`. Switch it off when you are done.

## When the chat does not show

The widget writes the reason to the browser console (`[Lynkist] …`) and sends an `error` event:

```ts
chat.on('error', (error) => report(error.code, error.message))
```

| `code` | Meaning |
|---|---|
| `not_loaded` | The chat window sent nothing in 20 seconds. Usually the site is not in Allowed websites, or your CSP `frame-src` does not allow the chat host. Also a wrong widget key, or no connection. |
| `unavailable` | The widget is switched off, not published, or not in your plan. |

Outside business hours with "hide" chosen, the chat does not show, and that is not an error.

## A bar at the bottom of your page

A cookie banner or a sticky "Add to cart" bar sits where the launcher is. Lift the launcher above it instead of hiding the chat:

```ts
chat.offset({ bottom: 96 })   // px on top of the widget's own offset; offset(null) resets
```

or with CSS alone, also when the bar's height changes:

```css
:root { --lynkist-chat-offset-bottom: var(--cookie-banner-height, 0px); }
```

`offset()` wins over the CSS variable. On a phone the open chat window still fills the screen.

## React and Next.js

Put `LynkistChat` once in your root layout. It renders nothing; the widget draws its own launcher.

```tsx
import { LynkistChat } from '@lynkist/chat-widget/react'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <LynkistChat widgetKey="wk_…" />
      </body>
    </html>
  )
}
```

The React entry is a client module (`'use client'`), so a Server Component layout can render it.

### Hide the chat on some screens

```tsx
import { useHideChat } from '@lynkist/chat-widget/react'

function PaymentStep() {
  useHideChat() // hidden while this component is mounted
  // …
}

function StickyCheckoutBar({ visible }) {
  useHideChat(visible) // hidden only while `visible` is true
  // …
}
```

Hide requests are counted: the chat stays hidden while at least one mounted component asks for it, so two screens never undo each other. `<LynkistChat hidden />` is one more request, for example for your own staff:

```tsx
<LynkistChat widgetKey="wk_…" hidden={user?.isStaff} />
```

### Lift the launcher above a bottom bar

```tsx
import { useState } from 'react'
import { useChatOffset } from '@lynkist/chat-widget/react'

function CookieBanner() {
  const [height, setHeight] = useState(0) // measure your banner
  useChatOffset(height) // the launcher sits above the banner while it is shown
  // …
}
```

With several requests (a banner and a cart bar), the largest wins. `<LynkistChat offsetBottom={64} />` is one more request.

### A "Chat with us" button

```tsx
import { useLynkistChat } from '@lynkist/chat-widget/react'

function HelpButton() {
  const chat = useLynkistChat()
  return <button onClick={() => chat.open()}>Chat with us</button>
}
```

### Events

```tsx
import { useChatEvent } from '@lynkist/chat-widget/react'

useChatEvent('unread', (count) => setBadge(count))
useChatEvent('message', (message) => console.log(message.author, message.content))
```

Events: `ready`, `open`, `close`, `message`, `unread`, `error`.

## Signed-in customers (Web Chat Advanced)

With the Advanced add-on (included in the Business plan), a signed-in customer is one contact with one chat on every device and browser. A chat they started before they signed in joins their contact.

**1. On your server**, sign the user id with the widget's identity secret (**Security → Signed-in visitors**). Keep the secret on the server; never send it to a browser.

Node.js:

```ts
import { createHmac } from 'node:crypto'

const userHash = createHmac('sha256', process.env.LYNKIST_CHAT_SECRET!)
  .update(String(user.id))
  .digest('hex')
```

Python:

```python
import hashlib, hmac, os

user_hash = hmac.new(
    os.environ["LYNKIST_CHAT_SECRET"].encode(), str(user.id).encode(), hashlib.sha256
).hexdigest()
```

PHP:

```php
$userHash = hash_hmac('sha256', (string) $user->id, getenv('LYNKIST_CHAT_SECRET'));
```

Send `userHash` to the page with the rest of your user data, for example in your "current user" API response.

**2. On the page**, pass the user to the chat:

```tsx
<LynkistChat
  widgetKey="wk_…"
  identity={user ? { user_id: String(user.id), user_hash: user.chatHash, name: user.name, phone: user.phone } : null}
  attributes={user ? { plan: user.plan } : undefined}
/>
```

When `identity` changes from a user to `null` (sign-out), the chat logs out, so the next person on that browser starts a new chat. Without React:

```ts
chat.identify({ user_id: '42', user_hash, name: 'Asha Rao' })
chat.setAttributes({ plan: 'gold', trips: 3 }) // at most 20 keys; null removes one
chat.logout()                                  // on sign-out
```

Only `user_id` is verified. `name`, `email`, `phone` and the attributes are labels for your team. A wrong hash is ignored: the visitor chats as a guest. If you make a new secret in the dashboard, update it on your server; your customers keep their contacts and chats.

## Content Security Policy

If your site sends a Content-Security-Policy header, add the chat host:

```
script-src … https://chat.lynkist.io
frame-src  … https://chat.lynkist.io
```

With `'strict-dynamic'` in `script-src`, the browser ignores host names there. This package adds the script from your own code, which `'strict-dynamic'` trusts when your bundle has the nonce, so nothing else is necessary. If your policy has a nonce **without** `'strict-dynamic'`, pass it: `loadLynkistChat({ widgetKey, nonce })` or `<LynkistChat widgetKey="…" nonce={nonce} />`. (A plain `<script>` tag in your HTML needs `nonce="…"` on the tag.)

## API

| Function | |
|---|---|
| `loadLynkistChat({ widgetKey, host?, nonce? })` | Add the widget to the page once; answers the API |
| `getLynkistChat()` | The API, before or after loading |
| `open()`, `close()`, `toggle()` | The chat window |
| `show()`, `hide()` | The launcher on this page |
| `offset({ bottom })` | Extra space under the launcher, in px; `offset(null)` resets |
| `identify(identity)`, `setAttributes(attributes)`, `logout()` | Signed-in customers (Advanced) |
| `on(event, handler)` → `unsubscribe`, `off(event, handler)` | Widget events: `ready`, `open`, `close`, `message`, `unread`, `error` |

React (`@lynkist/chat-widget/react`): `LynkistChat` (props `widgetKey`, `host`, `nonce`, `identity`, `attributes`, `hidden`, `offsetBottom`), `useHideChat(active?)`, `requestHide()` → `release`, `useChatOffset(px)`, `requestOffset(px)` → `release`, `useLynkistChat()`, `useChatEvent(event, handler)`.

`offset` and the `error` event need the chat host's widget from 2026-11 or later; an older widget ignores them.

## Development

```bash
npm install
npm run typecheck && npm run lint && npm test
npm run build
```

Release: bump `version` in `package.json`, add its section to `CHANGELOG.md`, commit, then push a tag:

```bash
git tag v0.3.0 && git push origin main v0.3.0
```

The Release workflow checks that the tag matches `package.json`, runs every check, publishes to npm with provenance (npm trusted publishing, no token) and makes a GitHub release from the CHANGELOG section.
