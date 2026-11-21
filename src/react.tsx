/**
 * React bindings for Lynkist Website Chat (React 17+, Next.js App and Pages
 * Router).
 *
 *   import { LynkistChat, useHideChat } from '@lynkist/chat-widget/react'
 *
 *   // Once, in the root layout:
 *   <LynkistChat widgetKey="wk_…" identity={user ? { user_id, user_hash } : null} />
 *
 *   // In any component that needs the corner of the screen, or must not
 *   // have a chat (a payment step):
 *   useHideChat()
 *
 * `useHideChat` counts: the chat is hidden while at least one mounted
 * component asks for it, so two screens that hide it never undo each other.
 * The `hidden` prop of `LynkistChat` is one more such request.
 *
 * `useChatOffset(px)` lifts the launcher above a bar at the bottom of the
 * page (a cookie banner, a sticky cart) while the component is mounted; the
 * largest request wins.
 */
import { useEffect, useRef } from 'react'
import {
  getLynkistChat,
  loadLynkistChat,
  type Attributes,
  type ChatError,
  type ChatEvent,
  type ChatMessage,
  type Identity,
  type LynkistChat as LynkistChatApi,
} from './index'

export type { Attributes, ChatError, ChatEvent, ChatMessage, ChatOffset, Identity } from './index'

// ── hide requests (counted) ─────────────────────────────────────────────────

let hideRequests = 0

function applyHide(): void {
  const chat = getLynkistChat()
  if (hideRequests > 0) chat.hide()
  else chat.show()
}

/** Ask for the chat to be hidden; answers the release. Counted with every other request. */
export function requestHide(): () => void {
  hideRequests++
  applyHide()
  let released = false
  return () => {
    if (released) return
    released = true
    hideRequests = Math.max(0, hideRequests - 1)
    applyHide()
  }
}

/** Hide the chat while this component is mounted and `active` is true. */
export function useHideChat(active = true): void {
  useEffect(() => {
    if (!active) return
    return requestHide()
  }, [active])
}

// ── offset requests (the largest wins) ──────────────────────────────────────

const offsetRequests = new Map<number, number>()
let nextOffsetId = 0

function applyOffset(): void {
  const bottom = Math.max(0, ...offsetRequests.values())
  getLynkistChat().offset(bottom > 0 ? { bottom } : null)
}

/**
 * Ask for `bottom` px of extra space under the launcher; answers the release.
 * With several requests the largest wins, so a cookie banner and a sticky
 * cart bar do not undo each other.
 */
export function requestOffset(bottom: number): () => void {
  const id = nextOffsetId++
  offsetRequests.set(id, Number.isFinite(bottom) ? Math.max(0, bottom) : 0)
  applyOffset()
  let released = false
  return () => {
    if (released) return
    released = true
    offsetRequests.delete(id)
    applyOffset()
  }
}

/**
 * Lift the launcher by `bottom` px while this component is mounted, e.g. by
 * the measured height of your cookie banner. `0` (or nothing) asks for none.
 */
export function useChatOffset(bottom: number | null | undefined): void {
  const px = typeof bottom === 'number' && Number.isFinite(bottom) ? Math.max(0, Math.round(bottom)) : 0
  useEffect(() => {
    if (px <= 0) return
    return requestOffset(px)
  }, [px])
}

// ── the component ───────────────────────────────────────────────────────────

export interface LynkistChatProps {
  /** The widget key from the dashboard (Channels → Website Chat → Install). */
  widgetKey: string
  /** The chat host; the default is `chat.lynkist.io`. */
  host?: string
  /** Your page's CSP nonce, for a policy that uses a nonce without `'strict-dynamic'`. */
  nonce?: string
  /**
   * The signed-in user (Advanced add-on), or `null` when nobody is signed in.
   * When it changes from a user to `null`, the chat logs out, so the next
   * person on this browser starts a new chat.
   */
  identity?: Identity | null
  /** Values about the visitor for your team (Advanced add-on). */
  attributes?: Attributes
  /** Hide the chat while true (counted with `useHideChat`). */
  hidden?: boolean
  /** Extra space under the launcher, in px (with `useChatOffset`, the largest wins). */
  offsetBottom?: number
}

/** Same identity: compares the fields the widget sends. */
function identityKey(identity: Identity | null | undefined): string | null {
  if (!identity) return null
  const { user_id, user_hash, name, email, phone } = identity
  return JSON.stringify([user_id, user_hash, name ?? null, email ?? null, phone ?? null])
}

/**
 * Loads the widget once and keeps it in step with the props. Renders nothing:
 * the widget draws its own launcher.
 */
export function LynkistChat({
  widgetKey,
  host,
  nonce,
  identity,
  attributes,
  hidden = false,
  offsetBottom,
}: LynkistChatProps): null {
  const chat = getLynkistChat()
  const lastIdentity = useRef<string | null>(null)

  useEffect(() => {
    loadLynkistChat({ widgetKey, host, nonce })
  }, [widgetKey, host, nonce])

  const idKey = identityKey(identity)
  useEffect(() => {
    if (idKey === lastIdentity.current) return
    const signedOut = lastIdentity.current !== null && idKey === null
    lastIdentity.current = idKey
    if (identity && idKey) chat.identify(identity)
    else if (signedOut) chat.logout()
    // `identity` is read through `idKey`, its stable form.
  }, [idKey, chat])

  const attrKey = attributes ? JSON.stringify(attributes) : null
  useEffect(() => {
    // `attributes` is read through `attrKey`, its stable form.
    if (attributes && attrKey) chat.setAttributes(attributes)
  }, [attrKey, chat])

  useHideChat(hidden)
  useChatOffset(offsetBottom)
  return null
}

/** The chat's API, for buttons such as "Chat with us" (`useLynkistChat().open()`). */
export function useLynkistChat(): LynkistChatApi {
  return getLynkistChat()
}

/** Run `handler` on a widget event while the component is mounted. */
export function useChatEvent(event: 'message', handler: (message: ChatMessage) => void): void
export function useChatEvent(event: 'unread', handler: (count: number) => void): void
export function useChatEvent(event: 'error', handler: (error: ChatError) => void): void
export function useChatEvent(event: 'ready' | 'open' | 'close', handler: () => void): void
export function useChatEvent(event: ChatEvent, handler: (...args: never[]) => void): void {
  const latest = useRef(handler)
  latest.current = handler
  useEffect(() => {
    const chat = getLynkistChat() as unknown as {
      on(event: ChatEvent, fn: (...args: unknown[]) => void): () => void
    }
    return chat.on(event, (...args: unknown[]) => (latest.current as (...a: unknown[]) => void)(...args))
  }, [event])
}
