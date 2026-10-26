import { describe, expect, test } from '@jest/globals';
import { parseAutoPostMetadata } from '../autoPostingTruthPatch.js';

describe('auto-posting metadata truth patch', () => {
  test('accepts real structured metadata', () => {
    expect(parseAutoPostMetadata('{"title":"Launch","caption":"Real source-backed caption","hashtags":["#one","two"]}')).toEqual({
      title: 'Launch',
      caption: 'Real source-backed caption',
      hashtags: ['one', 'two'],
    });
  });

  test('rejects incomplete or invalid metadata rather than inventing defaults', () => {
    expect(parseAutoPostMetadata('{"title":"Only title"}')).toBeNull();
    expect(parseAutoPostMetadata('not json')).toBeNull();
  });
});
