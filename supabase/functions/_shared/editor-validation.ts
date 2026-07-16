import { validateComponentInstances, type EditorDocumentV2 } from './cms-schema.ts';

export async function validatePublishedComponentInstances(service: any, document: EditorDocumentV2, rootComponentId?: string) {
  const { data, error } = await service
    .from('reusable_components')
    .select('id,allowed_instance_properties,published_definition')
    .eq('is_published', true)
    .is('archived_at', null);
  if (error) throw error;
  return validateComponentInstances(document, data ?? [], rootComponentId);
}
