import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { contentBlockSchema, editorDocumentV2Schema, type ContentBlock, type EditorDocumentV2 } from '../../lib/cms/schema';
import { resolveCmsHref } from '../../lib/cms/links';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import { getPublicSupabaseConfig } from '../../lib/supabase/config';
import type { PublicCollections } from '../../lib/supabase/snapshot';
import { secureDocumentUrl } from '../../lib/supabase/urls';
import SearchExperience from './SearchExperience';

type Props = { blocks?: ContentBlock[]; document?: EditorDocumentV2 | null; preview?: boolean; collections?: PublicCollections; components?: Record<string,{published_definition:EditorDocumentV2}>; componentDepth?:number; componentTrail?:string[] };

function imageStyle(image: { focusX?: number; focusY?: number }) {
  return { objectPosition: `${Math.round((image.focusX ?? 0.5) * 100)}% ${Math.round((image.focusY ?? 0.5) * 100)}%` };
}

function renderRichNode(node: any, key: number | string): ReactNode {
  if (!node || typeof node !== 'object') return null;
  const children = Array.isArray(node.content) ? node.content.map((child: unknown, index: number) => renderRichNode(child, index)) : null;
  if (node.type === 'text') {
    let value: ReactNode = String(node.text ?? '');
    for (const mark of Array.isArray(node.marks) ? node.marks : []) {
      if (mark.type === 'bold') value = <strong>{value}</strong>;
      if (mark.type === 'italic') value = <em>{value}</em>;
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string') value = <a href={mark.attrs.href}>{value}</a>;
    }
    return <Fragment key={key}>{value}</Fragment>;
  }
  const tags: Record<string, (content: ReactNode) => ReactNode> = {
    paragraph: (content) => <p key={key}>{content}</p>,
    heading: (content) => node.attrs?.level === 3 ? <h3 key={key}>{content}</h3> : <h2 key={key}>{content}</h2>,
    bulletList: (content) => <ul key={key}>{content}</ul>,
    orderedList: (content) => <ol key={key}>{content}</ol>,
    listItem: (content) => <li key={key}>{content}</li>,
    blockquote: (content) => <blockquote key={key}>{content}</blockquote>,
    hardBreak: () => <br key={key} />,
  };
  return tags[node.type]?.(children) ?? <Fragment key={key}>{children}</Fragment>;
}

function DynamicFeed({ kind, heading, limit = 8, category, initialItems = [], components = {} }: { kind: 'news' | 'calendar' | 'documents'; heading: string; limit?: number; category?: string; initialItems?: any[]; components?: Props['components'] }) {
  const filterItems = (values: any[]) => (category ? values.filter((item) => item.category === category) : values).slice(0, limit);
  const [items, setItems] = useState<any[]>(filterItems(initialItems));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const table = kind === 'news' ? 'public_news_posts' : kind === 'calendar' ? 'public_calendar_events' : 'public_documents';
    const order = kind === 'news' ? 'published_at' : kind === 'calendar' ? 'starts_at' : 'sort_order';
    let query = client.from(table).select('*').order(order, { ascending: kind !== 'news' });
    if (category && kind === 'documents') query = query.eq('category', category);
    query.limit(limit).then(({ data }) => setItems((data ?? []).map((item: any) => kind === 'documents' ? { ...item, public_url: secureDocumentUrl(getPublicSupabaseConfig()!.url,item.id) } : item)));
  }, [kind, limit, category]);
  useEffect(() => { if (kind === 'news') setSelectedSlug(new URLSearchParams(window.location.search).get('nyhet')); }, [kind]);
  const empty = kind === 'calendar' ? 'Inga kommande datum är publicerade.' : kind === 'news' ? 'Inga nyheter är publicerade.' : 'Inga dokument är publicerade.';
  const selected = selectedSlug ? items.find((item) => item.slug === selectedSlug) : null;
  return <section className="cms-section cms-feed"><div className="container"><h2>{selected?.title ?? heading}</h2>{selected ? <><p className="lead">{selected.summary}</p><BlockRenderer blocks={selected.body_blocks ?? []} document={selected.editor_version===2?selected.editor_document:null} components={components}/><a href="/senaste-nytt/">Till alla nyheter</a></> : items.length === 0 ? <p>{empty}</p> : <div className="cms-card-grid">{items.map((item) => <article className="cms-card" key={item.id}><p className="meta">{kind === 'calendar' ? item.starts_at?.slice(0, 10) : kind === 'news' ? item.published_at?.slice(0, 10) : item.category}</p><h3>{item.title}</h3><p>{item.summary ?? item.description}</p>{kind === 'news' && <a href={`/senaste-nytt/?nyhet=${encodeURIComponent(item.slug)}`}>Läs mer</a>}{kind === 'documents' && item.public_url && <a href={item.public_url}>Öppna dokument</a>}</article>)}</div>}</div></section>;
}

