import { useEffect, useState } from 'react';
import type { ContentBlock } from '../../lib/cms/schema';
import { pageTemplateRules } from '../../lib/cms/schema';
import RichTextEditor from './RichTextEditor';
import BlockRenderer from '../cms/BlockRenderer';
import { blockSummary } from './blockEditorUx';

const defaults: Record<ContentBlock['type'], ContentBlock> = {
  hero: { type: 'hero', heading: 'Ny rubrik', text: '' },
  rich_text: { type: 'rich_text', document: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Skriv text här.' }] }] } },
  card_grid: { type: 'card_grid', cards: [{ title: 'Kort', text: 'Beskrivning' }] },
  notice: { type: 'notice', heading: 'Information', text: '', tone: 'info' },
  image_text: { type: 'image_text', heading: 'Rubrik', text: '', image: { src: '/images/miljo-gronyta.webp', alt: 'Gemensam grönyta i området' }, imagePosition: 'right' },
  link_list: { type: 'link_list', links: [{ label: 'Länk', href: '/' }] },
  area_guide: { type: 'area_guide', heading: 'Områdesguide', text: '', links: [] },
  faq: { type: 'faq', items: [{ question: 'Fråga', answer: 'Svar' }] },
  news_feed: { type: 'news_feed', heading: 'Senaste nytt', limit: 3 },
  calendar_feed: { type: 'calendar_feed', heading: 'Kommande datum', limit: 5 },
  document_list: { type: 'document_list', heading: 'Dokument' },
  search_teaser: { type: 'search_teaser', heading: 'Sök på webbplatsen', text: 'Hitta regler, dokument och information.' },
};

const labels: Record<ContentBlock['type'], string> = {
  hero: 'Sidans topp', rich_text: 'Textavsnitt', card_grid: 'Kort med länkar', notice: 'Informationsruta', image_text: 'Bild med text',
  link_list: 'Lista med länkar', area_guide: 'Områdesguide', faq: 'Frågor och svar', news_feed: 'Senaste nyheter',
  calendar_feed: 'Kommande datum', document_list: 'Dokument', search_teaser: 'Sökruta',
};

type LinkValue = { label: string; href: string };
type ImageValue = { src: string; alt: string };
export type EditorMediaAsset = { id: string; original_name: string; alt_text: string; public_url: string };

function LinkEditor({ value, onChange, onRemove }: { value: LinkValue; onChange: (value: LinkValue) => void; onRemove?: () => void }) {
  return <div className="repeater-row">
    <label>Etikett<input value={value.label} onChange={(event) => onChange({ ...value, label: event.target.value })} /></label>
    <label>Länk<input value={value.href} onChange={(event) => onChange({ ...value, href: event.target.value })} placeholder="/sida/ eller https://…" /></label>
    {onRemove && <button type="button" className="danger compact" onClick={onRemove}>Ta bort</button>}
  </div>;
}

function ImageEditor({ value, onChange, media }: { value: ImageValue; onChange: (value: ImageValue) => void; media: EditorMediaAsset[] }) {
  return <div className="image-editor">
    <label>Välj från mediebiblioteket<select value="" onChange={(event) => { const asset = media.find((item) => item.id === event.target.value); if (asset) onChange({ src: asset.public_url, alt: asset.alt_text }); }}><option value="">Välj bild…</option>{media.map((asset) => <option value={asset.id} key={asset.id}>{asset.original_name}</option>)}</select></label>
    {value.src && <img className="image-editor-preview" src={value.src} alt={value.alt} />}
    <label>Alt-text<input value={value.alt} onChange={(event) => onChange({ ...value, alt: event.target.value })} /></label>
    <details><summary>Avancerad bildadress</summary><label>Bildadress<input value={value.src} onChange={(event) => onChange({ ...value, src: event.target.value })} placeholder="/images/… eller https://…" /></label></details>
  </div>;
}

function BlockFields({ block, onChange, media }: { block: ContentBlock; onChange: (block: ContentBlock) => void; media: EditorMediaAsset[] }) {
  if (block.type === 'hero') return <>
    <label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label>
    <label>Ingress<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
    {block.image ? <fieldset className="nested-fields"><legend>Bakgrundsbild</legend><ImageEditor value={block.image} media={media} onChange={(image) => onChange({ ...block, image })} /><button type="button" className="text-button" onClick={() => { const { image: _image, ...rest } = block; onChange(rest); }}>Ta bort bild</button></fieldset> : <button type="button" onClick={() => onChange({ ...block, image: { src: '/images/miljo-gronyta.webp', alt: 'Miljöbild från området' } })}>Lägg till bild</button>}
    {block.action ? <fieldset className="nested-fields"><legend>Knapp</legend><LinkEditor value={block.action} onChange={(action) => onChange({ ...block, action })} /><button type="button" className="text-button" onClick={() => { const { action: _action, ...rest } = block; onChange(rest); }}>Ta bort knapp</button></fieldset> : <button type="button" onClick={() => onChange({ ...block, action: { label: 'Läs mer', href: '/' } })}>Lägg till knapp</button>}
  </>;

  if (block.type === 'rich_text') return <>
    <label>Avsnittsrubrik (valfri)<input value={block.heading ?? ''} onChange={(event) => onChange({ ...block, heading: event.target.value || undefined })} /></label>
    <RichTextEditor value={block.document} onChange={(document) => onChange({ ...block, document })} />
  </>;

  if (block.type === 'notice') return <>
    <label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label>
    <label>Text<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
    <label>Ton<select value={block.tone} onChange={(event) => onChange({ ...block, tone: event.target.value as typeof block.tone })}><option value="info">Information</option><option value="warning">Varning</option><option value="success">Positiv</option></select></label>
  </>;

  if (block.type === 'image_text') return <>
    <label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label>
    <label>Text<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
    <ImageEditor value={block.image} media={media} onChange={(image) => onChange({ ...block, image })} />
    <label>Bildplacering<select value={block.imagePosition} onChange={(event) => onChange({ ...block, imagePosition: event.target.value as 'left' | 'right' })}><option value="left">Vänster</option><option value="right">Höger</option></select></label>
  </>;

  if (block.type === 'card_grid') return <>
    <label>Avsnittsrubrik (valfri)<input value={block.heading ?? ''} onChange={(event) => onChange({ ...block, heading: event.target.value || undefined })} /></label>
    <div className="repeater-list">{block.cards.map((card, index) => <fieldset className="nested-fields" key={index}>
      <legend>Kort {index + 1}</legend>
      <label>Rubrik<input value={card.title} onChange={(event) => onChange({ ...block, cards: block.cards.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) })} /></label>
      <label>Text<textarea value={card.text} onChange={(event) => onChange({ ...block, cards: block.cards.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item) })} /></label>
      {card.link ? <LinkEditor value={card.link} onChange={(link) => onChange({ ...block, cards: block.cards.map((item, itemIndex) => itemIndex === index ? { ...item, link } : item) })} onRemove={() => onChange({ ...block, cards: block.cards.map((item, itemIndex) => { if (itemIndex !== index) return item; const { link: _link, ...rest } = item; return rest; }) })} /> : <button type="button" onClick={() => onChange({ ...block, cards: block.cards.map((item, itemIndex) => itemIndex === index ? { ...item, link: { label: 'Läs mer', href: '/' } } : item) })}>Lägg till länk</button>}
      <button type="button" className="danger compact" disabled={block.cards.length === 1} onClick={() => onChange({ ...block, cards: block.cards.filter((_, itemIndex) => itemIndex !== index) })}>Ta bort kort</button>
    </fieldset>)}</div>
    <button type="button" disabled={block.cards.length >= 12} onClick={() => onChange({ ...block, cards: [...block.cards, { title: 'Nytt kort', text: 'Beskrivning' }] })}>Lägg till kort</button>
  </>;

  if (block.type === 'link_list') return <>
    <label>Avsnittsrubrik (valfri)<input value={block.heading ?? ''} onChange={(event) => onChange({ ...block, heading: event.target.value || undefined })} /></label>
    <div className="repeater-list">{block.links.map((link, index) => <LinkEditor key={index} value={link} onChange={(value) => onChange({ ...block, links: block.links.map((item, itemIndex) => itemIndex === index ? value : item) })} onRemove={block.links.length > 1 ? () => onChange({ ...block, links: block.links.filter((_, itemIndex) => itemIndex !== index) }) : undefined} />)}</div>
    <button type="button" disabled={block.links.length >= 30} onClick={() => onChange({ ...block, links: [...block.links, { label: 'Ny länk', href: '/' }] })}>Lägg till länk</button>
  </>;

  if (block.type === 'area_guide') return <>
    <label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label>
    <label>Text<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label>
    {block.image ? <fieldset className="nested-fields"><legend>Bild</legend><ImageEditor value={block.image} media={media} onChange={(image) => onChange({ ...block, image })} /><button type="button" className="text-button" onClick={() => { const { image: _image, ...rest } = block; onChange(rest); }}>Ta bort bild</button></fieldset> : <button type="button" onClick={() => onChange({ ...block, image: { src: '/images/omradeskarta.webp', alt: 'Karta över Smedby 1:6' } })}>Lägg till bild</button>}
    <div className="repeater-list">{block.links.map((link, index) => <LinkEditor key={index} value={link} onChange={(value) => onChange({ ...block, links: block.links.map((item, itemIndex) => itemIndex === index ? value : item) })} onRemove={() => onChange({ ...block, links: block.links.filter((_, itemIndex) => itemIndex !== index) })} />)}</div>
    <button type="button" disabled={block.links.length >= 12} onClick={() => onChange({ ...block, links: [...block.links, { label: 'Ny plats', href: '/kontakt/' }] })}>Lägg till länk</button>
  </>;

  if (block.type === 'faq') return <>
    <label>Avsnittsrubrik (valfri)<input value={block.heading ?? ''} onChange={(event) => onChange({ ...block, heading: event.target.value || undefined })} /></label>
    <div className="repeater-list">{block.items.map((item, index) => <fieldset className="nested-fields" key={index}><legend>Fråga {index + 1}</legend><label>Fråga<input value={item.question} onChange={(event) => onChange({ ...block, items: block.items.map((value, itemIndex) => itemIndex === index ? { ...value, question: event.target.value } : value) })} /></label><label>Svar<textarea value={item.answer} onChange={(event) => onChange({ ...block, items: block.items.map((value, itemIndex) => itemIndex === index ? { ...value, answer: event.target.value } : value) })} /></label><button type="button" className="danger compact" disabled={block.items.length === 1} onClick={() => onChange({ ...block, items: block.items.filter((_, itemIndex) => itemIndex !== index) })}>Ta bort fråga</button></fieldset>)}</div>
    <button type="button" disabled={block.items.length >= 30} onClick={() => onChange({ ...block, items: [...block.items, { question: 'Ny fråga', answer: 'Svar' }] })}>Lägg till fråga</button>
  </>;

  if (block.type === 'news_feed' || block.type === 'calendar_feed') return <div className="field-grid compact-grid"><label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label><label>Antal<input type="number" min={1} max={12} value={block.limit} onChange={(event) => onChange({ ...block, limit: Number(event.target.value) })} /></label></div>;
  if (block.type === 'document_list') return <div className="field-grid compact-grid"><label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label><label>Kategori (valfri)<input value={block.category ?? ''} onChange={(event) => onChange({ ...block, category: event.target.value || undefined })} /></label></div>;
  return <><label>Rubrik<input value={block.heading} onChange={(event) => onChange({ ...block, heading: event.target.value })} /></label><label>Hjälptext<textarea value={block.text} onChange={(event) => onChange({ ...block, text: event.target.value })} /></label></>;
}

