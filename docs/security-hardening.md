# Säkerhetshärdning och driftsättning

Den här filen skiljer på kod som finns i repot och kontroller som måste utföras i Supabase, staging eller framför GitHub Pages. Inga produktionsmigrationer, DNS-ändringar, hemlighetsrotationer eller aktiva skanningar får ske utan separat godkännande och verifierad backup.

## Behörighetsmodell

| Capability | Editor | Admin | Primära funktioner |
| --- | --- | --- | --- |
| `edit_pages`, `publish_pages` | Ja | Ja | `editor-content`, `editor-lock`, `manage-redirect`, `save-content` |
| `edit_news`, `publish_news` | Ja | Ja | `editor-content`, `editor-lock`, `manage-content`, `save-content` |
| `manage_calendar`, `manage_documents` | Nej | Ja | `manage-content`, `save-content` |
| `manage_media` | Nej | Ja | `manage-media`, `verify-media-upload` |
| `manage_navigation`, `manage_settings` | Nej | Ja | `manage-navigation`, `save-content` |
| `manage_revisions`, `trigger_deploy` | Nej | Ja | `restore-revision`, `trigger-pages-build` |
| Biblioteks-, layout-, design- och användarcapabilities | Nej | Ja | `editor-library` och framtida adminflöden |

Alla administrativa mutationer kräver ett verifierat användar-JWT med `aal=aal2`. Service role används enbart internt efter autentisering/auktorisering. UI-filtrering är inte en säkerhetsgräns.

## Migration och rollback

Migrationen `20260713000100_security_hardening.sql` är skapad men ska inte appliceras automatiskt. Före staging eller produktion:

1. Kontrollera att `git status --short` endast visar avsedda ändringar.
2. Ta en fullständig, återläsningsbar backup med Supabase CLI eller leverantörens backupflöde. Spara inte databas-URL eller tokens i terminalutskrift eller rapport.
3. Dokumentera backupens tid, storlek och verifierad restore till en separat ephemeral instans.
4. Jämför lokal och hostad migrationslista utan att skriva ut credentials.
5. Kör migration och pgTAP först på färsk lokal/ephemeral Supabase.

Rollback är att återställa de tidigare draft/lock- och storage-policyerna, ta bort de nya execute-grants och återställa databasen från verifierad backup om data eller auth påverkas. Tabellerna `security_audit_log` och `security_webhook_nonces` ska lämnas kvar tills incidentanalys och retention är klar. First-admin-funktionen återaktiverar aldrig en befintlig profil och fungerar bara när ingen aktiv admin finns, anroparen har AAL2 och ingen profil redan finns.

## Hostad Supabase Auth-kontroll

Kontrollera manuellt i dashboard före staging och spara endast inställningsvärden, aldrig nycklar:

- Public signup och anonymous sign-in: av.
- TOTP enrollment och verification: på.
- Lösenord: minst 12 tecken, starkaste teckenkravet och leaked-password-kontroll om planen stödjer det.
- Secure password change/reauthentication: på. Recovery-redirects ska exakt matcha admin-URL:erna.
- Rate limits: högst 10 sign-in/sign-up per 5 minuter/IP, 10 tokenverifieringar per 5 minuter/IP, 60 refresh per 5 minuter/IP och 2 recovery-mejl per timme.
- Session: JWT 60 minuter, timebox 12 timmar, inactivity 30 minuter, refresh rotation på och reuse interval 10 sekunder. Överväg single-session per user.
- CAPTCHA: Supabase stödjer Turnstile/hCaptcha för login och recovery. Aktivera först efter att en publik site key och hemlig provider-nyckel har skapats i godkänt secret-flöde och frontendens challenge är testad i staging. Ingen secret ska läggas i repot.

Den lokala konfigurationen speglar MFA, signup, rate limits och sessionstider. `npm run test:e2e:security` vägrar andra hosts än localhost och bevisar anon/inaktiv/editor/admin samt att signup är avstängd.

## Edge, webhooks och abuse-skydd

- Okända origins får ingen `Access-Control-Allow-Origin`. Alla endpoints har explicit metod, `Allow` vid 405, Content-Type-kontroll och bodygräns.
- `deployment-status` och `run-scheduled-publications` använder HMAC-SHA256 över `<unix timestamp>.<rå body>`, högst fem minuters tidsavvikelse och unik replay-hash i databasen.
- `CRON_WEBHOOK_SECRET` är separat från service role. `DEPLOYMENT_WEBHOOK_SECRET`, cron-secret, GitHub-token och service role ska ha olika värden och ägare.
- Publik sökning begränsas till 120 tecken, 50 resultat, offset 1000 och två sekunders statement timeout. Lägg edge/cache/rate limit framför RPC:n i vald proxy; index/tsvector ska läggas först efter mätning på staging.
- Schemalagda jobb har claim, högst tre försök och återställer processing-jobb som fastnat i 15 minuter.

## Filhantering

