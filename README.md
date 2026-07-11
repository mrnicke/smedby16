# Smedby 1:6

Astro-webbplats för Samfällighetsföreningen Smedby 1:6 med statisk fallback, Supabase CMS och ett inbjudningsskyddat adminsystem.

## Installera

```bash
npm install
```

## Kör lokalt

```bash
npm run dev
```

## Bygg statisk version

```bash
npm run build
```

Färdiga filer hamnar i `dist/`.

## Admin och Supabase

1. Kopiera `.env.example` till `.env` och fyll endast i Supabase Project URL och publishable key.
2. Kör `npm run dev` och öppna `/admin/`.
3. Databas, RLS, Storage och Edge Functions finns under `supabase/` och ska appliceras via CLI, inte genom manuell SQL-redigering.

Om publik Supabase-konfiguration saknas fortsätter den nuvarande statiska webbplatsen att fungera. Produktionsworkflowen använder `CMS_REQUIRED=true` och stoppar publiceringen om snapshoten inte kan hämtas.

Fullständig och säker driftsättningsordning finns i [`docs/deployment.md`](docs/deployment.md).

## Lokal statisk fallback

1. Kör `npm run build`.
2. Ladda upp innehållet i `dist/` till webbhotellets publika katalog.

## Dokument

Stadgarna ska ligga här:

`public/dokument/stadgar-smedby-samfallighet-1-6-rev-2022-04-25.pdf`

Om filen saknas efter installation behöver PDF:en kopieras manuellt till sökvägen ovan.

## Avgränsningar

- Inget riktigt kontaktformulär.
- Ingen publik registrering eller medlemsportal.
- Dokument måste laddas upp till Supabase Storage innan de publiceras från CMS:et.

## Senare faser

- Kontaktformulär.
- Medlemssidor.
- Flera adminroller, MFA och schemalagd publicering.
