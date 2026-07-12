import { describe, expect, it } from 'vitest';
import { collectInternalHrefs, invalidInternalHrefs, resolveCmsHref } from './links';

describe('resolveCmsHref', () => {
  it('routes the CMS calendar link to the dynamic Edge Function', () => {
    expect(resolveCmsHref('/kalender.ics', 'https://project.supabase.co/'))
      .toBe('https://project.supabase.co/functions/v1/calendar-ics');
  });

  it('keeps ordinary and fallback links unchanged', () => {
    expect(resolveCmsHref('/dokument/', 'https://project.supabase.co')).toBe('/dokument/');
    expect(resolveCmsHref('/kalender.ics')).toBe('/kalender.ics');
  });
});

describe('internal CMS links', () => {
  const blocks = [{ type: 'link_list', links: [{ label: 'Kontakt', href: '/kontakt/' }, { label: 'Missing', href: '/saknas/?x=1' }] }];

  it('collects href fields without treating image sources as links', () => {
    expect(collectInternalHrefs({ blocks, image: { src: '/images/test.webp' } })).toEqual(['/kontakt/', '/saknas/?x=1']);
  });

  it('returns only links whose path is not a known route', () => {
    expect(invalidInternalHrefs(blocks, ['/', '/kontakt/'])).toEqual(['/saknas/?x=1']);
    expect(invalidInternalHrefs([{ href: '/kalender.ics' }], ['/'])).toEqual([]);
  });
});
