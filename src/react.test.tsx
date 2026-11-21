import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { LynkistChat, requestHide, requestOffset, useChatEvent, useChatOffset, useHideChat } from './react'

const KEY = 'wk_testWidgetKey123'
const calls = () => (window.Lynkist?.q ?? []).map((args) => Array.from(args))
const named = (name: string) => calls().filter((c) => c[0] === name)

beforeEach(() => {
  document.head.innerHTML = ''
  delete window.Lynkist
})
afterEach(() => cleanup())

describe('LynkistChat', () => {
  it('loads the widget once and renders nothing', () => {
    const { container, rerender } = render(<LynkistChat widgetKey={KEY} />)
    rerender(<LynkistChat widgetKey={KEY} />)
    expect(container.innerHTML).toBe('')
    expect(document.querySelectorAll('script[data-widget]')).toHaveLength(1)
  })

  it('identifies on sign-in, once per user, and logs out on sign-out', () => {
    const user = { user_id: '42', user_hash: 'h42', name: 'Asha' }
    const { rerender } = render(<LynkistChat widgetKey={KEY} identity={null} />)
    expect(named('identify')).toHaveLength(0)
    rerender(<LynkistChat widgetKey={KEY} identity={user} />)
    rerender(<LynkistChat widgetKey={KEY} identity={{ ...user }} />)
    expect(named('identify')).toEqual([['identify', user]])
    rerender(<LynkistChat widgetKey={KEY} identity={null} />)
    expect(named('logout')).toHaveLength(1)
  })

  it('never logs out a visitor who was never signed in', () => {
    const { rerender } = render(<LynkistChat widgetKey={KEY} />)
    rerender(<LynkistChat widgetKey={KEY} identity={null} />)
    expect(named('logout')).toHaveLength(0)
  })

  it('sends attributes when they change', () => {
    const { rerender } = render(<LynkistChat widgetKey={KEY} attributes={{ plan: 'gold' }} />)
    rerender(<LynkistChat widgetKey={KEY} attributes={{ plan: 'gold' }} />)
    rerender(<LynkistChat widgetKey={KEY} attributes={{ plan: 'silver' }} />)
    expect(named('setAttributes')).toEqual([
      ['setAttributes', { plan: 'gold' }],
      ['setAttributes', { plan: 'silver' }],
    ])
  })
})

describe('hide requests', () => {
  function Hider({ active = true }: { active?: boolean }) {
    useHideChat(active)
    return null
  }
  const last = () => calls().filter((c) => c[0] === 'hide' || c[0] === 'show').at(-1)?.[0]

  it('hides while any request is held', () => {
    const fareBar = render(<Hider />)
    const payment = render(<Hider />)
    expect(last()).toBe('hide')
    fareBar.unmount()
    expect(last()).toBe('hide')
    payment.unmount()
    expect(last()).toBe('show')
  })

  it('counts the hidden prop and requestHide with the hooks', () => {
    const { rerender } = render(<LynkistChat widgetKey={KEY} hidden />)
    expect(last()).toBe('hide')
    const release = requestHide()
    rerender(<LynkistChat widgetKey={KEY} hidden={false} />)
    expect(last()).toBe('hide')
    release()
    release()
    expect(last()).toBe('show')
  })

  it('follows active', () => {
    const { rerender } = render(<Hider active={false} />)
    expect(last()).toBeUndefined()
    rerender(<Hider active />)
    expect(last()).toBe('hide')
    rerender(<Hider active={false} />)
    expect(last()).toBe('show')
  })
})

describe('useChatEvent', () => {
  it('listens while mounted, with the latest handler', () => {
    const seen: number[] = []
    function Badge({ add }: { add: number }) {
      useChatEvent('unread', (count) => seen.push(count + add))
      return null
    }
    const { rerender, unmount } = render(<Badge add={0} />)
    rerender(<Badge add={100} />)
    const on = named('on')
    expect(on).toHaveLength(1)
    ;(on[0][2] as (n: number) => void)(2)
    expect(seen).toEqual([102])
    unmount()
    expect(named('off')).toEqual([['off', 'unread', on[0][2]]])
  })
})

describe('offset requests', () => {
  function Lift({ px }: { px: number | null }) {
    useChatOffset(px)
    return null
  }
  const last = () => named('offset').at(-1)?.[1]

  it('lifts while mounted, the largest request wins, and resets at the end', () => {
    const banner = render(<Lift px={120} />)
    expect(last()).toEqual({ bottom: 120 })
    const cart = render(<Lift px={64} />)
    expect(last()).toEqual({ bottom: 120 })
    banner.unmount()
    expect(last()).toEqual({ bottom: 64 })
    cart.unmount()
    expect(last()).toEqual({ bottom: null })
  })

  it('follows a changing height, and asks for nothing at 0', () => {
    const { rerender } = render(<Lift px={0} />)
    expect(last()).toBeUndefined()
    rerender(<Lift px={80.6} />)
    expect(last()).toEqual({ bottom: 81 })
    rerender(<Lift px={null} />)
    expect(last()).toEqual({ bottom: null })
  })

  it('counts the offsetBottom prop and requestOffset with the hook', () => {
    const { rerender } = render(<LynkistChat widgetKey={KEY} offsetBottom={40} />)
    expect(last()).toEqual({ bottom: 40 })
    const release = requestOffset(90)
    expect(last()).toEqual({ bottom: 90 })
    release()
    release()
    expect(last()).toEqual({ bottom: 40 })
    rerender(<LynkistChat widgetKey={KEY} />)
    expect(last()).toEqual({ bottom: null })
  })

  it('passes the nonce to the script tag', () => {
    render(<LynkistChat widgetKey={KEY} nonce="n0nce" />)
    expect(document.querySelector<HTMLScriptElement>('script[data-widget]')!.nonce).toBe('n0nce')
  })
})
