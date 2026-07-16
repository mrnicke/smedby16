# Driftsättning: GitHub Pages och Supabase

Gör momenten i ordning. Lägg aldrig hemliga värden i Git, `.env.example`, GitHub Variables eller webbläsarkod.

## 1. Supabase

1. Skapa ett tomt projekt i närmaste lämpliga EU-region och spara databaslösenordet i en lösenordshanterare.
2. Installera och starta Docker Desktop.
3. Logga in och länka projektet utan att skriva lösenord i kommandoraden:
   ```powershell
   npx.cmd supabase login
   npx.cmd supabase link --project-ref ftzabapabwdkgrpyyvgt
   ```
4. Verifiera lokalt:
   ```powershell
   npm.cmd run supabase:start
   npm.cmd run supabase:lint
   npm.cmd run supabase:test
   npm.cmd run supabase:stop
   ```
5. Ta en separat logisk backup om projektet redan innehåller data.
6. Applicera migreringarna:
   ```powershell
   npx.cmd supabase db push
   ```
7. Deploya funktionerna:
   ```powershell
   npx.cmd supabase functions deploy save-content
   npx.cmd supabase functions deploy restore-revision
   npx.cmd supabase functions deploy calendar-ics --no-verify-jwt
   npx.cmd supabase functions deploy trigger-pages-build
   npx.cmd supabase functions deploy deployment-status --no-verify-jwt
   npx.cmd supabase functions deploy editor-content
   npx.cmd supabase functions deploy editor-lock
   npx.cmd supabase functions deploy editor-library
   npx.cmd supabase functions deploy manage-content
   npx.cmd supabase functions deploy manage-media
   npx.cmd supabase functions deploy manage-navigation
   npx.cmd supabase functions deploy manage-redirect
   npx.cmd supabase functions deploy verify-media-upload
   npx.cmd supabase functions deploy download-document --no-verify-jwt
   npx.cmd supabase functions deploy run-scheduled-publications --no-verify-jwt
   ```
8. Under Authentication, stäng av publik signup och anonyma inloggningar. Ange Site URL `https://www.smedby1-6.se/admin/` och redirect-URL:er för samma adress samt localhost under utveckling.
9. Konfigurera Custom SMTP före produktion. Lägg SMTP-lösenordet endast i Supabase Dashboard.
10. Skapa första Auth-användaren genom Supabase Dashboard och logga in i `/admin/`. Slutför TOTP/AAL2 och använd därefter engångsflödet **Aktivera första administratören**. Skriv inte manuellt till `admin_profiles`; RPC:n serialiserar claim-anropet och auditloggar resultatet. Skapa aldrig publik signup.
11. Konfigurera dokumentmalware-scannern och ladda därefter upp PDF-filen via admin. PDF:en ska först ligga i privat karantän och får endast flyttas till `public-media` efter ett godkänt scannersvar.
12. Konfigurera ett skyddat Cron-anrop till `run-scheduled-publications`. Skicka rå JSON-body tillsammans med `x-webhook-timestamp` och `x-webhook-signature`, där signaturen är HMAC-SHA256 över `<unix timestamp>.<rå body>` med `CRON_WEBHOOK_SECRET`. Hemligheten ska endast finnas server-side och ska vara separat från service role och deploymenthemligheten.

Aktivera inte `PUBLIC_ADVANCED_EDITOR` förrän migration, Edge Functions och RLS-tester har passerat. Den fullständiga editorordningen och rollbackvägen finns i [`editor-v2.md`](editor-v2.md).

## 2. Edge Function-secrets

Skapa en fine-grained GitHub-token som endast gäller detta repository och endast har `Actions: Read and write`. Sätt sedan följande som Supabase Edge Function-secrets:

- `PUBLIC_SITE_URL=https://www.smedby1-6.se`
- `GITHUB_OWNER=mrnicke`
- `GITHUB_REPO=smedby16`
- `GITHUB_ACTIONS_TOKEN`
- `DEPLOYMENT_WEBHOOK_SECRET` med ett separat slumpmässigt värde
- `CRON_WEBHOOK_SECRET` med ett annat separat slumpmässigt värde
- `DOCUMENT_SCAN_URL` till en godkänd HTTPS-baserad malware-scanner
- `DOCUMENT_SCAN_TOKEN` för scannern, lagrad endast som Edge Function-secret

Supabase tillhandahåller `SUPABASE_URL`, anon/publishable-konfiguration och service-role till Edge Functions. Kopiera aldrig service-role till egna publika variabler.

## 3. GitHub

Under repositoryts `Settings → Secrets and variables → Actions → Variables`:

- `PUBLIC_SITE_URL=https://www.smedby1-6.se`
- `PUBLIC_SUPABASE_URL=https://ftzabapabwdkgrpyyvgt.supabase.co`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`

Under `Actions secrets`:

- `SUPABASE_DEPLOYMENT_CALLBACK_URL=https://ftzabapabwdkgrpyyvgt.supabase.co/functions/v1/deployment-status`
- `DEPLOYMENT_WEBHOOK_SECRET` med exakt samma värde som i Supabase

Välj därefter `Settings → Pages → Source → GitHub Actions`. Kör workflowen manuellt och verifiera den tillfälliga Pages-adressen innan DNS ändras.

## 4. Domän och cutover

1. Säkerhetskopiera nuvarande One.com-webbplats och dokumentera alla DNS-poster.
2. Verifiera domänen i GitHub-kontots Pages-inställningar med den TXT-post GitHub visar. Behåll TXT-posten.
3. Ange `www.smedby1-6.se` som Custom domain i repositoryts Pages-inställningar innan DNS ändras.
4. Peka `www` med CNAME direkt till `mrnicke.github.io` utan repositorynamn.
5. Peka apex mot GitHub Pages med de aktuella A-poster GitHub visar i sin dokumentation.
6. Ändra inte MX, SPF, DKIM eller DMARC.
7. Vänta på DNS-kontroll och aktivera Enforce HTTPS.
8. Verifiera `www`, apex-omdirigering, admininloggning, lösenordsåterställning, kalender-ICS och e-post.

Rollback: återställ endast de ändrade webbposterna till One.com. Låt e-postposterna vara orörda och behåll den gamla webbplatsen tills cutover är godkänd.
