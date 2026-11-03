import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import DebugPanel from '@/components/DebugPanel.vue'
import { clearDebugLog, logRequest, logResponse } from '@/ai/debugLog'

const SECRET = 'sk-supersecretvalue'
const makeHeaders = () => ({ authorization: `Bearer ${SECRET}` })
const CHAT_URL = 'https://api.example.com/v1/chat/completions'

const mountPanel = () => mount(DebugPanel, { global: { plugins: [i18n] } })

beforeEach(() => clearDebugLog())

describe('debug panel', () => {
  it('shows an empty hint when nothing was logged yet', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="debug-empty"]').exists()).toBe(true)
  })

  it('renders a true modal: backdrop, role=dialog, aria-modal, focusable panel', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="debug-backdrop"]').exists()).toBe(true)
    const dialog = wrapper.find('[role="dialog"]')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.element.getAttribute('tabindex')).toBe('-1')
  })

  it('lists request/response newest first, never leaking the key', async () => {
    logRequest(CHAT_URL, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ model: 'gpt' }),
    })
    await logResponse(
      CHAT_URL,
      { method: 'POST', headers: makeHeaders() },
      new Response(JSON.stringify({ choices: [{ message: { content: 'hi' } }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      Date.now(),
    )

    const wrapper = mountPanel()
    const entries = wrapper.findAll('[data-testid="debug-entry"]')
    expect(entries).toHaveLength(2)
    // newest first: the response (completed later) above the request.
    expect(entries[0].text()).toContain('Response')
    expect(entries[1].text()).toContain('Request')
    expect(wrapper.html()).not.toContain(SECRET)
  })

  it('formats timestamps as ISO-like YYYY-MM-DD HH:MM:SS', () => {
    logRequest(CHAT_URL, { method: 'POST', headers: {} })
    const wrapper = mountPanel()
    const text = wrapper.find('[data-testid="debug-entry"]').text()
    expect(text).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  })

  it('keeps the status and the duration as separate, visually distinct elements in the detail', async () => {
    await logResponse(
      CHAT_URL,
      { method: 'POST', headers: {} },
      new Response(JSON.stringify({ ok: true }), {
        status: 204,
        headers: { 'content-type': 'application/json' },
      }),
      Date.now() - 120,
    )
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="debug-entry"]').trigger('click')

    const spans = wrapper.find('dl').findAll('span')
    const statusChip = spans.find((s) => s.text() === '204')
    const duration = spans.find((s) => s.text().includes('ms'))
    expect(statusChip?.classes() ?? []).toContain('rounded') // chip, not plain text
    expect(duration?.classes() ?? []).toContain('text-fg-muted') // muted, not bold
    expect(statusChip?.element).not.toBe(duration?.element)
  })

  it('opens a detail view with collapsed headers, a redacted key and the payload', async () => {
    logRequest(CHAT_URL, {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ model: 'gpt', messages: [{ role: 'user', content: 'hola' }] }),
    })
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="debug-entry"]').trigger('click')

    expect(wrapper.find('[data-testid="debug-detail"]').exists()).toBe(true)
    const details = wrapper.find('details[data-testid="debug-headers"]')
    expect(details.attributes('open')).toBeUndefined() // collapsed by default
    expect(wrapper.find('[data-testid="debug-payload"]').text()).toContain('hola')

    await details.trigger('toggle-open')
    expect(wrapper.find('[data-testid="debug-headers"]').text()).toContain('<REDACTED>')
    expect(wrapper.html()).not.toContain(SECRET)
  })
})
