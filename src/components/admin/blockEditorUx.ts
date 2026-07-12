import type { ContentBlock } from '../../lib/cms/schema';

export function blockSummary(block: ContentBlock) {
  if ('heading' in block && block.heading) return block.heading;
  if (block.type === 'card_grid') return `${block.cards.length} kort`;
  if (block.type === 'faq') return `${block.items.length} frågor`;
  if (block.type === 'link_list') return `${block.links.length} länkar`;
  if (block.type === 'rich_text') return 'Formaterad text';
  return 'Innehållsblock';
}
