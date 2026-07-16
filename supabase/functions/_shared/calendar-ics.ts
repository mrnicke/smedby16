// Canonical calendar serializer shared by the Astro app and Supabase Edge Functions.
export type IcsEvent = { id: string; title: string; description?: string; startsAt: string; endsAt?: string | null; allDay: boolean; location?: string | null; url?: string | null };

export const escapeIcs = (value: string) => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
export const formatIcsTimestamp = (value: string, allDay: boolean) => allDay ? value.slice(0,10).replaceAll('-','') : new Date(value).toISOString().replace(/[-:]/g,'').replace('.000','');
const nextDay = (value: string) => { const date = new Date(`${value.slice(0,10)}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+1); return date.toISOString(); };

export function buildCalendarIcs(events: IcsEvent[], generatedAt = new Date().toISOString()) {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Smedby 1:6//Kalender//SV','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Smedby 1:6'];
  for (const event of events) {
    const startKey=event.allDay?'DTSTART;VALUE=DATE':'DTSTART'; const endKey=event.allDay?'DTEND;VALUE=DATE':'DTEND';
    const end=event.endsAt ?? (event.allDay?nextDay(event.startsAt):null);
    lines.push('BEGIN:VEVENT',`UID:${event.id}@smedby16`,`DTSTAMP:${formatIcsTimestamp(generatedAt,false)}`,`${startKey}:${formatIcsTimestamp(event.startsAt,event.allDay)}`,...(end?[`${endKey}:${formatIcsTimestamp(end,event.allDay)}`]:[]),`SUMMARY:${escapeIcs(event.title)}`,`DESCRIPTION:${escapeIcs(event.description??'')}`,...(event.location?[`LOCATION:${escapeIcs(event.location)}`]:[]),...(event.url?[`URL:${event.url}`]:[]),'END:VEVENT');
  }
  return `${[...lines,'END:VCALENDAR'].join('\r\n')}\r\n`;
}
