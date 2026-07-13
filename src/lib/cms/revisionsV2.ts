import type { EditorDocumentV2 } from './schema';

export type RevisionChange = { type: 'text_changed' | 'image_changed' | 'block_added' | 'block_removed' | 'block_moved' | 'setting_changed' | 'component_version_changed'; label: string; nodeId?: string };
const nodes = (document: EditorDocumentV2) => document.root.flatMap((section, sectionIndex) => section.columns.flatMap((column, columnIndex) => column.blocks.map((node, blockIndex) => ({ node, position: `${sectionIndex}.${columnIndex}.${blockIndex}` }))));

export function diffEditorDocuments(before: EditorDocumentV2, after: EditorDocumentV2): RevisionChange[] {
  const oldNodes = new Map(nodes(before).map((item) => [item.node.id, item])); const newNodes = new Map(nodes(after).map((item) => [item.node.id, item])); const changes: RevisionChange[] = [];
  for (const [id, item] of newNodes) { const old = oldNodes.get(id); if (!old) changes.push({ type: 'block_added', label: 'Innehållsdel tillagd', nodeId: id }); else if (old.position !== item.position) changes.push({ type: 'block_moved', label: 'Innehållsdel flyttad', nodeId: id }); else if (JSON.stringify(old.node) !== JSON.stringify(item.node)) { const imageChanged=item.node.type!=='component_instance'&&old.node.type!=='component_instance'&&JSON.stringify('image' in old.node?old.node.image:null)!==JSON.stringify('image' in item.node?item.node.image:null);changes.push({ type: item.node.type === 'component_instance' ? 'component_version_changed' : imageChanged ? 'image_changed' : 'text_changed', label: item.node.type === 'component_instance' ? 'Synkad komponent ändrad' : imageChanged ? 'Bild ändrad' : 'Text ändrad', nodeId: id }); } }
  for (const id of oldNodes.keys()) if (!newNodes.has(id)) changes.push({ type: 'block_removed', label: 'Innehållsdel borttagen', nodeId: id });
  before.root.forEach((section, index) => { const next = after.root[index]; if (next && (section.variant !== next.variant || section.width !== next.width || section.spacing !== next.spacing)) changes.push({ type: 'setting_changed', label: 'Sektionsinställning ändrad', nodeId: next.id }); });
  return changes;
}
