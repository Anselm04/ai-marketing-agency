import { jest } from '@jest/globals';
import OpenAI, { toFile } from 'openai';

describe('OpenAI SDK application API compatibility', () => {
  test('chat completion preserves messages and JSON response mode', async () => {
    const fetch = jest.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"title":"Campaign"}' } }] }), { headers: { 'Content-Type': 'application/json' } }));
    const client = new OpenAI({ apiKey: 'test-placeholder', fetch });
    const result = await client.chat.completions.create({
      model: 'test-model', messages: [{ role: 'user', content: 'Create a campaign' }],
      response_format: { type: 'json_object' }, temperature: 0.7, max_tokens: 800,
    });
    expect(result.choices[0].message.content).toBe('{"title":"Campaign"}');
    const request = new Request(...fetch.mock.calls.at(-1));
    expect(request.url).toBe('https://api.openai.com/v1/chat/completions');
    expect(await request.json()).toMatchObject({ messages: [{ role: 'user', content: 'Create a campaign' }], response_format: { type: 'json_object' }, max_tokens: 800 });
  });
  test('audio transcription accepts multipart audio and returns text', async () => {
    const fetch = jest.fn(async () => new Response(JSON.stringify({ text: 'Transcript' }), { headers: { 'Content-Type': 'application/json' } }));
    const client = new OpenAI({ apiKey: 'test-placeholder', fetch });
    const result = await client.audio.transcriptions.create({ file: await toFile(Buffer.from('audio'), 'clip.mp3'), model: 'whisper-1' });
    expect(result.text).toBe('Transcript');
    const request = new Request(...fetch.mock.calls.at(-1));
    expect(request.url).toBe('https://api.openai.com/v1/audio/transcriptions');
    const body = await request.formData();
    expect(body.get('model')).toBe('whisper-1');
    expect(body.get('file').name).toBe('clip.mp3');
  });
});
