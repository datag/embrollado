import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n } from '@/i18n'
import FeedbackPanel from '@/components/FeedbackPanel.vue'
import type { Turn } from '@/domain/types'

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: 't1',
    sessionId: 's1',
    position: 2,
    partnerText: '¿Dónde está el lavadero?',
    partnerTextLanguage: 'es',
    translation: 'Where is the washroom?',
    explanation: 'A polite question.',
    learnerText: 'Is the washroom next?',
    correctedText: 'Is the washroom nearby?',
    interpretation: 'You asked about the washroom.',
    assumptions: [{ original: '???', filled: 'el lavadero', reason: 'It fits the context.' }],
    badge: { tier: 'good', labelKey: 'good.1', label: 'Good!' },
    issues: [{ category: 'grammar', detail: 'Word order.', suggestion: 'Use "nearby".' }],
    explain: null,
    illustrationId: null,
    audioId: null,
    createdAt: '2026-10-28T10:00:00.000Z',
    feedbackLanguage: 'en',
    ...overrides,
  }
}

const mountPanel = (turn: Turn, props: Record<string, unknown> = {}) =>
  mount(FeedbackPanel, {
    props: { turn, showExplain: true, ...props },
    global: { plugins: [i18n] },
  })

describe('feedback panel (T046, T052)', () => {
  it('renders the elements in the fixed order (FR-014)', () => {
    const wrapper = mountPanel(makeTurn())
    const headings = wrapper.findAll('h4').map((h) => h.text())
    expect(headings).toEqual([
      'Explanation',
      'Your answer, corrected',
      'What you said',
      'Filled-in gaps',
      'Assessment',
      'Things to improve',
    ])
  })

  it("does not duplicate the partner line's translation (it lives on the bubble, FR-057)", () => {
    expect(mountPanel(makeTurn()).text()).not.toContain('Where is the washroom?')
  })

  it('shows the badge with its stored wording', () => {
    const wrapper = mountPanel(makeTurn())
    expect(wrapper.text()).toContain('Good!')
  })

  it('adds the explanation without hiding the existing feedback', async () => {
    const turn = makeTurn()
    const wrapper = mountPanel(turn)
    const before = wrapper.text()
    expect(before).toContain('Good!')
    await wrapper.setProps({
      turn: {
        ...turn,
        explain: { id: 'e1', turnId: turn.id, kind: 'both', content: 'Extra explanation.' },
      },
    })
    const after = wrapper.text()
    expect(after).toContain('Extra explanation.')
    expect(after).toContain('Good!') // existing feedback stays visible (FR-010)
    expect(after).toContain('A polite question.')
  })

  it("shows the explanation of the turn's own answer, not a previous turn's", () => {
    // The stored explanation belongs to this turn's learner answer.
    const turn = makeTurn({ explanation: 'The learner asked a clear question.' })
    const wrapper = mountPanel(turn)
    expect(wrapper.text()).toContain('The learner asked a clear question.')
    // A previous turn's explanation must not leak into this block.
    expect(wrapper.text()).not.toContain('A polite question.')
    // The assessment still comes from the answered turn (FR-040).
    expect(wrapper.text()).toContain('Good!')
  })

  it("only the pressed turn's Explain button becomes busy (per-turn state)", () => {
    const turn = makeTurn()
    const idle = mountPanel(turn)
    const button = (w: typeof idle) => w.find('button')
    expect(button(idle).text()).toBe('Explain to me')
    expect(button(idle).attributes('disabled')).toBeUndefined()

    // This turn is being explained → busy ("Explaining…").
    const busy = mountPanel(turn, { explaining: true })
    expect(button(busy).text()).toBe('Explaining…')
    expect(button(busy).attributes('disabled')).toBeDefined()

    // Another turn is being explained → this turn's button is disabled but not busy.
    const blocked = mountPanel(turn, { explainDisabled: true })
    expect(button(blocked).text()).toBe('Explain to me')
    expect(button(blocked).attributes('disabled')).toBeDefined()
  })

  it('has a distinct coloured badge per tier', () => {
    const wrapper = mountPanel(
      makeTurn({ badge: { tier: 'perfect', labelKey: 'perfect.0', label: 'Perfect!' } }),
    )
    const badgeEl = wrapper
      .findAll('span')
      .find((s) => s.classes().some((c) => c.startsWith('bg-badge-')))
    expect(badgeEl?.classes()).toContain('bg-badge-perfect')
  })
})
