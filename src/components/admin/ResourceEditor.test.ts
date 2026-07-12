import { describe, expect, it } from 'vitest';
import { createResourceDraft } from '../../lib/cms/resources';

describe('admin resource drafts', () => {
  it('creates an editable news draft with structured body content', () => {
    const draft = createResourceDraft('news_posts');
    expect(draft.is_published).toBe(false);
    expect(draft.body_blocks[0].type).toBe('rich_text');
  });

  it('creates a calendar draft with safe publication defaults', () => {
    const draft = createResourceDraft('calendar_events');
    expect(draft.category).toBe('information');
    expect(draft.external_url).toBeNull();
  });

  it('requires the administrator to select media for a document', () => {
    const draft = createResourceDraft('documents');
    expect(draft.media_id).toBe('');
    expect(draft.is_published).toBe(false);
  });
});