export default function BlockRenderer({ blocks = [], document, preview = false, collections, components = {}, componentDepth=0, componentTrail=[] }: Props) {
  const supabaseUrl = getPublicSupabaseConfig()?.url;
  const hrefFor = (href: string) => resolveCmsHref(href, supabaseUrl);
  if (document) {const safeDocument=editorDocumentV2Schema.parse(document);return <div className={preview ? 'cms-renderer is-preview' : 'cms-renderer'}>{safeDocument.root.map((section) => <section className={`editor-section variant-${section.variant} width-${section.width} spacing-${section.spacing}`} key={section.id}><div className={`editor-columns columns-${section.columns.length}`}>{section.columns.map((column) => <div className={`editor-column span-${column.width}`} key={column.id}>{column.blocks.map((node) => {if(node.type!=='component_instance')return <BlockRenderer key={node.id} blocks={[contentBlockSchema.parse(node)]} preview={preview} collections={collections} components={components}/>;if(componentDepth>=8||componentTrail.includes(node.componentId))return null;const parsed=editorDocumentV2Schema.safeParse(components[node.componentId]?.published_definition);return parsed.success?<BlockRenderer key={node.id} document={parsed.data} preview={preview} collections={collections} components={components} componentDepth={componentDepth+1} componentTrail={[...componentTrail,node.componentId]}/>:null;})}</div>)}</div></section>)}</div>}
  return <div className={preview ? 'cms-renderer is-preview' : 'cms-renderer'}>
    {blocks.map((block, index) => {
      const key = `${block.type}-${index}`;
      if (block.type === 'hero') return <section className="cms-hero" key={key}>{block.image && <img src={block.image.src} alt={block.image.decorative ? '' : block.image.alt} style={imageStyle(block.image)} />}<div className="container"><h1>{block.heading}</h1>{block.text && <p>{block.text}</p>}{block.action && <a className="button button-primary" href={hrefFor(block.action.href)}>{block.action.label}</a>}</div></section>;
      if (block.type === 'rich_text') return <section className="cms-section" key={key}><div className="container article-body">{block.heading && <h2>{block.heading}</h2>}{block.document.content.map((node, nodeIndex) => renderRichNode(node, nodeIndex))}</div></section>;
      if (block.type === 'card_grid') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}<div className="cms-card-grid">{block.cards.map((card) => <article className="cms-card" key={card.title}><h3>{card.title}</h3><p>{card.text}</p>{card.link && <a href={hrefFor(card.link.href)}>{card.link.label}</a>}</article>)}</div></div></section>;
      if (block.type === 'notice') return <section className="cms-section" key={key}><div className={`container cms-notice tone-${block.tone}`}><h2>{block.heading}</h2><p>{block.text}</p></div></section>;
      if (block.type === 'image_text') return <section className="cms-section" key={key}><div className={`container cms-image-text image-${block.imagePosition}`}><img src={block.image.src} alt={block.image.decorative ? '' : block.image.alt} style={imageStyle(block.image)} /><div><h2>{block.heading}</h2><p>{block.text}</p></div></div></section>;
      if (block.type === 'link_list') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}<ul className="cms-link-list">{block.links.map((link) => <li key={link.href}><a href={hrefFor(link.href)}>{link.label}</a></li>)}</ul></div></section>;
      if (block.type === 'area_guide') return <section className="cms-section" key={key}><div className="container cms-area-guide">{block.image && <img src={block.image.src} alt={block.image.decorative ? '' : block.image.alt} style={imageStyle(block.image)} />}<div><h2>{block.heading}</h2><p>{block.text}</p>{block.links.map((link) => <a key={link.href} href={hrefFor(link.href)}>{link.label}</a>)}</div></div></section>;
      if (block.type === 'faq') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}{block.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
      if (block.type === 'news_feed') return <DynamicFeed key={key} kind="news" heading={block.heading} limit={block.limit} initialItems={collections?.news} components={components} />;
      if (block.type === 'calendar_feed') return <DynamicFeed key={key} kind="calendar" heading={block.heading} limit={block.limit} initialItems={collections?.calendar} />;
      if (block.type === 'document_list') return <DynamicFeed key={key} kind="documents" heading={block.heading} category={block.category} initialItems={collections?.documents} />;
      if (block.type === 'search_teaser') return <SearchExperience key={key} heading={block.heading} text={block.text} preview={preview} />;
      if(block.type==='heading')return block.level===3?<h3 className="container" key={key}>{block.text}</h3>:<h2 className="container" key={key}>{block.text}</h2>;
      if(block.type==='image')return <figure className={`container cms-image crop-${block.image.crop??'original'}`} key={key}><img src={block.image.src} alt={block.image.decorative?'':block.image.alt} style={imageStyle(block.image)}/></figure>;
      if(block.type==='button')return <div className="container" key={key}><a className={`button button-${block.variant}`} href={hrefFor(block.href)}>{block.label}</a></div>;
      if(block.type==='divider')return <hr className={`container divider-${block.variant}`} key={key}/>;
      if(block.type==='spacer')return <div className={`fixed-spacer spacer-${block.size}`} aria-hidden="true" key={key}/>;
      if(block.type==='approved_embed')return <div className={`container approved-embed aspect-${block.aspect.replace(':','-')}`} key={key}><iframe src={block.url} title={block.title} loading="lazy" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin"/></div>;
      return null;
    })}
  </div>;
}
