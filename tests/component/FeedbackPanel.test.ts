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
    explanation: 'Your answer is clear and fits the question.',
    learnerText: 'Is the washroom next?',
    correctedText: 'Is the washroom nearby?',
    interpretation: 'You asked about the washroom.',
    assumptions: [{ original: '???', filled: 'el lavadero', reason: 'It fits the context.' }],
    badge: { tier: 'good', labelKey: 'good.1', label: 'Good!' },
    issues: [{ category: 'grammar', detail: 'Word order.', suggestion: 'Use "nearby".' }],
    illustrationId: null,
    audioId: null,
    createdAt: '2026-10-28T10:00:00.000Z',
    feedbackLanguage: 'en',
    ...overrides,
  }
}

const mountPanel = (turn: Turn, props: Record<string, unknown> = {}) =>
  mount(FeedbackPanel, {
    props: { turn, ...props },
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

  it("shows the explanation of the turn's own answer, not a previous turn's", () => {
    // The stored explanation belongs to this turn's learner answer.
    const turn = makeTurn({ explanation: 'You confirm the time and add a polite reason.' })
    const wrapper = mountPanel(turn)
    expect(wrapper.text()).toContain('You confirm the time and add a polite reason.')
    // A previous turn's explanation must not leak into this block.
    expect(wrapper.text()).not.toContain('Your answer is clear and fits the question.')
    // The assessment still comes from the answered turn (FR-040).
    expect(wrapper.text()).toContain('Good!')
  })

  it('has a distinct full-literal badge class per tier (visible in the compiled CSS)', () => {
    const tiers = ['perfect', 'good', 'acceptable', 'unsatisfactory', 'unknown'] as const
    for (const tier of tiers) {
      const wrapper = mountPanel(
        makeTurn({ badge: { tier, labelKey: `${tier}.0`, label: tier } }),
      )
      const badgeEl = wrapper
        .findAll('span')
        .find((s) => s.classes().some((c) => c.startsWith('bg-badge-')))
      expect(badgeEl?.classes()).toContain(`bg-badge-${tier}`)
    }
  })
})
