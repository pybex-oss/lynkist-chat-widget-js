/**
 * Lynkist Website Chat for any site: load the widget once, then talk to it
 * through a typed API.
 *
 *   import { loadLynkistChat } from '@lynkist/chat-widget'
 *
 *   const chat = loadLynkistChat({ widgetKey: 'wk_…' })
 *   chat.identify({ user_id: '42', user_hash })   // Advanced add-on
 *   chat.hide()                                   // e.g. on a payment screen
 *
 * This package does not bundle the widget. It adds the same script tag as the
 * snippet in the Lynkist dashboard, so the widget always comes from the chat
 * host and is never out of date.
 *
 * Calls made before the widget has loaded are queued (`window.Lynkist.q`) and
 * run in order once it loads. On the server (SSR) every function is a no-op.
 *
 * The module keeps no state of its own: everything is on the page (the script
 * tag and `window.Lynkist`), so two copies of this package on one page agree.
 *
 * When the chat does not show, the widget says why in the browser console
 * (`[Lynkist] …`) and sends an `error` event: listen with
 * `chat.on('error', (e) => …)`.
 */

/** The default chat host. */
export const DEFAULT_HOST = 'chat.lynkist.io'

/** Events the widget sends to the page. */
export type ChatEvent = 'ready' | 'open' | 'close' | 'message' | 'unread' | 'error'

/**
 * Why the chat does not show (`on('error', …)`). The same text goes to the
 * browser console.
 *
 * - `not_loaded`: the chat window sent nothing in 20 seconds. Almost always
 *   the site is not in the widget's Allowed websites (Security tab), or your
 *   Content-Security-Policy `frame-src` does not allow the chat host. Also a
 *   wrong widget key, or no connection.
 * - `unavailable`: the widget is switched off, not published, or not in the
 *   plan. Outside business hours with "hide" is not an error.
 */
export interface ChatError {
  code: 'not_loaded' | 'unavailable'
  message: string
}

/** Extra space under the launcher, in px, on top of the widget's own offset. */
export interface ChatOffset {
  /** px; `0` or `null` removes the extra space. */
  bottom?: number | null
}

/**
 * The CSS variable for extra space under the launcher. A page can set it
 * itself, e.g. `:root { --lynkist-chat-offset-bottom: var(--banner-h, 0px) }`.
 * `offset()` sets it on the widget's own element, so `offset()` wins.
 */
export const OFFSET_VARIABLE = '--lynkist-chat-offset-bottom'

/** A chat message as the widget reports it (`on('message', …)`). */
export interface ChatMessage {
  id: string
  seq: number
  author: 'visitor' | 'agent' | 'bot' | 'system'
  content: { type: string; [part: string]: unknown }
  created_at: string
}

/**
 * The site's signed-in user (Advanced add-on).
 *
 * `user_hash` is HMAC-SHA256 of `user_id` with the widget's identity secret,
 * in hex, made on **your server**. Never put the secret in browser code.
 * `name`, `email` and `phone` are labels for your team; Lynkist does not
 * verify them.
 */
