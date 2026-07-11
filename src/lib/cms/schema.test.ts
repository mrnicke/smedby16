import { describe, expect, it } from 'vitest';
import { contentBlockSchema, pageKeyFromPath, validatePageBlocks } from './schema';

describe('CMS block schema', () => {
  it('accepts safe internal and https links', () => {
    const parsed = contentBlockSchema.parse({ type:'link_list', links:[{label:'Hem',href:'/'},{label:'Extern',href:'https://example.se'}] });
    expect(parsed.type === 'link_list' ? parsed.links : []).toHaveLength(2);
  });
  it('rejects javascript and protocol-relative links', () => {
    expect(() => contentBlockSchema.parse({ type:'link_list', links:[{label:'Farlig',href:'javascript:alert(1)'}] })).toThrow();
    expect(() => contentBlockSchema.parse({ type:'link_list', links:[{label:'Farlig',href:'//evil.example'}] })).toThrow();
  });
  it('enforces template requirements', () => {
    expect(() => validatePageBlocks('home', [])).toThrow(/hero/);
    expect(validatePageBlocks('documents', [{ type:'document_list', heading:'Dokument' }])).toHaveLength(1);
  });
  it('maps fixed routes and leaves unknown routes alone', () => {
    expect(pageKeyFromPath('/trafikregler/')).toBe('traffic');
    expect(pageKeyFromPath('/nyheter/ett-inlagg/')).toBeNull();
  });
});
