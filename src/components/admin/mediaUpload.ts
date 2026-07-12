import type { SupabaseClient } from '@supabase/supabase-js';

export type UploadKind = 'image' | 'pdf';
export type UploadedMediaAsset = {
  id: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  alt_text: string;
  public_url: string;
};

export const MAX_MEDIA_BYTES = 26_214_400;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function validateMediaUpload(file: Pick<File, 'type'|'size'>, kind: UploadKind, altText = '') {
  if (file.size > MAX_MEDIA_BYTES) return 'Filen är för stor. Välj en fil som är mindre än 25 MB.';
  if (kind === 'pdf' && file.type !== 'application/pdf') return 'Välj en PDF-fil.';
  if (kind === 'image' && !imageTypes.includes(file.type)) return 'Välj en bild i formatet JPEG, PNG, WebP eller AVIF.';
  if (kind === 'image' && !altText.trim()) return 'Skriv en kort bildbeskrivning så att även den som inte ser bilden förstår innehållet.';
  return null;
}

export async function uploadMediaAsset(client: SupabaseClient, file: File, kind: UploadKind, altText = ''): Promise<UploadedMediaAsset> {
  const validationError = validateMediaUpload(file, kind, altText);
  if (validationError) throw new Error(validationError);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? (kind === 'pdf' ? 'pdf' : 'bin');
  const storagePath = `${kind === 'pdf' ? 'documents' : 'images'}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await client.storage.from('public-media').upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) throw new Error('Filen kunde inte laddas upp. Försök igen.');
  try {
    const { data, error } = await client.functions.invoke('save-content', { body: { entity: 'media_assets', payload: { storage_path: storagePath, original_name: file.name, mime_type: file.type, size_bytes: file.size, alt_text: altText.trim() } } });
    if (error) throw new Error(data?.error ?? error.message);
    return { ...data.data, public_url: client.storage.from('public-media').getPublicUrl(storagePath).data.publicUrl } as UploadedMediaAsset;
  } catch (error) {
    await client.storage.from('public-media').remove([storagePath]);
    throw error;
  }
}
