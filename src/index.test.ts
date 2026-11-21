import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLynkistChat, loadLynkistChat } from './index'

const KEY = 'wk_testWidgetKey123'
const queued = () => (window.Lynkist?.q ?? []).map((args) => Array.from(args))

beforeEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
  delete window.Lynkist
})
afterEach(() => vi.restoreAllMocks())

describe('loadLynkistChat', () => {
  it('adds the snippet script once, with the widget key', () => {
    loadLynkistChat({ widgetKey: KEY })
    loadLynkistChat({ widgetKey: KEY })
    const scripts = document.querySelectorAll('script')
    expect(scripts).toHaveLength(1)
    expect(scripts[0].src).toBe('https://chat.lynkist.io/w/v1/loader.js')
    expect(scripts[0].dataset.widget).toBe(KEY)
    expect(scripts[0].async).toBe(true)
  })

  it('takes another host, with or without a scheme', () => {
    loadLynkistChat({ widgetKey: KEY, host: 'https://uat-chat.lynkist.io/' })
    expect(document.querySelector('script')!.src).toBe('https://uat-chat.lynkist.io/w/v1/loader.js')
  })

  it('refuses a bad key or host, and a second widget', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    loadLynkistChat({ widgetKey: 'not-a-key' })
    loadLynkistChat({ widgetKey: KEY, host: 'evil.com/"><script>' })
    expect(document.querySelector('script')).toBeNull()
    loadLynkistChat({ widgetKey: KEY })
    loadLynkistChat({ widgetKey: 'wk_anotherWidget99' })
    expect(document.querySelectorAll('script')).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(3)
  })

  it('sees a snippet the site added itself', () => {
    const own = document.createElement('script')
    own.src = 'https://chat.lynkist.io/w/v1/loader.js'
    own.dataset.widget = KEY
    document.body.append(own)
    loadLynkistChat({ widgetKey: KEY })
    expect(document.querySelectorAll('script')).toHaveLength(1)
  })
})

describe('the API', () => {
  it('queues calls made before the widget loads, in order', () => {
    const chat = getLynkistChat()
    chat.hide()
    chat.identify({ user_id: '42', user_hash: 'abc', name: 'Asha' })
    chat.setAttributes({ plan: 'gold', trips: 3, gone: null })
    chat.show()
    expect(queued()).toEqual([
      ['hide'],
      ['identify', { user_id: '42', user_hash: 'abc', name: 'Asha' }],
      ['setAttributes', { plan: 'gold', trips: 3, gone: null }],
      ['show'],
    ])
  })

  it('calls the loaded widget directly', () => {
    const loaded = Object.assign(vi.fn(), { loaded: true })
    window.Lynkist = loaded
    getLynkistChat().open()
    getLynkistChat().logout()
    expect(loaded.mock.calls).toEqual([['open'], ['logout']])
  })

  it('skips an identify with no user id or hash', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    getLynkistChat().identify({ user_id: '', user_hash: 'x' })
    getLynkistChat().identify({ user_id: '1' } as never)
    expect(queued()).toEqual([])
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('on answers an unsubscribe that sends off with the same handler', () => {
    const handler = () => {}
    const stop = getLynkistChat().on('unread', handler)
    stop()
    expect(queued()).toEqual([
      ['on', 'unread', handler],
      ['off', 'unread', handler],
    ])
  })
})

describe('offset, error event and nonce', () => {
  it('puts the CSP nonce on the script tag when given one', () => {
    loadLynkistChat({ widgetKey: KEY, nonce: 'abc123' })
    expect(document.querySelector('script')!.nonce).toBe('abc123')
  })

  it('adds no nonce when none is given', () => {
    loadLynkistChat({ widgetKey: KEY })
    expect(document.querySelector('script')!.hasAttribute('nonce')).toBe(false)
  })

  it('sends offset as a number of px, or null to reset', () => {
    const chat = getLynkistChat()
    chat.offset({ bottom: 96 })
    chat.offset(null)
    chat.offset({ bottom: Number.NaN })
    expect(queued()).toEqual([
      ['offset', { bottom: 96 }],
      ['offset', { bottom: null }],
      ['offset', { bottom: null }],
    ])
  })

  it('listens to error events', () => {
    const handler = vi.fn()
    getLynkistChat().on('error', handler)
    expect(queued()).toEqual([['on', 'error', handler]])
  })
})
