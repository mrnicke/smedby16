import { describe, expect, it } from 'vitest';
import { contentBlockSchema, pageKeyFromPath, richTextDocumentSchema, validateComponentInstances, validatePageBlocks } from './schema';

describe('CMS block schema', () => {
  it('accepts safe internal and https links', () => {
    const parsed = contentBlockSchema.parse({ type:'link_list', links:[{label:'Hem',href:'/'},{label:'Extern',href:'https://example.se'}] });
    expect(parsed.type === 'link_list' ? parsed.links : []).toHaveLength(2);
  });
  it('rejects javascript and protocol-relative links', () => {
    expect(() => contentBlockSchema.parse({ type:'link_list', links:[{label:'Farlig',href:'javascript:alert(1)'}] })).toThrow();
    expect(() => contentBlockSchema.parse({ type:'link_list', links:[{label:'Farlig',href:'//evil.example'}] })).toThrow();
  });
  it('does not accept non-web protocols as image sources',()=>{
    expect(()=>contentBlockSchema.parse({type:'image',image:{src:'mailto:admin@example.se',alt:'Fel'}})).toThrow();
  });
  it('enforces template requirements', () => {
    expect(() => validatePageBlocks('home', [])).toThrow(/hero/);
    expect(validatePageBlocks('documents', [{ type:'document_list', heading:'Dokument' }])).toHaveLength(1);
  });
  it('maps fixed routes and leaves unknown routes alone', () => {
    expect(pageKeyFromPath('/trafikregler/')).toBe('traffic');
    expect(pageKeyFromPath('/nyheter/ett-inlagg/')).toBeNull();
  });
  it('accepts only allowlisted rich-text nodes, marks and safe link protocols', () => {
    expect(richTextDocumentSchema.parse({ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:'Trygg länk', marks:[{ type:'link', attrs:{ href:'https://example.se' } }] }] }] })).toBeTruthy();
    expect(() => richTextDocumentSchema.parse({ type:'doc', content:[{ type:'script', attrs:{ src:'https://evil.example' } }] })).toThrow();
    expect(() => richTextDocumentSchema.parse({ type:'doc', content:[{ type:'paragraph', content:[{ type:'text', text:'Farlig', marks:[{ type:'link', attrs:{ href:'javascript:alert(1)' } }] }] }] })).toThrow();
    expect(() => richTextDocumentSchema.parse({ type:'doc', content:[{ type:'paragraph', onclick:'alert(1)', content:[] }] })).toThrow();
  });

  it('caps rich-text nesting depth', () => {
    let node: unknown = { type:'text', text:'Djup text' };
    for (let depth = 0; depth < 13; depth += 1) node = { type:'blockquote', content:[node] };
    expect(() => richTextDocumentSchema.parse({ type:'doc', content:[node] })).toThrow(/djupt/);
  });
  it('validates component instance properties against the published definition',()=>{
    const document:any={version:2,root:[{id:'11111111-1111-4111-8111-111111111111',type:'section',variant:'default',width:'normal',spacing:'normal',columns:[{id:'22222222-2222-4222-8222-222222222222',type:'column',width:1,blocks:[{id:'33333333-3333-4333-8333-333333333333',type:'component_instance',componentId:'44444444-4444-4444-8444-444444444444',properties:{url:'https://example.se'}}]}]}]};
    const definitions=[{id:'44444444-4444-4444-8444-444444444444',allowed_instance_properties:{url:{label:'Länk',type:'url',required:true}}}];
    expect(validateComponentInstances(document,definitions)).toBe(document);
    expect(()=>validateComponentInstances({...document,root:[{...document.root[0],columns:[{...document.root[0].columns[0],blocks:[{...document.root[0].columns[0].blocks[0],properties:{url:'javascript:alert(1)'}}]}]}]},definitions)).toThrow(/fel typ/);
  });
  it('rejects circular published component graphs',()=>{
    const instance=(componentId:string,id:string)=>({id,type:'component_instance',componentId,properties:{}});
    const document=(node:any)=>({version:2,root:[{id:crypto.randomUUID(),type:'section',variant:'default',width:'normal',spacing:'normal',columns:[{id:crypto.randomUUID(),type:'column',width:1,blocks:[node]}]}]});
    const componentA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';const componentB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
    const root=document(instance(componentA,crypto.randomUUID()));
    const definitions=[
      {id:componentA,allowed_instance_properties:{},published_definition:document(instance(componentB,crypto.randomUUID()))},
      {id:componentB,allowed_instance_properties:{},published_definition:document(instance(componentA,crypto.randomUUID()))},
    ];
    expect(()=>validateComponentInstances(root as any,definitions as any)).toThrow(/cirkulär/);
  });
});
