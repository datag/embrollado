import { describe, expect, it } from 'vitest'
import { parseSSE, chunkText } from '@/ai/transport'

function sseResponse(chunks: string[]): Response {
  return new Response(chunks.join(''), {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}

describe('SSE parser (T043, T021)', () => {
  it('tolerates comment frames (`:` prefix) and keepalive pings', async () => {
    const body = [': ping\n\n', 'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n']
    const deltas: string[] = []
    const result = await parseSSE(sseResponse(body), (d) => deltas.push(d))
    expect(deltas).toEqual(['{"choices":[{"delta":{"content":"hi"}}]}'])
    expect(result.frames).toHaveLength(1)
  })

  it('tolerates a missing choices array (usage/keepalive frames)', async () => {
    const body = ['data: {"usage":{"total_tokens":5}}\n\n', 'data: [DONE]\n\n']
    const result = await parseSSE(sseResponse(body), () => {})
    expect(result.frames).toHaveLength(1)
    expect(result.done).toBe(true)
  })

  it('handles the OpenRouter final frame carrying non-empty choices', async () => {
    const body = [
      'data: {"choices":[{"delta":{"content":"Hello"}}],"usage":null}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}],"usage":{"total_tokens":9}}\n\n',
      'data: {"id":"chatcmpl-2","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":9}}\n\n',
      'data: [DONE]\n\n',
    ]
    const deltas: string[] = []
    const result = await parseSSE(sseResponse(body), (d) => deltas.push(d))
    expect(deltas.length).toBe(3)
    expect(result.frames).toHaveLength(3)
  })

  it('never parses a partial buffer as JSON', async () => {
    // A chunk that is cut in the middle of a JSON payload: the frame must not be parsed until
    // the complete frame (terminated by \n\n) arrives — here the partial has no terminator.
    const partial = 'data: {"choices":[{"delta":{"content":"par'
    const rest = 'tial"}}]}\n\n'
    const deltas: string[] = []
    const result = await parseSSE(sseResponse([partial + rest]), (d) => deltas.push(d))
    expect(deltas).toHaveLength(1)
    expect(result.frames).toHaveLength(1)
    expect((result.frames[0] as { choices: unknown[] }).choices).toBeTruthy()
  })

  it('accumulates streaming text deltas into full content', async () => {
    let acc = ''
    const result = await parseSSE(
      sseResponse([
        'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"B"}}]}\n\n',
        'data: [DONE]\n\n',
      ]),
      (d) => {
        acc += chunkText(JSON.parse(d))
      },
    )
    expect(acc).toBe('AB')
    expect(result.done).toBe(true)
  })
})
