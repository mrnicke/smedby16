import type { APIRoute } from 'astro';
import { calendarEvents } from '../data/calendar';

export const prerender = true;

const escapeIcs = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

const asIcsDate = (value: string) => value.replaceAll('-', '');

export const GET: APIRoute = () => {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smedby 1:6//Kalender//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Smedby 1:6',
  ];

  for (const event of calendarEvents) {
    const endDate = event.endDate ?? event.date;
    const exclusiveEnd = new Date(`${endDate}T12:00:00`);
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    const exclusiveEndKey = exclusiveEnd.toISOString().slice(0, 10);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${asIcsDate(event.date)}-${encodeURIComponent(event.title)}@smedby-1-6`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}`,
      `DTSTART;VALUE=DATE:${asIcsDate(event.date)}`,
      `DTEND;VALUE=DATE:${asIcsDate(exclusiveEndKey)}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(event.description)}`,
      ...(event.location ? [`LOCATION:${escapeIcs(event.location)}`] : []),
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="smedby-1-6-kalender.ics"',
    },
  });
};
