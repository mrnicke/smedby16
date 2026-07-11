import { useState } from 'react';
import type { ContentBlock } from '../../lib/cms/schema';
import { contentBlockSchema, pageTemplateRules } from '../../lib/cms/schema';
import RichTextEditor from './RichTextEditor';
import BlockRenderer from '../cms/BlockRenderer';

const defaults: Record<ContentBlock['type'], ContentBlock> = {
  hero: { type: 'hero', heading: 'Ny rubrik', text: '' },
  rich_text: { type: 'rich_text', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Skriv text här.' }] }] } },
  card_grid: { type: 'card_grid', cards: [{ title: 'Kort', text: 'Beskrivning' }] },
  notice: { type: 'notice', heading: 'Information', text: '', tone: 'info' },
  image_text: { type: 'image_text', heading: 'Rubrik', text: '', image: { src: '/images/miljo-gronyta.webp', alt: '' }, imagePosition: 'right' },
  link_list: { type: 'link_list', links: [{ label: 'Länk', href: '/' }] },
  area_guide: { type: 'area_guide', heading: 'Områdesguide', text: '', links: [] },
  faq: { type: 'faq', items: [{ question: 'Fråga', answer: 'Svar' }] },
  news_feed: { type: 'news_feed', heading: 'Senaste nytt', limit: 3 },
  calendar_feed: { type: 'calendar_feed', heading: 'Kommande datum', limit: 5 },
  document_list: { type: 'document_list', heading: 'Dokument' },
  search_teaser: { type: 'search_teaser', heading: 'Sök på webbplatsen', text: 'Hitta regler, dokument och information.' },
};

function JsonFields({ block, onChange }: { block: ContentBlock; onChange: (block: ContentBlock) => void }) {
  const [text, setText] = useState(JSON.stringify(block, null, 2));
  const [error, setError] = useState('');
  return <label>Blockets innehåll
    <textarea rows={10} value={text} onChange={(event) => {
      setText(event.target.value);
      try { const parsed = contentBlockSchema.parse(JSON.parse(event.target.value)); onChange(parsed); setError(''); }
      catch { setError('Kontrollera blockets fält och format.'); }
    }} />
    {error && <span className="field-error">{error}</span>}
  </label>;
}

export default function BlockEditor({ template, blocks, onChange }: { template: keyof typeof pageTemplateRules; blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void }) {
  const [addType, setAddType] = useState<ContentBlock['type']>(pageTemplateRules[template].allowed[0]);
  const update = (index: number, block: ContentBlock) => onChange(blocks.map((item, itemIndex) => itemIndex === index ? block : item));
  const move = (from: number, to: number) => { const copy = [...blocks]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); onChange(copy); };
  return <div className="block-editor">
    <div className="block-editor-list">
      {blocks.map((block, index) => <fieldset className="block-panel" key={`${block.type}-${index}`}>
        <legend>{index + 1}. {block.type}</legend>
        <div className="block-actions"><button type="button" disabled={index === 0} onClick={() => move(index, index - 1)}>Flytta upp</button><button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)}>Flytta ned</button><button type="button" className="danger" onClick={() => onChange(blocks.filter((_, itemIndex) => itemIndex !== index))}>Ta bort</button></div>
        {block.type === 'hero' && <><label>Rubrik<input value={block.heading} onChange={(e) => update(index, { ...block, heading: e.target.value })} /></label><label>Ingress<textarea value={block.text} onChange={(e) => update(index, { ...block, text: e.target.value })} /></label></>}
        {block.type === 'rich_text' && <RichTextEditor value={block.document} onChange={(document) => update(index, { ...block, document })} />}
        {block.type === 'notice' && <><label>Rubrik<input value={block.heading} onChange={(e) => update(index, { ...block, heading: e.target.value })} /></label><label>Text<textarea value={block.text} onChange={(e) => update(index, { ...block, text: e.target.value })} /></label><label>Ton<select value={block.tone} onChange={(e) => update(index, { ...block, tone: e.target.value as any })}><option value="info">Information</option><option value="warning">Varning</option><option value="success">Klart</option></select></label></>}
        {!['hero','rich_text','notice'].includes(block.type) && <JsonFields block={block} onChange={(value) => update(index, value)} />}
      </fieldset>)}
      <div className="add-block"><select value={addType} onChange={(e) => setAddType(e.target.value as ContentBlock['type'])}>{pageTemplateRules[template].allowed.map((type) => <option key={type}>{type}</option>)}</select><button type="button" onClick={() => onChange([...blocks, structuredClone(defaults[addType])])}>Lägg till block</button></div>
    </div>
    <aside className="live-preview"><h2>Förhandsvisning</h2><BlockRenderer blocks={blocks} preview /></aside>
  </div>;
}
