import { describe, expect, it } from 'vitest';
import { buildCalendarIcs, escapeIcs } from './ics';
describe('ICS',()=>{
  it('escapes reserved characters and line breaks',()=>expect(escapeIcs('A, B; C\nD')).toBe('A\\, B\\; C\\nD'));
  it('creates an exclusive end date for a one-day event',()=>{const value=buildCalendarIcs([{id:'event-1',title:'Städdag',startsAt:'2026-07-11',allDay:true}],'2026-07-01T10:00:00Z');expect(value).toContain('DTSTART;VALUE=DATE:20260711');expect(value).toContain('DTEND;VALUE=DATE:20260712');expect(value).toContain('UID:event-1@smedby16')});
});
