/** @vitest-environment node */
import { expect, it } from 'vitest'
import { getLynkistChat, loadLynkistChat } from './index'

it('does nothing on the server', () => {
  expect(typeof window).toBe('undefined')
  const chat = loadLynkistChat({ widgetKey: 'wk_testWidgetKey123' })
  chat.open()
  chat.identify({ user_id: '1', user_hash: 'h' })
  expect(chat).toBe(getLynkistChat())
  expect(chat.on('ready', () => {})).toBeTypeOf('function')
})
