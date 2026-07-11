import { Fragment, useEffect, useState, type ReactNode } from 'react';
import type { ContentBlock } from '../../lib/cms/schema';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import type { PublicCollections } from '../../lib/supabase/snapshot';

type Props = { blocks: ContentBlock[]; preview?: boolean; collections?: PublicCollections };

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

function DynamicFeed({ kind, heading, limit = 8, initialItems = [] }: { kind: 'news' | 'calendar' | 'documents'; heading: string; limit?: number; initialItems?: any[] }) {
  const [items, setItems] = useState<any[]>(initialItems.slice(0, limit));
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const table = kind === 'news' ? 'public_news_posts' : kind === 'calendar' ? 'public_calendar_events' : 'public_documents';
    const order = kind === 'news' ? 'published_at' : kind === 'calendar' ? 'starts_at' : 'sort_order';
    client.from(table).select('*').order(order, { ascending: kind !== 'news' }).limit(limit).then(({ data }) => setItems((data ?? []).map((item: any) => kind === 'documents' && item.storage_path ? { ...item, public_url: client.storage.from('public-media').getPublicUrl(item.storage_path).data.publicUrl } : item)));
  }, [kind, limit]);
  useEffect(() => { if (kind === 'news') setSelectedSlug(new URLSearchParams(window.location.search).get('nyhet')); }, [kind]);
  const empty = kind === 'calendar' ? 'Inga kommande datum är publicerade.' : kind === 'news' ? 'Inga nyheter är publicerade.' : 'Inga dokument är publicerade.';
  const selected = selectedSlug ? items.find((item) => item.slug === selectedSlug) : null;
  return <section className="cms-section cms-feed"><div className="container"><h2>{selected?.title ?? heading}</h2>{selected ? <><p className="lead">{selected.summary}</p><BlockRenderer blocks={selected.body_blocks ?? []}/><a href="/senaste-nytt/">Till alla nyheter</a></> : items.length === 0 ? <p>{empty}</p> : <div className="cms-card-grid">{items.map((item) => <article className="cms-card" key={item.id}><p className="meta">{kind === 'calendar' ? item.starts_at?.slice(0, 10) : kind === 'news' ? item.published_at?.slice(0, 10) : item.category}</p><h3>{item.title}</h3><p>{item.summary ?? item.description}</p>{kind === 'news' && <a href={`/senaste-nytt/?nyhet=${encodeURIComponent(item.slug)}`}>Läs mer</a>}{kind === 'documents' && item.public_url && <a href={item.public_url}>Öppna dokument</a>}</article>)}</div>}</div></section>;
}

export default function BlockRenderer({ blocks, preview = false, collections }: Props) {
  return <div className={preview ? 'cms-renderer is-preview' : 'cms-renderer'}>
    {blocks.map((block, index) => {
      const key = `${block.type}-${index}`;
      if (block.type === 'hero') return <section className="cms-hero" key={key}>{block.image && <img src={block.image.src} alt={block.image.alt} />}<div className="container"><h1>{block.heading}</h1>{block.text && <p>{block.text}</p>}{block.action && <a className="button button-primary" href={block.action.href}>{block.action.label}</a>}</div></section>;
      if (block.type === 'rich_text') return <section className="cms-section" key={key}><div className="container article-body">{block.heading && <h2>{block.heading}</h2>}{block.document.content.map((node, nodeIndex) => renderRichNode(node, nodeIndex))}</div></section>;
      if (block.type === 'card_grid') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}<div className="cms-card-grid">{block.cards.map((card) => <article className="cms-card" key={card.title}><h3>{card.title}</h3><p>{card.text}</p>{card.link && <a href={card.link.href}>{card.link.label}</a>}</article>)}</div></div></section>;
      if (block.type === 'notice') return <section className="cms-section" key={key}><div className={`container cms-notice tone-${block.tone}`}><h2>{block.heading}</h2><p>{block.text}</p></div></section>;
      if (block.type === 'image_text') return <section className="cms-section" key={key}><div className={`container cms-image-text image-${block.imagePosition}`}><img src={block.image.src} alt={block.image.alt} /><div><h2>{block.heading}</h2><p>{block.text}</p></div></div></section>;
      if (block.type === 'link_list') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}<ul className="cms-link-list">{block.links.map((link) => <li key={link.href}><a href={link.href}>{link.label}</a></li>)}</ul></div></section>;
      if (block.type === 'area_guide') return <section className="cms-section" key={key}><div className="container cms-area-guide">{block.image && <img src={block.image.src} alt={block.image.alt} />}<div><h2>{block.heading}</h2><p>{block.text}</p>{block.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</div></div></section>;
      if (block.type === 'faq') return <section className="cms-section" key={key}><div className="container">{block.heading && <h2>{block.heading}</h2>}{block.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
      if (block.type === 'news_feed') return <DynamicFeed key={key} kind="news" heading={block.heading} limit={block.limit} initialItems={collections?.news} />;
      if (block.type === 'calendar_feed') return <DynamicFeed key={key} kind="calendar" heading={block.heading} limit={block.limit} initialItems={collections?.calendar} />;
      if (block.type === 'document_list') return <DynamicFeed key={key} kind="documents" heading={block.heading} initialItems={collections?.documents} />;
      if (block.type === 'search_teaser') return <section className="cms-section" key={key}><div className="container"><h2>{block.heading}</h2><p>{block.text}</p><form action="/sok/" method="get" className="home-search"><input name="q" type="search" minLength={2} required /><button type="submit">Sök</button></form></div></section>;
      return null;
    })}
  </div>;
}
