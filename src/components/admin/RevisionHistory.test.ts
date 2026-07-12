import { describe, expect, it } from 'vitest';
import { revisionChanges } from '../../lib/cms/revisions';

describe('revisionChanges', () => {
  it('shows changed content fields and ignores audit timestamps', () => {
    expect(revisionChanges(
      { title: 'Före', is_published: false, updated_at: 'old' },
      { title: 'Efter', is_published: true, updated_at: 'new' },
    )).toEqual([
      { field: 'title', before: 'Före', after: 'Efter' },
      { field: 'is_published', before: false, after: true },
    ]);
  });
});
