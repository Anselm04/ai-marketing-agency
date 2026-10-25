import { describe, expect, test } from '@jest/globals';
import { parseAnthropicSseFrame } from '../services/anthropicStreamingService.js';

describe('Anthropic streaming transport', () => {
  test('parses a text delta SSE frame', () => {
    const event = parseAnthropicSseFrame([
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      '',
    ].join('\n'));

    expect(event).toEqual({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text: 'Hello' },
    });
  });

  test('ignores keepalives and invalid non-data frames', () => {
    expect(parseAnthropicSseFrame('event: ping\n')).toBeNull();
    expect(parseAnthropicSseFrame('data: not-json\n')).toBeNull();
  });

  test('parses provider error events so callers can fail truthfully', () => {
    const event = parseAnthropicSseFrame(
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n',
    );
    expect(event?.type).toBe('error');
    expect(event?.error?.message).toBe('Overloaded');
  });
});
