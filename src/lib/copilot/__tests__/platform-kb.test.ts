import { describe, expect, it } from 'vitest';

import { keywordSearchPlatformKB } from '@/lib/copilot/platform-kb';

describe('platform KB keyword search', () => {
  it('does not crash when the query contains regex metacharacters', () => {
    const results = keywordSearchPlatformKB('ascolto (cliente)', 'all');

    expect(Array.isArray(results)).toBe(true);
  });
});
