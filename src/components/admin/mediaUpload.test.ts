import { describe, expect, it } from 'vitest';
import { ACCEPTED_MEDIA_TYPES, MAX_MEDIA_BYTES, validateMediaUpload } from './mediaUpload';

describe('direct media upload validation', () => {
  it('accepts a described image and a PDF within the size limit', () => {
    expect(validateMediaUpload({ type: 'image/webp', size: 1200 } as File, 'image', 'Gemensam grönyta')).toBeNull();
    expect(validateMediaUpload({ type: 'application/pdf', size: 1200 } as File, 'pdf')).toBeNull();
  });

  it('uses clear messages for unsupported files, missing descriptions and large files', () => {
    expect(validateMediaUpload({ type: 'image/gif', size: 1200 } as File, 'image', 'Bild')).toContain('JPEG');
    expect(validateMediaUpload({ type: 'image/png', size: 1200 } as File, 'image', '')).toContain('bildbeskrivning');
    expect(validateMediaUpload({ type: 'application/pdf', size: MAX_MEDIA_BYTES + 1 } as File, 'pdf')).toContain('25 MB');
  });

  it('advertises exactly the file formats accepted by validation', () => {
    expect(ACCEPTED_MEDIA_TYPES).toBe('image/jpeg,image/png,image/webp,application/pdf');
  });
});
