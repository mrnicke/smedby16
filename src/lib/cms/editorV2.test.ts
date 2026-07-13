import { describe, expect, it } from 'vitest';
import { editorDocumentV2Schema, migrateLegacyBlocks, stableUuid } from './schema';
import { validateEditorQuality } from './quality';
import { diffEditorDocuments } from './revisionsV2';

const hero = { type: 'hero' as const, heading: 'Smedby', text: 'Välkommen', action: { label: 'Läs mer', href: '/' } };
describe('EditorDocumentV2', () => {
  it('migrates legacy content deterministically without data loss', () => { const first = migrateLegacyBlocks([hero], 'page-1'); const second = migrateLegacyBlocks([hero], 'page-1'); expect(first).toEqual(second); expect(migrateLegacyBlocks(first, 'page-1')).toEqual(first); expect(first.root[0].columns[0].blocks[0]).toMatchObject(hero); });
  it('creates valid stable UUID values', () => expect(stableUuid('same')).toMatch(/^[0-9a-f-]{36}$/));
  it('rejects more than three columns and nested sections', () => { const base = migrateLegacyBlocks([hero]); expect(editorDocumentV2Schema.safeParse({ ...base, root: [{ ...base.root[0], columns: [...base.root[0].columns, ...base.root[0].columns, ...base.root[0].columns, ...base.root[0].columns] }] }).success).toBe(false); expect(editorDocumentV2Schema.safeParse({ ...base, root: [{ ...base.root[0], columns: [{ ...base.root[0].columns[0], blocks: [base.root[0] as any] }] }] }).success).toBe(false); });
  it('rejects unsafe URLs during legacy conversion', () => expect(() => migrateLegacyBlocks([{ type: 'link_list', links: [{ label: 'Farlig', href: 'javascript:alert(1)' }] }])).toThrow());
  it('reports quality errors and understandable revision changes', () => { const before = migrateLegacyBlocks([hero]); const after = structuredClone(before); (after.root[0].columns[0].blocks[0] as any).heading = 'Ny rubrik'; expect(validateEditorQuality(before).filter((issue) => issue.severity === 'error')).toHaveLength(0); expect(diffEditorDocuments(before, after)).toContainEqual(expect.objectContaining({ type: 'text_changed' })); });
});
