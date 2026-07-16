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
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_MEDIA_TYPES = [...imageTypes, 'application/pdf'].join(',');

export function validateMediaUpload(file: Pick<File, 'type'|'size'>, kind: UploadKind, altText = '') {
  if (file.size > MAX_MEDIA_BYTES) return 'Filen är för stor. Välj en fil som är mindre än 25 MB.';
  if (kind === 'pdf' && file.type !== 'application/pdf') return 'Välj en PDF-fil.';
  if (kind === 'image' && !imageTypes.includes(file.type)) return 'Välj en bild i formatet JPEG, PNG eller WebP.';
  if (kind === 'image' && !altText.trim()) return 'Skriv en kort bildbeskrivning så att även den som inte ser bilden förstår innehållet.';
  return null;
}

export async function uploadMediaAsset(client: SupabaseClient, file: File, kind: UploadKind, altText = ''): Promise<UploadedMediaAsset> {
  const validationError = validateMediaUpload(file, kind, altText);
  if (validationError) throw new Error(validationError);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new Error('Logga in igen innan du laddar upp filen.');
  const quarantinePath = `${userData.user.id}/${crypto.randomUUID()}.upload`;
  const { error: uploadError } = await client.storage.from('media-quarantine').upload(quarantinePath, file, { contentType: 'application/octet-stream', upsert: false });
  if (uploadError) throw new Error('Filen kunde inte laddas upp. Försök igen.');
  try {
    const { data, error } = await client.functions.invoke('verify-media-upload', { body: { path: quarantinePath, originalName: file.name, kind, altText: altText.trim() } });
    if (error) throw new Error(data?.error ?? error.message);
    return { ...data.data, public_url: client.storage.from('public-media').getPublicUrl(data.data.storage_path).data.publicUrl } as UploadedMediaAsset;
  } catch (error) {
    await client.storage.from('media-quarantine').remove([quarantinePath]);
    throw error;
  }
}
