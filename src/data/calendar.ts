export type CalendarEvent = {
  title: string;
  date: string;
  endDate?: string;
  time?: string;
  location?: string;
  description: string;
  category: 'möte' | 'aktivitet' | 'underhåll' | 'information';
  href?: string;
};

/**
 * Lägg endast in bekräftade datum här. Kalendern visar en tydlig tomstatus
 * tills styrelsen har publicerat en aktivitet.
 */
export const calendarEvents: CalendarEvent[] = [];
