import { editorDocumentV2Schema, safeUrlSchema, type EditorDocumentV2, type EditorNode } from './schema.ts';

export type QualityIssue = { code: string; severity: 'error' | 'warning'; message: string; nodeId?: string };

function textFromRichDocument(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const node = value as { type?: string; text?: string; attrs?: { level?: number }; content?: unknown[] };
  return [node.type === 'text' ? node.text ?? '' : '', ...(node.content ?? []).flatMap(textFromRichDocument)];
}

function inspectNode(node: EditorNode, issues: QualityIssue[], headings: number[]) {
  if (node.type === 'component_instance') return;
  if ('heading' in node && typeof node.heading === 'string' && !node.heading.trim()) issues.push({ code: 'empty-required-text', severity: 'error', message: 'En obligatorisk rubrik är tom.', nodeId: node.id });
  const image = 'image' in node ? node.image : undefined;
  if (image && !image.decorative && !image.alt.trim()) issues.push({ code: 'missing-alt', severity: 'error', message: 'En meningsbärande bild saknar alternativtext.', nodeId: node.id });
  if (node.type === 'hero') headings.push(1);
  if(node.type==='heading')headings.push(node.level);
  if (node.type === 'rich_text') {
    const walk = (value: unknown) => { if (!value || typeof value !== 'object') return; const item = value as any; if (item.type === 'heading') headings.push(item.attrs?.level ?? 2); (item.content ?? []).forEach(walk); };
    walk(node.document);
    const length = textFromRichDocument(node.document).join('').length;
    if (length > 3000) issues.push({ code: 'long-text', severity: 'warning', message: 'Textavsnittet är långt och kan bli lättare att läsa om det delas upp.', nodeId: node.id });
  }
  const serialized = JSON.stringify(node);
  for (const match of serialized.matchAll(/"(?:href|src)":"([^"]+)"/g)) if (!safeUrlSchema.safeParse(match[1]).success) issues.push({ code: 'unsafe-url', severity: 'error', message: 'En länk eller bildadress är inte säker.', nodeId: node.id });
}

export function validateEditorQuality(document: EditorDocumentV2, options: { seoTitle?: string | null; seoDescription?: string | null; socialMediaId?: string | null; knownComponentIds?: string[]; externalH1?: boolean; skipH1?: boolean } = {}) {
  const issues: QualityIssue[] = [];
  const parsed = editorDocumentV2Schema.safeParse(document);
  if (!parsed.success) return [{ code: 'invalid-document', severity: 'error', message: 'Sidans struktur är inte giltig.' }] satisfies QualityIssue[];
  const headings: number[] = [];
  parsed.data.root.forEach((section) => section.columns.forEach((column) => column.blocks.forEach((node) => {
    inspectNode(node, issues, headings);
    if (node.type === 'component_instance' && options.knownComponentIds && !options.knownComponentIds.includes(node.componentId)) issues.push({ code: 'missing-component', severity: 'error', message: 'En synkad komponent saknas eller är arkiverad.', nodeId: node.id });
  })));
  const h1Count = headings.filter((level) => level === 1).length + (options.externalH1 ? 1 : 0);
  if (!options.skipH1 && h1Count !== 1) issues.push({ code: h1Count ? 'multiple-h1' : 'missing-h1', severity: 'error', message: h1Count ? 'Sidan får bara ha en huvudrubrik.' : 'Sidan behöver en huvudrubrik.' });
  headings.forEach((level, index) => { if (index && level > headings[index - 1] + 1) issues.push({ code: 'heading-skip', severity: 'error', message: 'En rubriknivå hoppas över.' }); });
  if (!options.skipH1) {
    const seoTitleLength = options.seoTitle?.trim().length ?? 0;
    if (seoTitleLength && (seoTitleLength < 25 || seoTitleLength > 65)) issues.push({ code: 'seo-title-length', severity: 'warning', message: 'SEO-titeln kan bli tydligare om den är 25–65 tecken.' });
    const descriptionLength = options.seoDescription?.trim().length ?? 0;
    if (descriptionLength && (descriptionLength < 70 || descriptionLength > 165)) issues.push({ code: 'seo-description-length', severity: 'warning', message: 'Metabeskrivningen bör helst vara 70–165 tecken.' });
    if (!options.socialMediaId) issues.push({ code: 'missing-sharing-image', severity: 'warning', message: 'Sidan saknar delningsbild.' });
  }
  if (parsed.data.root.length > 24) issues.push({ code: 'many-sections', severity: 'warning', message: 'Sidan innehåller många sektioner.' });
  return issues;
}

export function hasBlockingQualityIssues(issues: QualityIssue[]) { return issues.some((issue) => issue.severity === 'error'); }
