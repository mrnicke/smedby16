export function secureDocumentUrl(supabaseUrl: string, documentId: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/download-document?id=${encodeURIComponent(documentId)}`;
}
