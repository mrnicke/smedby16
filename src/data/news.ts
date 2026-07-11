export type NewsItem = {
  title: string;
  slug: string;
  date: string;
  displayDate: string;
  summary: string;
  paragraphs: string[];
};

export const news: NewsItem[] = [
  {
    title: 'Garage-info Smedby Samfällighet',
    slug: 'garage-info-smedby-samfallighet',
    date: '2023-12-03',
    displayDate: '3 december 2023',
    summary:
      'Information om byte av panel på garage 6 och 7, tillfällig påverkan på parkeringsplatser och praktiska instruktioner under renoveringen.',
    paragraphs: [
      'Här kommer en snabb information gällande bytet av panel på våra garage.',
      'Kontraktet med Söderköpings Bygg är påskrivet och arbetet med garage nr 6 och nr 7 är under uppstart. Arbetet ska vara slutfört den 31 december.',
      'Arbetet medför att parkeringsplatserna till vänster om plats 44 och 51 samt till höger om 35 och 45 inte går att använda under byggperioden. Platserna kommer att spärras av.',
      'De som har dessa platser får använda gästparkeringarna under tiden renoveringen pågår. Gäster får under perioden parkera på andra anvisade ytor.',
      'Det finns innerväggar som inte påverkas av panelbytet, vilket gör att det går att ha bilar i garagen under renoveringen.',
      'Viktigt: Plocka ner allt löst i garagen som riskerar att ramla ner och skada bilar under renoveringen.',
      'Övriga garagepaneler kommer att renoveras inom 3-4 år med indexuppräkning gentemot leverantören för arbetskostnaden. Materialet följer marknadsutvecklingen.',
      'Total kostnad är beräknad till cirka 660 tkr och följer samfällighetens underhållsplan, framtagen i samarbete med HSB.',
      'Bosse håller i dialogen med Söderköpings Bygg.',
    ],
  },
];
