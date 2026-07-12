import { describe, expect, it } from 'vitest';
import { resolveCmsHref } from './links';

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
