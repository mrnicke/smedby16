import { news } from './news';

export type SearchEntry = {
  title: string;
  href: string;
  type: 'information' | 'nyheter' | 'dokument' | 'kalender';
  typeLabel: string;
  excerpt: string;
  keywords: string[];
};

const baseEntries: SearchEntry[] = [
  {
    title: 'Områdesguiden',
    href: '/#omradesguiden',
    type: 'information',
    typeLabel: 'Området',
    excerpt: 'Hitta garage, parkering, gångvägar, grönytor, sophantering och områdets entréer.',
    keywords: ['karta', 'område', 'garage', 'parkering', 'gångväg', 'grönyta', 'sopor', 'entré'],
  },
  {
    title: 'För boende',
    href: '/for-boende/',
    type: 'information',
    typeLabel: 'Boendeinformation',
    excerpt: 'Praktisk information för boende och fastighetsägare i Smedby 1:6.',
    keywords: ['boende', 'nyinflyttad', 'fastighetsägare', 'ansvar', 'underhåll', 'ekonomi'],
  },
  {
    title: 'Trafikregler',
    href: '/trafikregler/',
    type: 'information',
    typeLabel: 'Regler',
    excerpt: 'Regler för hastighet, körning, parkering, garage, sikt och framkomlighet.',
    keywords: ['trafik', '10 km/h', 'bil', 'parkering', 'garage', 'hastighet', 'körning'],
  },
  {
    title: 'Garage och parkering',
    href: '/trafikregler/#garage',
    type: 'information',
    typeLabel: 'Regler',
    excerpt: 'Information om garage, uppfarter, parkeringsplatser och ansvar i området.',
    keywords: ['garage', 'parkering', 'parkeringsplats', 'uppfart'],
  },
  {
    title: 'Vad är en samfällighet?',
    href: '/vad-ar-en-samfallighet/',
    type: 'information',
    typeLabel: 'Samfälligheten',
    excerpt: 'Så fungerar gemensam förvaltning, medlemskap, stämma, styrelse och andelstal.',
    keywords: ['samfällighet', 'förening', 'stämma', 'styrelse', 'andelstal', 'medlem'],
  },
  {
    title: 'Beslut, stämma och styrelse',
    href: '/for-boende/#beslut-stamma-och-styrelse',
    type: 'information',
    typeLabel: 'Samfälligheten',
    excerpt: 'Information om föreningsstämma, styrelsens ansvar, motioner och förslag.',
    keywords: ['beslut', 'stämma', 'styrelse', 'motion', 'förslag'],
  },
  {
    title: 'Kontakta styrelsen',
    href: '/kontakt/',
    type: 'information',
    typeLabel: 'Kontakt',
    excerpt: 'Kontaktväg för frågor och synpunkter till styrelsen.',
    keywords: ['kontakt', 'styrelsen', 'fråga', 'synpunkt', 'hjälp'],
  },
  {
    title: 'Medlemmar',
    href: '/medlemmar/',
    type: 'information',
    typeLabel: 'Medlem',
    excerpt: 'Information om kommande medlemssidor.',
    keywords: ['medlem', 'inloggning', 'medlemssida'],
  },
  {
    title: 'Stadgar Smedby Samfällighet 1:6',
    href: '/stadgar/',
    type: 'dokument',
    typeLabel: 'Dokument',
    excerpt: 'Föreningens reviderade stadgar från 25 april 2022 som nedladdningsbar PDF.',
    keywords: ['stadgar', 'pdf', 'regler', 'dokument', '2022'],
  },
  {
    title: 'Dokument',
    href: '/dokument/',
    type: 'dokument',
    typeLabel: 'Dokument',
    excerpt: 'Publika dokument, stadgar och kommande dokumentarkiv.',
    keywords: ['dokument', 'pdf', 'arkiv', 'stadgar', 'protokoll'],
  },
  {
    title: 'Kalender och viktiga datum',
    href: '/kalender/',
    type: 'kalender',
    typeLabel: 'Kalender',
    excerpt: 'Kommande möten, aktiviteter, underhåll och andra viktiga datum för området.',
    keywords: ['kalender', 'datum', 'möte', 'städdag', 'aktivitet', 'underhåll'],
  },
];

const newsEntries: SearchEntry[] = news.map((item) => ({
  title: item.title,
  href: `/nyheter/${item.slug}/`,
  type: 'nyheter',
  typeLabel: 'Nyhet',
  excerpt: item.summary,
  keywords: ['nyhet', item.displayDate, ...item.paragraphs],
}));

export const searchEntries: SearchEntry[] = [...baseEntries, ...newsEntries];