Klienten laddar endast upp som `application/octet-stream` till en privat användarspecifik karantän. Servern kontrollerar path, verkliga magic bytes, storlek, filnamn och bilddimensioner. JPEG, PNG och WebP tillåts; aktiva/felmärkta format och extrema dimensioner nekas. PDF kräver både strukturell kontroll och ett HTTPS-baserat malware-scan-svar med `clean=true` innan flytt till publik bucket. Om skannern saknas ligger filen kvar i karantän och publiceras inte.

PDF hämtas via `download-document`, som sätter `application/pdf`, säker `Content-Disposition`, `nosniff`, cache och same-site resource policy. Bild-re-encoding kräver en separat verifierad sanitizer-tjänst och är en kvarvarande stagingåtgärd.

## Headers och CSP utan DNS-ändring

GitHub Pages kan inte sätta de nödvändiga svarshuvudena per route. Minsta säkra val är antingen:

1. Cloudflare/proxy framför befintlig Pages-origin, med transform rules, rate limits och CSP-rapportendpoint.
2. Flytta den statiska artefakten till en host som stöder versionsstyrda headers.

Ingen ändring görs förrän lösning är vald. Börja i staging med `Content-Security-Policy-Report-Only`:

```text
default-src 'none'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' <byggspecifika-sha256-hashar>; style-src 'self'; img-src 'self' data: https://<project>.supabase.co; font-src 'self'; connect-src 'self' https://<project>.supabase.co wss://<project>.supabase.co; frame-src https://www.youtube-nocookie.com https://player.vimeo.com; manifest-src 'self'; upgrade-insecure-requests
```

Hasha de kvarvarande statiska inline-scripten efter varje build. De dynamiska `style`-attributen för bildfokus/editor-DnD måste flyttas till klasser eller en nonce-kompatibel lösning innan `style-src` kan vara helt utan inline-undantag. Efter rapportfri staging aktiveras CSP och admin ska alltid ha `frame-ancestors 'none'`.

Sätt dessutom `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, en minimal `Permissions-Policy` (camera, microphone, geolocation, payment och usb av), `Cross-Origin-Opener-Policy: same-origin` där OAuth/editorflödet är verifierat och HSTS först efter verifierad full HTTPS-drift. Inbäddningar är begränsade till YouTube-nocookie/Vimeo och har sandbox/minimal allow-policy.

## Lokal exponering och scanning

Docker Desktop publicerar de lokala Supabase-portarna på wildcard-adresser. Ett verifieringsförsök med Supabases rekommenderade Docker-nätverk `com.docker.network.bridge.host_binding_ipv4=127.0.0.1` var inte tillräckligt i den aktuella Windows/CLI-kombinationen: containrarnas `HostIp` blev tomt och port 55321/55322 gick att nå via hostens LAN-adress. Windows-brandväggen har dessutom en aktiv publik allow-regel för Docker backend utan portspecificering. Ändra inte den globala Docker-regeln blint eftersom andra containrar kan påverkas.

Supabase CLI:s lokala Kong-gateway har dessutom en egen generell CORS-plugin som fångar `OPTIONS` och lägger till `Access-Control-Allow-Origin: *` innan Edge Function-koden körs. `test:e2e:security` identifierar och rapporterar denna lokala begränsning. Den faktiska funktionspolicyn verifieras med Vitest mot den delade preflight-gränsen och, vid full lokal verifiering, med en intern request direkt till Edge-runtime. Staging/produktion måste kontrolleras separat genom den publika gatewayn; lokal Kong får aldrig användas som bevis för hostad CORS-policy.

Kör i stället den portspecifika, idempotenta blockeringen från ett upphöjt PowerShell-fönster:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows-local-supabase-firewall.ps1
```

Skriptet blockerar endast inkommande TCP-trafik till Supabases standardintervall 54320-54329 och det isolerade verifieringsintervallet 55320-55329. Lokal loopback ska fortsätta fungera. Verifiera både loopback och nekad åtkomst från en annan LAN-host innan migrationsverifieringen återupptas. Återställning, om portarna avsiktligt behöver exponeras senare, är samma kommando med `-Remove`. Exponera aldrig Docker socket.

Kör passiv ZAP baseline endast mot lokal preview eller staging. Aktiv/autentiserad ZAP kräver separat godkännande och får aldrig riktas mot produktion. Efter vald staging-host verifieras headers med både browser DevTools och en extern headerkontroll.

## Rotation och incident

| Credential | Normal rotation | Vid incident |
| --- | --- | --- |
| GitHub Actions-token | 90 dagar och vid ägarbyte | Spärra först, granska workflow-runs/audit, skapa ny least-privilege token |
| Deployment/cron HMAC | 90 dagar, separat per syfte | Byt båda ändar kontrollerat, rensa inte audit/replay-data före analys |
| Supabase service role | Endast planerat underhåll eller incident | Rotera i Supabase, uppdatera endast godkänt secret store, redeploy funktioner, granska åtkomst |
| Dokument-scanner-token | 90 dagar | Spärra, stoppa PDF-publicering, skanna om karantän vid behov |

Incidentordning: begränsa åtkomst, bevara auditloggar, rotera berörd credential, verifiera RLS/Edge/CI, återställ från känd backup vid dataintegritetsrisk och dokumentera tidslinje utan payloads, tokens, sessioner eller persondata.
