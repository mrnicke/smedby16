import { describe,expect,it } from 'vitest';
import { secureDocumentUrl } from './urls';

describe('secureDocumentUrl',()=>{it('uses the header-controlled download endpoint',()=>{expect(secureDocumentUrl('https://project.supabase.co/','abc')).toBe('https://project.supabase.co/functions/v1/download-document?id=abc');});});
