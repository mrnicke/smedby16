import type { APIRoute } from 'astro';
import { calendarEvents } from '../data/calendar';
import { buildCalendarIcs } from '../lib/calendar/ics';
export const prerender = true;
export const GET: APIRoute = () => new Response(buildCalendarIcs(calendarEvents.map((event,index)=>({id:`${event.date}-${index}`,title:event.title,description:event.description,startsAt:event.date,endsAt:event.endDate,allDay:true,location:event.location,url:event.href}))),{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'inline; filename="smedby-1-6-kalender.ics"'}});
