import { describe, expect, it } from 'vitest';
import { safeJsonForHtmlScript } from './safeJson';

describe('safeJsonForHtmlScript', () => {
  it('cannot terminate the containing script element', () => {
    const serialized = safeJsonForHtmlScript({ value: '</script><script>alert(1)</script>&\u2028\u2029' });
    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('>');
    expect(serialized).not.toContain('&');
    expect(serialized).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(serialized).value).toBe('</script><script>alert(1)</script>&\u2028\u2029');
  });
});