export interface Identity {
  user_id: string
  user_hash: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

/** Values about the visitor, shown to your team (Advanced add-on). `null` removes a key. */
export type Attributes = Record<string, string | number | boolean | null>

export interface LoadOptions {
  /** The widget key from the dashboard (Channels → Website Chat → Install). */
  widgetKey: string
  /** The chat host; the default is `chat.lynkist.io`. */
  host?: string
  /**
   * Your page's CSP nonce, put on the script tag. Needed only when your
   * Content-Security-Policy uses a nonce without `'strict-dynamic'`; with
   * `'strict-dynamic'`, a script added by your own (nonced) code is trusted
   * already.
   */
  nonce?: string
}

type Handler = (...args: unknown[]) => void

/** The widget's JavaScript API. Every method is safe to call before the widget loads. */
export interface LynkistChat {
  open(): void
  close(): void
  toggle(): void
  /** Show the launcher again after `hide()` (the dashboard's targeting rules still apply). */
  show(): void
  /** No launcher and no window on this page until `show()`. */
  hide(): void
  /**
   * Lift the launcher (and the open window) above a bar at the bottom of your
   * page, such as a cookie banner: `offset({ bottom: 96 })`. `offset(null)`
   * resets it. A phone's open window still fills the screen.
   */
  offset(offset: ChatOffset | null): void
  /** Forget the visitor in this browser: call it when your user signs out. */
  logout(): void
  identify(identity: Identity): void
  setAttributes(attributes: Attributes): void
  /** Listen to a widget event; answers a function that stops listening. */
  on(event: 'message', handler: (message: ChatMessage) => void): () => void
  on(event: 'unread', handler: (count: number) => void): () => void
  on(event: 'error', handler: (error: ChatError) => void): () => void
  on(event: 'ready' | 'open' | 'close', handler: () => void): () => void
  off(event: ChatEvent, handler: Handler): void
}

interface Queue {
  (...args: unknown[]): void
  q?: unknown[][]
  loaded?: boolean
}

declare global {
  interface Window {
    Lynkist?: Queue
  }
}

const WIDGET_KEY = /^wk_[A-Za-z0-9_-]{5,61}$/
const HOST = /^[a-z0-9.-]+(:\d+)?$/i

function browser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

/** `window.Lynkist`, with the queue stub the snippet's docs describe. */
function queue(): Queue {
  if (!window.Lynkist) {
    const stub: Queue = (...args: unknown[]) => {
      ;(stub.q = stub.q || []).push(args)
    }
    window.Lynkist = stub
  }
  return window.Lynkist
}

function call(...args: unknown[]): void {
  if (!browser()) return
  queue()(...args)
}

/** The loader script already on the page, if any. */
function loaderScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>('script[data-widget][src*="/w/v1/loader.js"]')
}

/** The API. It works whether or not the widget has loaded (calls queue until it does). */
export function getLynkistChat(): LynkistChat {
  return api
}

/**
 * Add the widget to the page, once, and answer its API.
 *
 * A second call with the same key does nothing. A page can hold one widget:
 * a call with another key is ignored with a console warning.
 */
export function loadLynkistChat(options: LoadOptions): LynkistChat {
  if (!browser()) return api
  const key = (options.widgetKey || '').trim()
  const host = (options.host || DEFAULT_HOST).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!WIDGET_KEY.test(key) || !HOST.test(host)) {
    console.warn('[lynkist] not a widget key or host:', key, host)
    return api
  }
  const existing = loaderScript()
  if (existing) {
    if (existing.dataset.widget !== key) {
      console.warn('[lynkist] the page already has widget', existing.dataset.widget, '- one widget per page')
    }
    return api
  }
  queue()
  const script = document.createElement('script')
  script.async = true
  script.src = `https://${host}/w/v1/loader.js`
  script.dataset.widget = key
  if (options.nonce) script.nonce = options.nonce
  ;(document.head || document.body).appendChild(script)
  return api
}

function validIdentity(identity: Identity): boolean {
  return (
    !!identity &&
    typeof identity.user_id === 'string' &&
    identity.user_id.trim().length > 0 &&
    typeof identity.user_hash === 'string' &&
    identity.user_hash.length > 0
  )
}

const api: LynkistChat = {
  open: () => call('open'),
  close: () => call('close'),
  toggle: () => call('toggle'),
  show: () => call('show'),
  hide: () => call('hide'),
  offset(offset) {
    const bottom = offset?.bottom
    call('offset', { bottom: typeof bottom === 'number' && Number.isFinite(bottom) ? bottom : null })
  },
  logout: () => call('logout'),
  identify(identity) {
    if (!validIdentity(identity)) {
      if (browser()) console.warn('[lynkist] identify needs user_id and user_hash')
      return
    }
    call('identify', { ...identity })
  },
  setAttributes(attributes) {
    if (!attributes || typeof attributes !== 'object') return
    call('setAttributes', { ...attributes })
  },
  on(event: ChatEvent, handler: Handler) {
    call('on', event, handler)
    return () => call('off', event, handler)
  },
  off(event, handler) {
    call('off', event, handler)
  },
} as LynkistChat