export default function BlockEditor({ template, blocks, onChange, media = [] }: { template: keyof typeof pageTemplateRules; blocks: ContentBlock[]; onChange: (blocks: ContentBlock[]) => void; media?: EditorMediaAsset[] }) {
  const allowed = pageTemplateRules[template].allowed;
  const [addType, setAddType] = useState<ContentBlock['type']>(allowed[0]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop'|'mobile'>('desktop');
  const [openBlocks, setOpenBlocks] = useState<Set<number>>(() => new Set([0]));
  useEffect(() => { if (!allowed.includes(addType)) setAddType(allowed[0]); }, [template, addType, allowed]);
  const update = (index: number, block: ContentBlock) => onChange(blocks.map((item, itemIndex) => itemIndex === index ? block : item));
  const move = (from: number, to: number) => { const copy = [...blocks]; const [item] = copy.splice(from, 1); copy.splice(to, 0, item); onChange(copy); };
  return <div className="block-editor">
    <div className="block-editor-list">
      <div className="block-editor-heading"><div><p className="eyebrow">Det besökaren ser</p><h2>Sidans innehåll</h2><p>Öppna en innehållsdel för att ändra den. Ordningen här är samma som på webbplatsen.</p></div><span>{blocks.length} {blocks.length === 1 ? 'innehållsdel' : 'innehållsdelar'}</span></div>
      {blocks.map((block, index) => <details className={`block-panel ${draggedIndex === index ? 'is-dragging' : ''}`} open={openBlocks.has(index)} key={`${block.type}-${index}`} onToggle={(event) => { const isOpen = event.currentTarget.open; setOpenBlocks((current) => { const next = new Set(current); if (isOpen) next.add(index); else next.delete(index); return next; }); }} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedIndex !== null && draggedIndex !== index) move(draggedIndex, index); setDraggedIndex(null); }}>
        <summary><span className="drag-handle" draggable aria-hidden="true" onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedIndex(index); }} onDragEnd={() => setDraggedIndex(null)} title="Dra för att sortera">⋮⋮</span><span className="block-number" aria-hidden="true">{index + 1}</span><span className="block-summary"><strong>{labels[block.type]}</strong><small>{blockSummary(block)}</small></span><span className="block-edit-hint">Ändra</span><i className="ph ph-caret-down" aria-hidden="true" /></summary>
        <div className="block-panel-body"><div className="block-actions" aria-label={`Åtgärder för ${labels[block.type]}`}><button type="button" disabled={index === 0} onClick={() => move(index, index - 1)}><i className="ph ph-arrow-up" aria-hidden="true" />Flytta upp</button><button type="button" disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)}><i className="ph ph-arrow-down" aria-hidden="true" />Flytta ned</button><button type="button" onClick={() => onChange([...blocks.slice(0, index + 1), structuredClone(block), ...blocks.slice(index + 1)])}><i className="ph ph-copy" aria-hidden="true" />Gör en kopia</button><button type="button" className="danger" onClick={() => { if (window.confirm(`Vill du ta bort innehållsdelen “${labels[block.type]}”?`)) onChange(blocks.filter((_, itemIndex) => itemIndex !== index)); }}><i className="ph ph-trash" aria-hidden="true" />Ta bort</button></div><BlockFields block={block} media={media} onChange={(value) => update(index, value)} /></div>
      </details>)}
      <div className="add-block"><div><i className="ph ph-plus-circle" aria-hidden="true" /><span><strong>Lägg till mer innehåll</strong><small>Den nya delen hamnar längst ned på sidan.</small></span></div><label>Typ av innehåll<select value={addType} onChange={(event) => setAddType(event.target.value as ContentBlock['type'])}>{allowed.map((type) => <option value={type} key={type}>{labels[type]}</option>)}</select></label><button type="button" className="button button-secondary" onClick={() => onChange([...blocks, structuredClone(defaults[addType])])}><i className="ph ph-plus" aria-hidden="true" />Lägg till</button></div>
    </div>
    <aside className={`live-preview preview-${previewMode}`}><div className="preview-heading"><div><p className="eyebrow">Förhandsvisning</p><h2>Så ser sidan ut</h2><p>Ändringar visas här direkt, innan du sparar.</p></div><div className="preview-switch" role="group" aria-label="Förhandsvisningsstorlek"><button type="button" aria-pressed={previewMode === 'desktop'} className={previewMode === 'desktop' ? 'is-active' : ''} onClick={() => setPreviewMode('desktop')}><i className="ph ph-desktop" aria-hidden="true" />Dator</button><button type="button" aria-pressed={previewMode === 'mobile'} className={previewMode === 'mobile' ? 'is-active' : ''} onClick={() => setPreviewMode('mobile')}><i className="ph ph-device-mobile" aria-hidden="true" />Mobil</button></div></div><BlockRenderer blocks={blocks} preview /></aside>
  </div>;
}
