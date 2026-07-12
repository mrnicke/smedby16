with page_content(page_key, title, seo_title, seo_description, blocks) as (
  values
  (
    'home', 'Startsida', 'Smedby 1:6 | Samfällighetsföreningen',
    'Information, nyheter, dokument och viktiga datum för boende i Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Välkommen till Smedby 1:6","text":"Information för boende i Samfällighetsföreningen Smedby 1:6.","image":{"src":"/images/smedby-aerial-hero.webp","alt":"Flygbild över bostadsområdet Smedby 1:6"},"action":{"label":"För boende","href":"/for-boende/"}},
      {"type":"area_guide","heading":"Områdesguiden","text":"Hitta garage, parkeringar, gångvägar, grönytor, sophantering och områdets entréer. Guiden uppdateras löpande när ny information blir tillgänglig.","image":{"src":"/images/smedby-area-overview.webp","alt":"Översikt över Smedby 1:6"},"links":[{"label":"Trafik och parkering","href":"/trafikregler/"},{"label":"Kontakta styrelsen","href":"/kontakt/"}]},
      {"type":"card_grid","heading":"Hitta rätt","cards":[
        {"title":"Senaste nytt","text":"Håll dig uppdaterad om vad som händer i området.","link":{"label":"Visa nyheter","href":"/senaste-nytt/"}},
        {"title":"Kalender","text":"Se bekräftade möten, aktiviteter och arbeten.","link":{"label":"Öppna kalendern","href":"/kalender/"}},
        {"title":"Trafikregler","text":"Läs regler för körning, parkering och garage.","link":{"label":"Läs reglerna","href":"/trafikregler/"}},
        {"title":"Dokument","text":"Hämta stadgar och andra publika dokument.","link":{"label":"Visa dokument","href":"/dokument/"}}
      ]},
      {"type":"news_feed","heading":"Senaste nytt","limit":3},
      {"type":"calendar_feed","heading":"Kommande datum","limit":3},
      {"type":"search_teaser","heading":"Sök på webbplatsen","text":"Hitta regler, dokument och information."},
      {"type":"notice","heading":"Frågor eller synpunkter?","text":"Styrelsen hjälper gärna till. Använd kontaktsidan för att hitta aktuell kontaktväg.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'latest-news', 'Senaste nytt', 'Senaste nytt | Smedby 1:6',
    'Publicerade nyheter och viktig information för boende i Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Senaste nytt","text":"Publicerade nyheter och viktig information för boende."},
      {"type":"news_feed","heading":"Publicerade nyheter","limit":12}
    ]$json$::jsonb
  ),
  (
    'calendar', 'Kalender', 'Kalender och viktiga datum | Smedby 1:6',
    'Kommande möten, aktiviteter, underhåll och viktiga datum för boende i Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Viktiga datum","text":"Här publiceras bekräftade möten, aktiviteter och arbeten som berör området."},
      {"type":"calendar_feed","heading":"Kommande","limit":12},
      {"type":"link_list","heading":"Kalenderprenumeration","links":[{"label":"Hämta kalenderfil (ICS)","href":"/kalender.ics"}]},
      {"type":"notice","heading":"Prenumerera på kalendern","text":"Kalenderfilen finns via länken Hämta kalenderfil och uppdateras när nya publicerade aktiviteter läggs in.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'residents', 'För boende', 'För boende | Smedby 1:6',
    'Praktisk information för boende och fastighetsägare i Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"För boende","text":"Här samlas praktisk information om vad som är bra att känna till som boende och fastighetsägare i området.","image":{"src":"/images/miljo-gangvag.webp","alt":"Gemensam gångväg och bostäder i området"}},
      {"type":"card_grid","heading":"Bra att känna till","cards":[
        {"title":"Läs regler och stadgar","text":"Trafikreglerna och stadgarna beskriver hur gemensamma ytor, ansvar och beslut fungerar.","link":{"label":"Till trafikregler","href":"/trafikregler/"}},
        {"title":"Håll dig uppdaterad","text":"Nyheter och meddelanden publiceras när det finns information som berör boende.","link":{"label":"Senaste nytt","href":"/senaste-nytt/"}},
        {"title":"Kontakta styrelsen","text":"Använd kontaktsidan när du har en fråga eller praktisk synpunkt.","link":{"label":"Kontaktsida","href":"/kontakt/"}},
        {"title":"Kalender och viktiga datum","text":"Se bekräftade möten, aktiviteter och arbeten som berör området.","link":{"label":"Öppna kalendern","href":"/kalender/"}}
      ]},
      {"type":"image_text","heading":"Nyinflyttad i området","text":"Som fastighetsägare i en samfällighet är du del av ett gemensamt ansvar för anläggningar och ytor som föreningen förvaltar. Läs stadgarna, ta del av trafik- och parkeringsreglerna, håll utkik efter nyheter och kontakta styrelsen om du är osäker på vad som gäller.","image":{"src":"/images/miljo-gangvag.webp","alt":"Gemensamma gångstråk och närmiljö"},"imagePosition":"right"},
      {"type":"notice","heading":"Privat och gemensamt ansvar","text":"Föreningen hanterar gemensamma frågor. Sådant som rör den egna fastigheten ansvarar normalt fastighetsägaren själv för, om inte stadgar eller särskilda beslut säger något annat.","tone":"info"},
      {"type":"card_grid","heading":"Beslut, stämma och styrelse","cards":[
        {"title":"Stämman beslutar","text":"Föreningsstämman är medlemmarnas forum för större beslut, exempelvis ansvarsfrihet, val, ekonomi och motioner."},
        {"title":"Styrelsen sköter löpande frågor","text":"Styrelsen ansvarar för den löpande förvaltningen enligt stadgar, stämmobeslut och föreningens uppdrag."},
        {"title":"Motioner och förslag","text":"Medlemmar kan lämna förslag enligt rutinerna och tiderna i stadgar eller kallelse. Praktiska synpunkter kan lämnas till styrelsen."}
      ]},
      {"type":"rich_text","heading":"Ekonomi och underhåll","document":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Avgifter och gemensamma medel används för föreningens drift, löpande skötsel och planerat underhåll. För större anläggningar arbetar föreningen normalt med en underhållsplan och avsätter medel för framtida åtgärder."}]},
        {"type":"paragraph","content":[{"type":"text","text":"Exakta belopp, betalningsrutiner och budgetbeslut ska alltid kontrolleras mot föreningens aktuella handlingar, exempelvis stämmoprotokoll, budget och stadgar."}]}
      ]}}
    ]$json$::jsonb
  ),
  (
    'community', 'Vad är en samfällighet?', 'Vad är en samfällighet? | Smedby 1:6',
    'Kort information om vad en samfällighetsförening är och hur den fungerar.',
    $json$[
      {"type":"hero","heading":"Vad är en samfällighet?","text":"En samfällighetsförening förvaltar anläggningar och mark som flera fastigheter använder gemensamt."},
      {"type":"card_grid","heading":"Så fungerar föreningen","cards":[
        {"title":"Gemensam förvaltning","text":"Föreningen förvaltar anläggningar och mark för gemensamt nyttjande."},
        {"title":"Fastighetsägare är medlemmar","text":"Medlemmar är fastighetsägare som har del i samfälligheten."},
        {"title":"Stämma och styrelse","text":"Stämman är beslutande organ och styrelsen är verkställande organ."}
      ]},
      {"type":"rich_text","document":{"type":"doc","content":[
        {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Bildas enligt lag"}]},
        {"type":"paragraph","content":[{"type":"text","text":"En samfällighetsförening bildas enligt lagen om förvaltning av samfälligheter. Syftet är en tydlig form för skötsel, beslut och ekonomi när flera fastigheter delar ansvar."}]},
        {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Vad kan ingå?"}]},
        {"type":"paragraph","content":[{"type":"text","text":"En gemensamhetsanläggning kan avse vägar, grönytor, lekplatser, garage, parkeringar, ledningar, belysning och andra anläggningar som används gemensamt."}]}
      ]}},
      {"type":"card_grid","heading":"Vanliga begrepp","cards":[
        {"title":"Samfällighet","text":"Gemensam egendom, rättighet eller anläggning som flera fastigheter har del i."},
        {"title":"Gemensamhetsanläggning","text":"Anläggning som är till nytta för flera fastigheter, exempelvis väg, garage eller grönyta."},
        {"title":"Delägarfastighet","text":"Fastighet som har del i samfälligheten. Ägaren är normalt medlem i föreningen."},
        {"title":"Andelstal","text":"Anger hur kostnader och ibland röster i ekonomiska frågor fördelas."},
        {"title":"Stämma","text":"Föreningens beslutande möte där medlemmarna behandlar större föreningsfrågor."},
        {"title":"Styrelse","text":"Sköter den löpande förvaltningen utifrån stadgar och stämmobeslut."}
      ]},
      {"type":"faq","heading":"Vanliga frågor","items":[
        {"question":"Är alla boende medlemmar i samfälligheten?","answer":"Medlemskapet är kopplat till fastigheten. Det är fastighetsägare som normalt är medlemmar i samfällighetsföreningen."},
        {"question":"Vad beslutar styrelsen och vad beslutar stämman?","answer":"Styrelsen hanterar den löpande förvaltningen. Större frågor, val, ansvarsfrihet och budget hanteras normalt på föreningsstämman enligt stadgarna."},
        {"question":"Vad används avgifterna till?","answer":"Avgifter används för gemensamma kostnader, drift och underhåll av det föreningen ansvarar för."},
        {"question":"Var hittar jag det som gäller för Smedby 1:6?","answer":"Börja med föreningens stadgar, trafikregler och publicerade nyheter. Kontakta styrelsen vid osäkerhet."}
      ]},
      {"type":"notice","heading":"Allmän information","text":"Informationen är en förenklad beskrivning. Föreningens stadgar, stämmobeslut och gällande lag har företräde om något behöver bedömas formellt.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'traffic', 'Trafikregler', 'Trafikregler | Smedby 1:6',
    'Regler för trafik, parkering och garage i Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Trafikregler","text":"Området är byggt för så lite trafik som möjligt. Reglerna finns för trygghet, sikt och framkomlighet.","image":{"src":"/images/miljo-villagata.webp","alt":"Lugn lokalgata med häckar och gemensam väg"}},
      {"type":"card_grid","heading":"Kort version","cards":[
        {"title":"10 km/h","text":"Hastighetsbegränsningen inom området är 10 km/h."},
        {"title":"Minimera körning","text":"Körning ska begränsas till minimum och främst ske vid i- och urlastning av stora eller tunga saker."},
        {"title":"Parkera rätt","text":"Parkering sker endast i markerade rutor. Gator, vändplaner och gräsmattor får inte användas för parkering."}
      ]},
      {"type":"rich_text","heading":"Trafik i området","document":{"type":"doc","content":[
        {"type":"paragraph","content":[{"type":"text","text":"Vägarna har tunn asfalt, begränsad sikt och ska vara säkra för både barn och vuxna. Därför gäller ett generellt förbud mot bil-, mc- och mopedkörning samt parkering inom området."}]},
        {"type":"bulletList","content":[
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Körning ska begränsas till minimum."}]}]},
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"I- och urlastning av stora eller tunga saker är det huvudsakliga undantaget."}]}]},
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Fordon får inte bli stående efter i- eller urlastning."}]}]},
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Handikappfordon och sjuktransporter är tillåtna."}]}]}
        ]}
      ]}},
      {"type":"rich_text","heading":"Parkering","document":{"type":"doc","content":[
        {"type":"bulletList","content":[
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Parkering är endast tillåten i markerade rutor."}]}]},
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Varje husägare har egen parkeringsplats. Gästplatser är avsedda för gäster och inte permanent boendeparkering."}]}]},
          {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Parkering på vändplan, gator och gräsmattor är förbjuden."}]}]}
        ]}
      ]}},
      {"type":"notice","heading":"Sikt vid korsningar och utfarter","text":"Häckar vid korsningar och utfarter ska hållas klippta så att sikten är god.","tone":"warning"},
      {"type":"image_text","heading":"Garage","text":"Garage är avsedda för fordon. De ska inte användas som allmänt förråd, arbetsplats eller för laddning och kontinuerlig elanvändning.","image":{"src":"/images/miljo-garage-parkering.webp","alt":"Garage och parkeringsplatser i området"},"imagePosition":"right"},
      {"type":"notice","heading":"Ansvar","text":"Husägare ansvarar för att gäster följer trafik- och parkeringsreglerna.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'documents', 'Dokument', 'Dokument | Smedby 1:6',
    'Publika dokument för Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Dokument","text":"Här samlas föreningens publika dokument.","image":{"src":"/images/miljo-gronyta.webp","alt":"Gemensam grönyta i Smedby"}},
      {"type":"document_list","heading":"Publika dokument"},
      {"type":"notice","heading":"Kommande dokumentarkiv","text":"Medlemsdokument kommer senare. Den här versionen innehåller inget privat dokumentarkiv och ingen medlemsinloggning.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'contact', 'Kontakt', 'Kontakta styrelsen | Smedby 1:6',
    'Kontaktinformation för Samfällighetsföreningen Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Kontakta styrelsen","text":"Använd sidan för att komma i kontakt med styrelsen."},
      {"type":"notice","heading":"Kontaktuppgifter kompletteras","text":"Kontaktuppgifter och eventuellt formulär aktiveras när föreningen har fastställt vilken kontaktväg som ska visas publikt. Inget formulär skickas från webbplatsen i denna version.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'members', 'Medlemmar', 'Medlemmar | Smedby 1:6',
    'Information om kommande medlemssidor för Smedby 1:6.',
    $json$[
      {"type":"hero","heading":"Medlemmar","text":"Medlemssidor kommer i ett senare steg."},
      {"type":"notice","heading":"Ingen medlemsinloggning i denna version","text":"Dokument, protokoll och medlemsinformation kan bli tillgängliga här senare. Den första versionen innehåller ingen medlemsinloggning och ingen medlemshantering.","tone":"info"}
    ]$json$::jsonb
  ),
  (
    'search', 'Sök', 'Sök | Smedby 1:6',
    'Sök bland information, nyheter, dokument och kalenderposter på webbplatsen.',
    $json$[
      {"type":"hero","heading":"Sök på webbplatsen","text":"Hitta regler, dokument, nyheter och information."},
      {"type":"search_teaser","heading":"Vad letar du efter?","text":"Sökningen använder endast publicerat innehåll."}
    ]$json$::jsonb
  ),
  (
    'bylaws', 'Stadgar', 'Stadgar | Smedby 1:6',
    'Samfällighetens stadgar i PDF-format.',
    $json$[
      {"type":"hero","heading":"Stadgar","text":"Här finns samfällighetens stadgar i PDF-format."},
      {"type":"document_list","heading":"Stadgar","category":"Stadgar"},
      {"type":"notice","heading":"Om filen inte öppnas","text":"Prova att ladda ner PDF-filen och öppna den lokalt på din enhet.","tone":"info"}
    ]$json$::jsonb
  )
)
update public.pages as page
set
  title = content.title,
  seo_title = content.seo_title,
  seo_description = content.seo_description,
  blocks = content.blocks,
  is_published = true
from page_content as content
where page.page_key = content.page_key;

update public.news_posts
set body_blocks = $json$[
  {"type":"rich_text","document":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Här kommer en snabb information gällande bytet av panel på våra garage."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Kontraktet med Söderköpings Bygg är påskrivet och arbetet med garage nr 6 och nr 7 är under uppstart. Arbetet ska vara slutfört den 31 december."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Arbetet medför att parkeringsplatserna till vänster om plats 44 och 51 samt till höger om 35 och 45 inte går att använda under byggperioden. Platserna kommer att spärras av."}]},
    {"type":"paragraph","content":[{"type":"text","text":"De som har dessa platser får använda gästparkeringarna under tiden renoveringen pågår. Gäster får under perioden parkera på andra anvisade ytor."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Det finns innerväggar som inte påverkas av panelbytet, vilket gör att det går att ha bilar i garagen under renoveringen."}]}
  ]}},
  {"type":"notice","heading":"Viktigt","text":"Plocka ner allt löst i garagen som riskerar att ramla ner och skada bilar under renoveringen.","tone":"warning"},
  {"type":"rich_text","document":{"type":"doc","content":[
    {"type":"paragraph","content":[{"type":"text","text":"Övriga garagepaneler kommer att renoveras inom 3–4 år med indexuppräkning gentemot leverantören för arbetskostnaden. Materialet följer marknadsutvecklingen."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Total kostnad är beräknad till cirka 660 tkr och följer samfällighetens underhållsplan, framtagen i samarbete med HSB."}]},
    {"type":"paragraph","content":[{"type":"text","text":"Bosse håller i dialogen med Söderköpings Bygg."}]}
  ]}}
]$json$::jsonb
where slug = 'garage-info-smedby-samfallighet';

update public.documents
set is_published = true
where media_id = '11111111-1111-4111-8111-111111111111';
