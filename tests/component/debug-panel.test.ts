import { describe, expect, it, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import DebugPanel from '@/components/DebugPanel.vue'
import { clearDebugLog, logRequest, logResponse } from '@/ai/debugLog'

const SECRET = 'sk-supersecretvalue'
const makeHeaders = () => ({ authorization: `Bearer ${SECRET}` })

const mountPanel = () => mount(DebugPanel, { global: { plugins: [i18n] } })

beforeEach(() => clearDebugLog())

describe('debug panel', () => {
  it('shows an empty hint when nothing was logged yet', () => {
    const wrapper = mountPanel()
    expect(wrapper.find('[data-testid="debug-empty"]').exists()).toBe(true)
  })

  it('lists request/response newest first and never leaks the key', async () => {
    logRequest('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ model: 'gpt', messages: [] }),
    })
    await logResponse(
      'https://api.example.com/v1/chat/completions',
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
    // the key never reaches the DOM, even before its detail is opened
    expect(wrapper.html()).not.toContain(SECRET)
  })

  it('opens a detail view with collapsed headers, a redacted key and the payload', async () => {
    logRequest('https://api.example.com/v1/chat/completions', {
      method: 'POST',
      headers: makeHeaders(),
      body: JSON.stringify({ model: 'gpt', messages: [{ role: 'user', content: 'hola' }] }),
    })
    const wrapper = mountPanel()
    await wrapper.find('[data-testid="debug-entry"]').trigger('click')

    expect(wrapper.find('[data-testid="debug-detail"]').exists()).toBe(true)
    const details = wrapper.find('details[data-testid="debug-headers"]')
    expect(details.exists()).toBe(true)
    expect(details.attributes('open')).toBeUndefined() // collapsed by default

    // The payload is the headline and is shown immediately.
    expect(wrapper.find('[data-testid="debug-payload"]').text()).toContain('hola')

    // Opening the headers reveals the redacted key — never the real one.
    await details.trigger('toggle-open') // <details> fires 'toggle' with a new 'open' state when toggled
    expect(wrapper.find('[data-testid="debug-headers"]').text()).toContain('<REDACTED>')
    expect(wrapper.html()).not.toContain(SECRET)
  })
})
