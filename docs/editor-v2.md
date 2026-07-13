# Visuell editor v2

## Arkitektur

Editor v2 är additiv och ersätter inte legacyinnehållet direkt. `EditorDocumentV2` valideras centralt med Zod i `src/lib/cms/schema.ts` och består av sektioner, 1–3 kontrollerade kolumner och befintliga block eller referenser till synkade komponenter. Varje redigerbar nod har UUID. Godtycklig nästling, HTML, JavaScript, fri CSS, fria pixelvärden och valfria iframes stöds inte.

Publik renderer och editorcanvas använder samma `BlockRenderer`. Publicerade sidor och nyheter föredrar `editor_document` när `editor_version=2`, annars läses legacyfältet. `migrateLegacyBlocks` är deterministisk och idempotent: varje legacyblock hamnar i egen sektion och ingen legacydata skrivs över. Första formatbytet sker först vid autosave eller publicering.

`PUBLIC_ADVANCED_EDITOR=false` är säker standard. När den sätts till `true` i processmiljön används v2 för sidor och befintliga nyheter. Kalender och dokument behåller strukturerade formulär. Legacyeditorn finns kvar som referens och v2-dokument ska inte redigeras tillbaka till v1.

## Roller och capabilities

Rollerna är `editor` och `admin`; `active` finns kvar. Befintliga aktiva profiler migreras till `admin`, medan nya profiler får `editor` som säker standard. Serverns `requireCapability` och databasens `has_admin_capability` är auktoritativa.

- Editor: redigera och publicera sidor och nyheter samt hantera egna utkast/lås.
- Admin: samma rättigheter plus mallar, synkade komponenter, globala layouts, designsystem, användare och övertagande av utgångna lås.
- Anon: endast uttryckligen publicerad data, publicerade komponenter/layouts och aktiva redirects.

Klienten har inga policies för direkt skrivning till publicerade tabeller. Publicering sker i Edge Function med service role på serversidan. Service role förekommer aldrig i webbläsarkod.

## Utkast, autosave och lås

`content_drafts` innehåller ett aktuellt utkast per entity, draftversion och basversion av publicerat innehåll. Ändringar autosparas efter cirka två sekunders inaktivitet och ändrar aldrig publicerade tabeller. En versionskonflikt ger HTTP 409 och skriver inte över serverversionen.

`content_locks` innehåller användare, unik token, heartbeat och expiry. Heartbeat skickas var 30:e sekund; låset löper ut efter två minuter. En annan aktiv redaktör får skrivskyddat läge. Publicering kräver både korrekt låstoken och förväntad publicerad version.

## Publicering, historik och schemaläggning

Publicering validerar dokumentet och kvalitetsgrinden server-side, kontrollerar lås och version och uppdaterar publicerad läsmodell. Befintliga revisionstriggers skapar historik. Återställning av sida eller nyhet skapar ett previewbart utkast; den publicerade posten skrivs inte över.

`scheduled_publications` behandlas idempotent av `run-scheduled-publications`. Endast en pending/processing-körning kan claimas. Funktionen ska anropas av Supabase Cron eller motsvarande med service-role-authorization; ingen cronhemlighet får finnas i klienten.

## Mallar, komponenter och globala layouts

- `editor_templates`: adminhanterade sid-/nyhetsmallar med låsta noder och redigerbara fält. Instansiering ska ge nya nod-ID:n.
- `reusable_components`: publicerad definition, exponerade instansegenskaper, version och usagekontroll. Sidor lagrar endast komponent-ID och properties.
- `global_layouts`: header, navigation, footer och kuraterat designsystem. Endast admin kan mutera dem.

Det kuraterade designsystemet finns i `src/lib/cms/designSystem.ts`. Det exponerar registrerade paletter, typografiskalor, spacing, containerbredder, knappar, sektioner och bildförhållanden—inte fri CSS.

## Media, SEO och kvalitetsgrind

Bilder behåller originalfilen. Bildanvändningen lagrar dekorativ markering, alt-text, aspect/crop och fokuspunkt x/y. Rendering använder `object-position`. Permanent mediaradering fortsätter blockeras när referenser finns.

Blockerande kontroller omfattar ogiltigt dokument, saknad/flera H1, hoppad rubriknivå, meningsbärande bild utan alt-text, osäker URL, tom obligatorisk text och saknad komponent. SEO-längder, delningsbild, långa texter och många sektioner är råd. Serverkontrollen är auktoritativ.

## Redirects och arkivering

`content_redirects` tillåter endast interna mål och blockerar självreferens och loopar. Builden hämtar aktiva redirects och skapar statiska sidor med canonical URL, omedelbar klientredirect och klickbar reservlänk för GitHub Pages. Sidor har avpublicering och `archived_at`; permanent radering erbjuds inte.

## Lokal testning

```powershell
npm.cmd run check
npm.cmd test
$env:PUBLIC_ADVANCED_EDITOR='false'; npm.cmd run build
$env:PUBLIC_ADVANCED_EDITOR='true'; npm.cmd run build
npm.cmd run supabase:start
npm.cmd run supabase:lint
npm.cmd run supabase:test
npm.cmd run test:e2e:local
npm.cmd run test:e2e:editor
npm.cmd run supabase:stop
```

Starta och stoppa bara den lokala Supabase-stack som hör till projektet. E2E kräver lokala testnycklar i processmiljön; skriv aldrig ut eller committa dem.

## Säker produktionsordning

1. Ta och verifiera backup.
2. Applicera additiva migrationer med CLI.
3. Deploya Edge Functions.
4. Verifiera RLS för anon, editor och admin.
5. Deploya frontend med `PUBLIC_ADVANCED_EDITOR=false`.
6. Smoke-testa publik webb, admin och statisk fallback.
7. Aktivera editorn för en kontrollerad miljö.
8. Migrera innehåll etappvis genom första autosave/publicering.
9. Verifiera live Supabase-innehåll och statisk fallback.
10. Behåll rollbackmöjlighet tills acceptanstester passerat.

Rollback: sätt feature flag till `false` och deploya föregående frontend. Låt additiva tabeller/kolumner vara kvar; de påverkar inte v1-läsning. Återställ en publicerad revision genom att skapa utkast och publicera kontrollerat. Rulla inte tillbaka med destruktiv SQL. Migrationer eller produktionsfunktioner ska inte appliceras utan separat produktionsauktorisation.
