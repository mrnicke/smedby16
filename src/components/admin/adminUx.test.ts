import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockSummary } from './blockEditorUx';
import { confirmDiscard } from './useUnsavedChanges';

afterEach(() => vi.unstubAllGlobals());

describe('admin UX helpers', () => {
  it('does not interrupt navigation when nothing has changed', () => {
    const confirm = vi.fn();
    vi.stubGlobal('confirm', confirm);
    expect(confirmDiscard(false)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('respects the administrator choice before discarding changes', () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal('confirm', confirm);
    expect(confirmDiscard(true)).toBe(false);
    expect(confirm).toHaveBeenCalledOnce();
  });

  it('summarizes collapsed blocks in plain Swedish', () => {
    expect(blockSummary({ type: 'notice', heading: 'Viktig information', text: '', tone: 'info' })).toBe('Viktig information');
    expect(blockSummary({ type: 'card_grid', cards: [{ title: 'Ett', text: '' }, { title: 'Två', text: '' }] })).toBe('2 kort');
    expect(blockSummary({ type: 'rich_text', document: { type: 'doc', content: [] } })).toBe('Formaterad text');
  });
});
